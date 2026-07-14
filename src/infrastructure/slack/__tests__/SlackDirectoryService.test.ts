// Slack 목록 조회 서비스의 응답 정리 규칙을 검증하는 테스트
import { describe, expect, it } from 'vitest'
import { formatSlackChannel, formatSlackUser } from '../SlackDirectoryService'

describe('SlackDirectoryService', () => {
  it('채널 조회 응답에서 필요한 필드만 정리한다.', () => {
    const channel = formatSlackChannel({
      id: 'G123',
      name: 'recruit-private',
      is_private: true,
      is_member: true,
      num_members: 12,
    })

    expect(channel).toEqual({
      id: 'G123',
      name: 'recruit-private',
      isPrivate: true,
      isMember: true,
      numMembers: 12,
    })
  })

  it('삭제된 사용자와 봇 사용자는 제외한다.', () => {
    expect(formatSlackUser({ id: 'U1', deleted: true })).toBeNull()
    expect(formatSlackUser({ id: 'U2', is_bot: true })).toBeNull()
    expect(formatSlackUser({ id: 'U3', is_app_user: true })).toBeNull()
  })

  it('사용자 조회 응답에서 이름과 이메일을 정리한다.', () => {
    const user = formatSlackUser({
      id: 'U123',
      name: 'hong',
      real_name: '홍길동',
      profile: {
        display_name: '길동',
        real_name: '홍길동',
        email: 'hong@example.com',
      },
    })

    expect(user).toEqual({
      id: 'U123',
      name: 'hong',
      realName: '홍길동',
      displayName: '길동',
      email: 'hong@example.com',
      isRestricted: false,
      isUltraRestricted: false,
    })
  })
})
