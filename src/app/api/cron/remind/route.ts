// 미제출 면접관 리마인드 Cron — 슬랙 발송 다음 평일 오전 9시(KST) 1회 실행
import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { FieldValue } from 'firebase-admin/firestore'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

const DEFAULT_REMINDER_MESSAGE =
  '{후보자명} ({포지션명}) 인터뷰 일정을 선택해 주시면 감사 드리겠습니다~'

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

  // 리마인드 템플릿 조회
  const templateSnap = await db.collection(COLLECTIONS.SETTINGS).doc('reminder-template').get()
  const rawMessage = (templateSnap.data()?.message as string | undefined) ?? DEFAULT_REMINDER_MESSAGE

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

    const message = rawMessage
      .replace('{후보자명}', interview.candidateName as string)
      .replace('{포지션명}', interview.positionName as string)

    const sendMode = interview.slackSendMode as 'channel' | 'dm' | undefined
    const slackTargetIds = (interview.slackTargetIds as string[] | undefined) ?? []

    // 미제출 면접관 Slack ID 조회
    const interviewerSnaps = await Promise.all(
      missingIds.map((id) => db.collection(COLLECTIONS.INTERVIEWERS).doc(id).get()),
    )
    const missingSlackIds = interviewerSnaps
      .filter((s) => s.exists && s.data()?.slackId)
      .map((s) => s.data()!.slackId as string)
    if (missingSlackIds.length === 0) continue

    try {
      if (sendMode === 'dm') {
        const targetSlackIds = slackTargetIds.length > 0
          ? missingSlackIds.filter((id) => slackTargetIds.includes(id))
          : missingSlackIds
        if (targetSlackIds.length === 0) continue

        await Promise.all(
          targetSlackIds.map((slackId) =>
            slack.chat.postMessage({
              channel: slackId,
              text: message,
            }),
          ),
        )
      } else {
        const positionSnap = await db.collection(COLLECTIONS.POSITIONS).doc(interview.positionId).get()
        const fallbackChannelId = positionSnap.data()?.slackChannelId as string | undefined
        const slackChannelId = slackTargetIds[0] ?? fallbackChannelId
        if (!slackChannelId) continue

        const mentions = missingSlackIds.map((id) => `<@${id}>`).join(' ')
        await slack.chat.postMessage({
          channel: slackChannelId,
          text: `${mentions}\n${message}`,
        })
      }

      await doc.ref.update({ reminderSentAt: FieldValue.serverTimestamp() })
      reminded++
    } catch (e) {
      console.error(`[cron/remind] 발송 실패 [${doc.id}]:`, (e as Error).message)
      errors.push(doc.id)
    }
  }

  return NextResponse.json({ ok: true, reminded, errors })
}
