// 확정 인터뷰 보관 시점과 개인정보 제외 규칙을 검증한다.
import { describe, expect, it } from 'vitest'
import { createInterviewArchiveSummary, isInterviewArchiveDue } from '../interviewArchive'

describe('isInterviewArchiveDue', () => {
  it('인터뷰일 7일이 지난 다음 날부터 보관 처리한다', () => {
    expect(isInterviewArchiveDue('2026-07-23', '2026-07-30')).toBe(false)
    expect(isInterviewArchiveDue('2026-07-23', '2026-07-31')).toBe(true)
  })
})

describe('createInterviewArchiveSummary', () => {
  it('후보자와 면접관 정보 없이 운영 이력만 구성한다', () => {
    const summary = createInterviewArchiveSummary({
      positionName: '프론트엔드 개발',
      typeLabel: '원데이 인터뷰',
      sessions: [{ rounds: ['1차'] }, { rounds: ['2차'] }],
      confirmedSlot: {
        date: '2026-07-23',
        slots: [{ roomName: '[818호] 행복룸' }, { roomName: '[818호] 행복룸' }],
      },
    })

    expect(summary).toEqual({
      interviewDate: '2026-07-23',
      positionName: '프론트엔드 개발',
      typeLabel: '원데이 인터뷰',
      sessionCount: 2,
      roomNames: ['[818호] 행복룸'],
    })
    expect(summary).not.toHaveProperty('candidateName')
    expect(summary).not.toHaveProperty('interviewerIds')
  })
})
