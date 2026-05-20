// 미제출 면접관 리마인드 Cron — 평일 오전 9시(KST) 자동 실행
import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import Holidays from 'date-holidays'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

/** KST 기준으로 오늘이 주말 또는 한국 공휴일인지 확인 */
function isTodayOffDay(): boolean {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const day = kstNow.getUTCDay()
  if (day === 0 || day === 6) return true
  const hd = new Holidays('KR')
  return !!hd.isHoliday(kstNow)
}

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  if (isTodayOffDay()) {
    return NextResponse.json({ ok: true, skipped: '공휴일 또는 주말' })
  }

  const db = adminDb()
  const interviewsSnap = await db
    .collection(COLLECTIONS.INTERVIEWS)
    .where('status', '==', 'collecting')
    .get()

  if (interviewsSnap.empty) {
    return NextResponse.json({ ok: true, reminded: 0 })
  }

  let reminded = 0
  const errors: string[] = []

  for (const doc of interviewsSnap.docs) {
    const interview = doc.data()

    // 미제출 면접관 계산
    const allIds = interview.interviewerIds as string[]
    const submittedIds = new Set(
      (interview.availabilities ?? []).map((a: { interviewerId: string }) => a.interviewerId),
    )
    const missingIds = allIds.filter((id) => !submittedIds.has(id))
    if (missingIds.length === 0) continue

    // 포지션의 슬랙 채널 조회
    const positionSnap = await db.collection(COLLECTIONS.POSITIONS).doc(interview.positionId).get()
    const slackChannelId = positionSnap.data()?.slackChannelId as string | undefined
    if (!slackChannelId) continue

    // 미제출 면접관 @멘션 문자열 생성
    const interviewerSnaps = await Promise.all(
      missingIds.map((id) => db.collection(COLLECTIONS.INTERVIEWERS).doc(id).get()),
    )
    const mentions = interviewerSnaps
      .filter((s) => s.exists && s.data()?.slackId)
      .map((s) => `<@${s.data()!.slackId as string}>`)
      .join(' ')
    if (!mentions) continue

    try {
      await slack.chat.postMessage({
        channel: slackChannelId,
        text: `${mentions} *${interview.candidateName as string}* (${interview.positionName as string}) 인터뷰 가용 일정을 아직 입력하지 않으셨습니다. 슬랙 DM을 확인해 주세요.`,
      })
      reminded++
    } catch (e) {
      console.error(`[cron/remind] 발송 실패 [${doc.id}]:`, (e as Error).message)
      errors.push(doc.id)
    }
  }

  return NextResponse.json({ ok: true, reminded, errors })
}
