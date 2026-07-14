// Slack API 오류 메시지 변환 규칙을 검증하는 테스트
import { describe, expect, it } from 'vitest'
import { getSlackApiErrorMessage, getSlackApiErrorStatus } from '../SlackApiError'

describe('getSlackApiErrorMessage', () => {
  it('로컬 네트워크 권한 오류를 안내 문구로 변환한다.', () => {
    expect(getSlackApiErrorMessage({
      code: 'slack_webapi_request_error',
      original: { code: 'EACCES' },
    })).toBe('Slack API에 연결하지 못했습니다. 로컬 서버의 외부 네트워크 권한을 확인해주세요.')
  })

  it('Slack 권한 부족 오류를 안내 문구로 변환한다.', () => {
    expect(getSlackApiErrorMessage({
      code: 'slack_webapi_platform_error',
      data: {
        error: 'missing_scope',
        needed: 'channels:read,groups:read',
        provided: 'chat:write',
      },
    })).toBe('Slack 앱 권한이 부족합니다. 필요 권한: channels:read,groups:read. 현재 권한: chat:write.')
  })

  it('Slack API 권한 오류는 403으로 변환한다.', () => {
    expect(getSlackApiErrorStatus({
      code: 'slack_webapi_platform_error',
      data: { error: 'missing_scope' },
    })).toBe(403)
  })
})
