// 로그인한 채용 담당자가 북마크 예약을 저장하는 엔드포인트
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { parseRoomBookmarkPayload } from '@/lib/roomBookmarkPayload'
import { syncRoomReservation } from '@/infrastructure/firebase/roomReservationSync'

/** 예약을 등록할 수 있는 로그인 사용자인지 확인한다 */
async function verifySchedulingUser(req: NextRequest): Promise<void> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('로그인이 필요합니다.')
  const decoded = await adminAuth().verifyIdToken(token)
  const userDoc = await adminDb().collection(COLLECTIONS.USERS).doc(decoded.uid).get()
  const role = userDoc.data()?.role
  if (!userDoc.exists || (role !== 'admin' && role !== 'recruiter')) {
    throw new Error('회의실 예약을 등록할 권한이 없습니다.')
  }
}

/** 북마크에서 감지한 회의실 예약을 저장한다 */
export async function POST(req: NextRequest) {
  try {
    await verifySchedulingUser(req)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 })
  }

  const payload = parseRoomBookmarkPayload(await req.json())
  if (!payload) return NextResponse.json({ error: '예약 정보 형식이 올바르지 않습니다.' }, { status: 400 })

  try {
    await syncRoomReservation(payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
