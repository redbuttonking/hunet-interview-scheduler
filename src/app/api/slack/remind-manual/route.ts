// 특정 면접관에게 리마인드 메시지를 기존 조율 발송 방식에 맞춰 수동 발송
import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { adminAuth, adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

const DEFAULT_REMINDER_MESSAGE =
  '{후보자명} ({포지션명}) 인터뷰 일정을 선택해 주시면 감사 드리겠습니다~'

async function verifyAuth(req: NextRequest): Promise<void> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('인증 필요')
  await adminAuth().verifyIdToken(token)
}

export async function POST(req: NextRequest) {
  try {
    await verifyAuth(req)
  } catch {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const { interviewId, interviewerId } = (await req.json()) as {
    interviewId: string
    interviewerId: string
  }

  if (!interviewId || !interviewerId) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const db = adminDb()

  // 인터뷰, 면접관, 포지션, 리마인드 템플릿 병렬 조회
  const [interviewSnap, interviewerSnap, templateSnap] = await Promise.all([
    db.collection(COLLECTIONS.INTERVIEWS).doc(interviewId).get(),
    db.collection(COLLECTIONS.INTERVIEWERS).doc(interviewerId).get(),
    db.collection(COLLECTIONS.SETTINGS).doc('reminder-template').get(),
  ])

  if (!interviewSnap.exists) {
    return NextResponse.json({ error: '인터뷰를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!interviewerSnap.exists) {
    return NextResponse.json({ error: '면접관을 찾을 수 없습니다.' }, { status: 404 })
  }

  const interview = interviewSnap.data()!
  const interviewer = interviewerSnap.data()!
  const slackId = interviewer.slackId as string | undefined

  if (!slackId) {
    return NextResponse.json({ error: '면접관의 슬랙 ID가 없습니다.' }, { status: 400 })
  }

  const rawMessage = (templateSnap.data()?.message as string | undefined) ?? DEFAULT_REMINDER_MESSAGE
  const message = rawMessage
    .replace('{후보자명}', interview.candidateName as string)
    .replace('{포지션명}', interview.positionName as string)

  const sendMode = interview.slackSendMode as 'channel' | 'dm' | undefined

  if (sendMode === 'dm') {
    await slack.chat.postMessage({
      channel: slackId,
      text: message,
    })
  } else {
    const slackTargetIds = (interview.slackTargetIds as string[] | undefined) ?? []
    const positionSnap = await db.collection(COLLECTIONS.POSITIONS).doc(interview.positionId).get()
    const fallbackChannelId = positionSnap.data()?.slackChannelId as string | undefined
    const slackChannelId = slackTargetIds[0] ?? fallbackChannelId

    if (!slackChannelId) {
      return NextResponse.json({ error: '포지션에 슬랙 채널이 설정되어 있지 않습니다.' }, { status: 400 })
    }

    await slack.chat.postMessage({
      channel: slackChannelId,
      text: `<@${slackId}>\n${message}`,
    })
  }

  return NextResponse.json({ ok: true })
}
