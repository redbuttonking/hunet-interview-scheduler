// 외부 회의실 예약을 Firestore 예약 블록으로 동기화하는 서버 전용 서비스
import { FieldValue } from 'firebase-admin/firestore'
import { RoomBookmarkPayload } from '@/domain/model/RoomBookmark'
import { adminDb } from './adminConfig'
import { COLLECTIONS } from './collections'

/** 다우오피스 회의실 이름의 호수 접두사를 제거한다 */
function stripRoomPrefix(name: string): string {
  return name.replace(/^\[.*?\]\s*/, '').trim()
}

/** 동일한 회의실을 찾거나 새 회의실을 생성한다 */
async function findOrCreateRoom(name: string): Promise<{ id: string; name: string }> {
  const db = adminDb()
  const exactSnap = await db.collection(COLLECTIONS.ROOMS).where('name', '==', name).get()
  if (!exactSnap.empty) return { id: exactSnap.docs[0].id, name }

  const allSnap = await db.collection(COLLECTIONS.ROOMS).get()
  const matched = findRoomByBaseName(allSnap.docs, name)
  if (matched) {
    await db.collection(COLLECTIONS.ROOMS).doc(matched.id).update({ name })
    return { id: matched.id, name }
  }

  return createRoom(name, allSnap.docs)
}

/** 접두사를 제외한 회의실 이름으로 기존 회의실을 찾는다 */
function findRoomByBaseName(docs: FirebaseFirestore.QueryDocumentSnapshot[], name: string) {
  const baseName = stripRoomPrefix(name)
  if (!baseName || baseName === name) return null
  return docs.find((doc) => {
    const existing = (doc.data().name as string) || ''
    return existing === baseName || stripRoomPrefix(existing) === baseName
  }) ?? null
}

/** 정렬 순서의 마지막에 새 회의실을 생성한다 */
async function createRoom(name: string, docs: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<{ id: string; name: string }> {
  const maxOrder = docs.reduce((max, doc) => {
    const order = doc.data().order
    return typeof order === 'number' ? Math.max(max, order) : max
  }, -1)
  const ref = await adminDb().collection(COLLECTIONS.ROOMS).add({
    name,
    order: maxOrder + 1,
    createdAt: FieldValue.serverTimestamp(),
  })
  return { id: ref.id, name }
}

/** 외부 예약 ID와 연결된 예약 문서를 찾는다 */
async function findByExternalId(externalId: number) {
  const snap = await adminDb()
    .collection(COLLECTIONS.ROOM_RESERVATIONS)
    .where('externalId', '==', externalId)
    .get()
  return snap.empty ? null : snap.docs[0]
}

/** 외부 예약 취소를 시스템 예약에도 반영한다 */
async function cancelReservation(externalId: number): Promise<void> {
  const existing = await findByExternalId(externalId)
  if (existing) await existing.ref.delete()
}

/** 외부 예약 생성 또는 변경을 시스템 예약에 반영한다 */
async function upsertReservation(
  payload: RoomBookmarkPayload,
  bookingOwner?: { userId: string | null; name: string },
): Promise<void> {
  const room = await findOrCreateRoom(payload.roomName)
  const existing = await findByExternalId(payload.externalId)
  const fields = {
    roomId: room.id,
    roomName: room.name,
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (existing) {
    const existingOwnerName = existing.data().bookedByName
    await existing.ref.update({
      ...fields,
      ...(bookingOwner && !existingOwnerName ? {
        bookedByUserId: bookingOwner.userId,
        bookedByName: bookingOwner.name,
      } : {}),
    })
    return
  }

  await adminDb().collection(COLLECTIONS.ROOM_RESERVATIONS).add({
    ...fields,
    status: 'reserved',
    interviewId: null,
    bookedByUserId: bookingOwner?.userId ?? null,
    bookedByName: bookingOwner?.name ?? null,
    memo: '',
    externalId: payload.externalId,
    createdAt: FieldValue.serverTimestamp(),
  })
}

/** 외부 회의실 예약 생성·변경·취소를 시스템 예약에 동기화한다 */
export async function syncRoomReservation(
  payload: RoomBookmarkPayload,
  bookingOwner?: { userId: string | null; name: string },
): Promise<void> {
  if (payload.action === 'cancel') {
    await cancelReservation(payload.externalId)
    return
  }
  await upsertReservation(payload, bookingOwner)
}
