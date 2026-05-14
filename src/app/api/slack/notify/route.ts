// 슬랙 메시지 발송 API — Block Kit 버튼 메시지 전송
import { WebClient } from '@slack/web-api'
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/infrastructure/firebase/adminConfig'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

async function verifyAuth(req: NextRequest): Promise<void> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('인증 필요')
  await adminAuth().verifyIdToken(token)
}

export async function POST(req: NextRequest) {
  try {
    await verifyAuth(req)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const { slackIds, message, interviewId, dates, candidateName, positionName } = (await req.json()) as {
    slackIds: string[]
    message: string
    interviewId?: string
    dates?: string[]
    candidateName?: string
    positionName?: string
  }

  if (!slackIds?.length || !message) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  // 인터랙티브 버튼 포함 여부 (interviewId와 dates가 있을 때만)
  const useInteractive = !!(interviewId && dates?.length && candidateName && positionName)

  const errors: string[] = []
  for (const id of slackIds) {
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
    return NextResponse.json({ ok: false, failed: errors }, { status: 207 })
  }
  return NextResponse.json({ ok: true })
}
