import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'

type CollectionKey = 'interviews' | 'interviewers' | 'positions' | 'roomReservations' | 'rooms'

const ALLOWED: Record<CollectionKey, string> = {
  interviews:       COLLECTIONS.INTERVIEWS,
  interviewers:     COLLECTIONS.INTERVIEWERS,
  positions:        COLLECTIONS.POSITIONS,
  roomReservations: COLLECTIONS.ROOM_RESERVATIONS,
  rooms:            COLLECTIONS.ROOMS,
}

async function verifyAdmin(req: NextRequest): Promise<void> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('인증 필요')
  const decoded = await adminAuth().verifyIdToken(token)
  const userDoc = await adminDb().collection(COLLECTIONS.USERS).doc(decoded.uid).get()
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') throw new Error('권한 없음')
}

/** Firestore는 컬렉션 전체 삭제 API가 없으므로 400건씩 배치 삭제 */
async function deleteCollection(name: string): Promise<number> {
  const db = adminDb()
  let total = 0
  while (true) {
    const snap = await db.collection(name).limit(400).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    total += snap.size
    if (snap.size < 400) break
  }
  return total
}

/**
 * CASCADE 1: interviews 삭제 후 roomReservations 정리
 * interviewId가 있는 예약을 reserved 상태로 초기화 (dead reference 방지)
 */
async function cleanOrphanedReservations(): Promise<void> {
  const db = adminDb()
  while (true) {
    // interviewId가 빈 문자열보다 크면 = 실제 ID가 설정된 것
    const snap = await db.collection(COLLECTIONS.ROOM_RESERVATIONS)
      .where('interviewId', '>', '').limit(400).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach((d) =>
      batch.update(d.ref, { interviewId: null, status: 'reserved', updatedAt: FieldValue.serverTimestamp() }),
    )
    await batch.commit()
    if (snap.size < 400) break
  }
}

/**
 * CASCADE 2: roomReservations 삭제 후 interviews 정리
 * pending_candidate 상태의 인터뷰를 ready_to_schedule로 되돌림 (candidateOptions 참조 제거)
 */
async function revertPendingInterviews(): Promise<void> {
  const db = adminDb()
  const snap = await db.collection(COLLECTIONS.INTERVIEWS)
    .where('status', '==', 'pending_candidate').get()
  if (snap.empty) return
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch()
    snap.docs.slice(i, i + 400).forEach((d) =>
      batch.update(d.ref, {
        status: 'ready_to_schedule',
        candidateOptions: null,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    )
    await batch.commit()
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const body = (await req.json()) as { collections?: CollectionKey[] }
  const keys = body.collections
  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: '초기화할 컬렉션을 선택하세요.' }, { status: 400 })
  }
  const invalid = keys.filter((k) => !(k in ALLOWED))
  if (invalid.length > 0) {
    return NextResponse.json({ error: `허용되지 않은 컬렉션: ${invalid.join(', ')}` }, { status: 400 })
  }

  try {
    const results: Record<string, number> = {}
    for (const key of keys) {
      results[key] = await deleteCollection(ALLOWED[key])
    }

    const keySet = new Set(keys)

    // CASCADE 1: interviews 삭제했는데 roomReservations는 안 삭제 → 예약 정리
    if (keySet.has('interviews') && !keySet.has('roomReservations')) {
      await cleanOrphanedReservations()
    }
    // CASCADE 2: roomReservations 삭제했는데 interviews는 안 삭제 → pending 인터뷰 되돌리기
    if (keySet.has('roomReservations') && !keySet.has('interviews')) {
      await revertPendingInterviews()
    }

    return NextResponse.json({ ok: true, results })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
