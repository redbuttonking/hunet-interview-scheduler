// 크롬 확장 프로그램에서 호출하는 회의실 예약 동기화 엔드포인트
import { NextRequest, NextResponse } from 'next/server'
import { parseRoomBookmarkPayload } from '@/lib/roomBookmarkPayload'
import { syncRoomReservation } from '@/infrastructure/firebase/roomReservationSync'

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

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    verifyApiKey(req)
  } catch {
    return json({ error: '인증 실패' }, 401)
  }

  const payload = parseRoomBookmarkPayload(await req.json())
  if (!payload) {
    return json({ error: '필수 값 누락' }, 400)
  }

  try {
    await syncRoomReservation(payload, { userId: null, name: '그룹웨어 확인' })
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}
