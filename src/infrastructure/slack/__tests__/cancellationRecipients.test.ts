// 인터뷰 취소 알림 대상에 담당자와 시스템 사용자를 포함하는지 검증한다.
import { describe, expect, it } from 'vitest'
import { resolveCancellationRecipients } from '../cancellationRecipients'

describe('resolveCancellationRecipients', () => {
  it('면접관, 알림 담당자, 관리자와 채용담당자를 중복 없이 합친다', () => {
    const result = resolveCancellationRecipients({
      interviewerSlackIds: ['U_INTERVIEWER', 'U_SHARED'],
      notificationSlackIds: ['U_RECIPIENT', 'U_SHARED'],
      systemUsers: [
        { name: '관리자', email: 'admin@hunet.co.kr', role: 'admin' },
        { name: '채용담당자', email: 'recruiter@hunet.co.kr', role: 'recruiter' },
        { name: '뷰어', email: 'viewer@hunet.co.kr', role: 'viewer' },
      ],
      slackUsers: [
        { id: 'U_ADMIN', email: 'admin@hunet.co.kr' },
        { id: 'U_RECRUITER', email: 'recruiter@hunet.co.kr' },
        { id: 'U_VIEWER', email: 'viewer@hunet.co.kr' },
      ],
    })

    expect(result.slackIds).toEqual(['U_INTERVIEWER', 'U_SHARED', 'U_RECIPIENT', 'U_ADMIN', 'U_RECRUITER'])
    expect(result.unmatchedSystemUserNames).toEqual([])
  })

  it('Slack 이메일과 일치하지 않는 시스템 사용자를 반환한다', () => {
    const result = resolveCancellationRecipients({
      interviewerSlackIds: [],
      notificationSlackIds: [],
      systemUsers: [{ name: '관리자', email: 'admin@hunet.co.kr', role: 'admin' }],
      slackUsers: [],
    })

    expect(result.slackIds).toEqual([])
    expect(result.unmatchedSystemUserNames).toEqual(['관리자'])
  })
})
