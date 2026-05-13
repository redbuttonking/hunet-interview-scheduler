import { NextRequest, NextResponse } from 'next/server'
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

async function deleteCollection(name: string): Promise<number> {
  const db = adminDb()
  let total = 0
  // Firestore는 컬렉션 전체 삭제를 지원하지 않으므로 400건씩 배치 삭제
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
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
