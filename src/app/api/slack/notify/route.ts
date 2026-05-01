import { WebClient } from '@slack/web-api'
import { NextRequest, NextResponse } from 'next/server'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

export async function POST(req: NextRequest) {
  const { slackIds, message } = (await req.json()) as {
    slackIds: string[]
    message: string
  }

  if (!slackIds?.length || !message) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const errors: string[] = []
  for (const id of slackIds) {
    try {
      await slack.chat.postMessage({ channel: id, text: message })
    } catch {
      errors.push(id)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, failed: errors }, { status: 207 })
  }
  return NextResponse.json({ ok: true })
}
