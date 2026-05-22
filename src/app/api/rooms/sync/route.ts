// 크롬 확장 프로그램에서 호출하는 회의실 예약 동기화 엔드포인트
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { FieldValue } from 'firebase-admin/firestore'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function verifyApiKey(req: NextRequest): void {
  const key = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!key || key !== process.env.ROOM_SYNC_API_KEY) throw new Error('인증 실패')
}

// "[818호] 열정룸" → "열정룸" 형태로 접두사 제거
function stripRoomPrefix(name: string): string {
  return name.replace(/^\[.*?\]\s*/, '').trim()
}

async function findOrCreateRoom(name: string): Promise<{ id: string; name: string }> {
  // 1. 정확한 이름으로 검색
  const exactSnap = await adminDb().collection(COLLECTIONS.ROOMS).where('name', '==', name).get()
  if (!exactSnap.empty) return { id: exactSnap.docs[0].id, name }

  // 2. 접두사 제거 후 기존 회의실과 매칭 (예: "[818호] 열정룸" → "열정룸")
  const baseName = stripRoomPrefix(name)
  if (baseName && baseName !== name) {
    const allSnap = await adminDb().collection(COLLECTIONS.ROOMS).get()
    const matched = allSnap.docs.find((d) => {
      const existing = (d.data().name as string) || ''
      return existing === baseName || stripRoomPrefix(existing) === baseName
    })
    if (matched) {
      // 기존 회의실 이름을 다우오피스 형식으로 업데이트
      await adminDb().collection(COLLECTIONS.ROOMS).doc(matched.id).update({ name })
      return { id: matched.id, name }
    }
  }

  // 3. 없으면 신규 생성
  const allSnap = await adminDb().collection(COLLECTIONS.ROOMS).get()
  const maxOrder = allSnap.docs.reduce((max, d) => {
    const o = d.data().order
    return typeof o === 'number' ? Math.max(max, o) : max
  }, -1)

  const ref = await adminDb().collection(COLLECTIONS.ROOMS).add({
    name,
    order: maxOrder + 1,
    createdAt: FieldValue.serverTimestamp(),
  })
  return { id: ref.id, name }
}

async function findByExternalId(externalId: number) {
  const snap = await adminDb()
    .collection(COLLECTIONS.ROOM_RESERVATIONS)
    .where('externalId', '==', externalId)
    .get()
  if (snap.empty) return null
  return snap.docs[0]
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    verifyApiKey(req)
  } catch {
    return json({ error: '인증 실패' }, 401)
  }

  const body = (await req.json()) as {
    action: 'create' | 'update' | 'cancel'
    externalId: number
    roomName: string
    date?: string
    startTime?: string
    endTime?: string
  }

  if (!body.action || !body.externalId) {
    return json({ error: '필수 값 누락' }, 400)
  }

  try {
    if (body.action === 'cancel') {
      const existing = await findByExternalId(body.externalId)
      if (existing) {
        await adminDb().collection(COLLECTIONS.ROOM_RESERVATIONS).doc(existing.id).delete()
      }
      return json({ ok: true })
    }

    if (!body.date || !body.startTime || !body.endTime) {
      return NextResponse.json({ error: '날짜/시간 값 누락' }, { status: 400 })
    }

    const room = await findOrCreateRoom(body.roomName)
    const existing = await findByExternalId(body.externalId)

    if (existing) {
      await adminDb()
        .collection(COLLECTIONS.ROOM_RESERVATIONS)
        .doc(existing.id)
        .update({
          roomId: room.id,
          roomName: room.name,
          date: body.date,
          startTime: body.startTime,
          endTime: body.endTime,
          updatedAt: FieldValue.serverTimestamp(),
        })
    } else {
      await adminDb().collection(COLLECTIONS.ROOM_RESERVATIONS).add({
        roomId: room.id,
        roomName: room.name,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        status: 'reserved',
        interviewId: null,
        externalId: body.externalId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}
