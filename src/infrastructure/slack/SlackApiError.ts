// Slack API 오류를 사용자에게 보여줄 메시지로 변환하는 도우미
interface SlackRequestError extends Error {
  code?: string
  original?: NodeJS.ErrnoException
  data?: {
    error?: string
    needed?: string
    provided?: string
  }
}

const SLACK_REQUEST_ERROR = 'slack_webapi_request_error'
const SLACK_PLATFORM_ERROR = 'slack_webapi_platform_error'

const PLATFORM_ERROR_MESSAGES: Record<string, string> = {
  invalid_auth: 'Slack Bot Token이 올바르지 않습니다.',
  account_inactive: 'Slack 앱 또는 워크스페이스 계정이 비활성화되어 있습니다.',
  missing_scope: 'Slack 앱 권한이 부족합니다.',
  not_authed: 'Slack 인증 정보가 전달되지 않았습니다.',
}

export function getSlackApiErrorMessage(error: unknown): string {
  const slackError = error as SlackRequestError

  if (slackError.code === SLACK_REQUEST_ERROR) {
    const networkCode = slackError.original?.code
    if (networkCode === 'EACCES') {
      return 'Slack API에 연결하지 못했습니다. 로컬 서버의 외부 네트워크 권한을 확인해주세요.'
    }
    if (networkCode) {
      return `Slack API에 연결하지 못했습니다. 네트워크 오류 코드: ${networkCode}.`
    }
    return 'Slack API에 연결하지 못했습니다. 네트워크 상태를 확인해주세요.'
  }

  if (slackError.code === SLACK_PLATFORM_ERROR) {
    const platformError = slackError.data?.error
    if (platformError) {
      const baseMessage = PLATFORM_ERROR_MESSAGES[platformError] ?? `Slack API 오류: ${platformError}.`
      if (platformError === 'missing_scope') {
        const needed = slackError.data?.needed
        const provided = slackError.data?.provided
        return [
          baseMessage,
          needed ? `필요 권한: ${needed}.` : '필요 권한: channels:read, groups:read.',
          provided ? `현재 권한: ${provided}.` : undefined,
        ].filter(Boolean).join(' ')
      }
      return baseMessage
    }
  }

  return slackError.message || 'Slack API 처리 중 오류가 발생했습니다.'
}

export function getSlackApiErrorStatus(error: unknown): number {
  const slackError = error as SlackRequestError

  if (slackError.code === SLACK_REQUEST_ERROR) return 502
  if (slackError.code === SLACK_PLATFORM_ERROR) return 403

  return 500
}
