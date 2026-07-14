// Slack 사용자 목록을 조회하는 API 라우트
import { NextRequest, NextResponse } from 'next/server'
import { verifySlackDirectoryAccess } from '../_lib/auth'
import { getSlackApiErrorMessage, getSlackApiErrorStatus } from '@/infrastructure/slack/SlackApiError'
import { SlackDirectoryService } from '@/infrastructure/slack/SlackDirectoryService'

export async function GET(req: NextRequest) {
  try {
    await verifySlackDirectoryAccess(req)
    const users = await new SlackDirectoryService().listUsers()
    return NextResponse.json({ users })
  } catch (e) {
    const message = getSlackApiErrorMessage(e)
    const status = message.includes('인증') || message.includes('목록을 조회할 권한') ? 401 : getSlackApiErrorStatus(e)
    return NextResponse.json({ error: message }, { status })
  }
}
