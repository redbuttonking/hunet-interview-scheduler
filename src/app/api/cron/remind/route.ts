// 미제출 면접관 리마인드 Cron — 슬랙 발송 다음 평일 오전 9시(KST) 1회 실행
import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { FieldValue } from 'firebase-admin/firestore'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

/** KST 기준 오늘 날짜를 YYYY-MM-DD로 반환 */
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const today = todayKST()
  const db = adminDb()

  // 오늘이 리마인드 예정일이고 아직 발송하지 않은 collecting 인터뷰 조회
  const interviewsSnap = await db
    .collection(COLLECTIONS.INTERVIEWS)
    .where('status', '==', 'collecting')
    .where('reminderScheduledFor', '==', today)
    .get()

  if (interviewsSnap.empty) {
    return NextResponse.json({ ok: true, reminded: 0 })
  }

  let reminded = 0
  const errors: string[] = []

  for (const doc of interviewsSnap.docs) {
    const interview = doc.data()

    // 이미 발송된 경우 스킵
    if (interview.reminderSentAt) continue

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
      await doc.ref.update({ reminderSentAt: FieldValue.serverTimestamp() })
      reminded++
    } catch (e) {
      console.error(`[cron/remind] 발송 실패 [${doc.id}]:`, (e as Error).message)
      errors.push(doc.id)
    }
  }

  return NextResponse.json({ ok: true, reminded, errors })
}
