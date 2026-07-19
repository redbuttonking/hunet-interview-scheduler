// 슬랙 메시지 발송 API — Block Kit 버튼 메시지 전송
import { WebClient } from '@slack/web-api'
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { SlackDirectoryService } from '@/infrastructure/slack/SlackDirectoryService'
import { resolveCancellationRecipients } from '@/infrastructure/slack/cancellationRecipients'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

async function verifyAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('인증 필요')
  return adminAuth().verifyIdToken(token)
}

export async function POST(req: NextRequest) {
  let decoded: { uid: string }
  try {
    decoded = await verifyAuth(req)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const { slackIds, message, interviewId, dates, candidateName, positionName, includeCancellationRecipients } = (await req.json()) as {
    slackIds: string[]
    message: string
    interviewId?: string
    dates?: string[]
    candidateName?: string
    positionName?: string
    includeCancellationRecipients?: boolean
  }

  if (!message) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  let targetSlackIds = slackIds ?? []
  let unmatchedSystemUserNames: string[] = []
  if (includeCancellationRecipients) {
    const db = adminDb()
    const requester = await db.collection(COLLECTIONS.USERS).doc(decoded.uid).get()
    const requesterRole = requester.data()?.role
    if (!requester.exists || (requesterRole !== 'admin' && requesterRole !== 'recruiter')) {
      return NextResponse.json({ error: '취소 알림 수신자 추가 권한이 없습니다.' }, { status: 403 })
    }

    const [recipientsSnap, usersSnap, slackUsers] = await Promise.all([
      db.collection(COLLECTIONS.NOTIFICATION_RECIPIENTS).get(),
      db.collection(COLLECTIONS.USERS).get(),
      new SlackDirectoryService().listUsers(),
    ])
    const resolved = resolveCancellationRecipients({
      interviewerSlackIds: targetSlackIds,
      notificationSlackIds: recipientsSnap.docs.map((doc) => doc.data().slackId as string),
      systemUsers: usersSnap.docs.map((doc) => {
        const user = doc.data()
        return { name: user.name as string, email: user.email as string, role: user.role as 'admin' | 'recruiter' | 'viewer' }
      }),
      slackUsers,
    })
    targetSlackIds = resolved.slackIds
    unmatchedSystemUserNames = resolved.unmatchedSystemUserNames
  }

  if (!targetSlackIds.length) {
    return NextResponse.json({ ok: true, failed: [], unmatchedSystemUserNames })
  }

  // 인터랙티브 버튼 포함 여부 (interviewId와 dates가 있을 때만)
  const useInteractive = !!(interviewId && dates?.length && candidateName && positionName)

  const errors: string[] = []
  for (const id of targetSlackIds) {
    try {
      if (useInteractive) {
        await slack.chat.postMessage({
          channel: id,
          text: message,
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: message },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '📅 일정 선택하기' },
                  style: 'primary',
                  action_id: 'open_availability',
                  value: JSON.stringify({ interviewId, dates, candidateName, positionName }),
                },
              ],
            },
          ],
        })
      } else {
        await slack.chat.postMessage({ channel: id, text: message })
      }
    } catch (e) {
      console.error(`슬랙 발송 실패 [${id}]:`, (e as Error).message)
      errors.push(id)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, failed: errors, unmatchedSystemUserNames }, { status: 207 })
  }
  return NextResponse.json({ ok: true, unmatchedSystemUserNames })
}
