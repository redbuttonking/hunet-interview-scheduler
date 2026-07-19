// 확정 인터뷰 보관 시점과 개인정보 제외 규칙을 검증한다.
import { describe, expect, it } from 'vitest'
import { createInterviewArchiveSummary, getInterviewArchiveDeleteDate, isInterviewArchiveDue } from '../interviewArchive'

describe('isInterviewArchiveDue', () => {
  it('인터뷰일 7일이 지난 다음 날부터 보관 처리한다', () => {
    expect(isInterviewArchiveDue('2026-07-23', '2026-07-30')).toBe(false)
    expect(isInterviewArchiveDue('2026-07-23', '2026-07-31')).toBe(true)
  })
})

describe('getInterviewArchiveDeleteDate', () => {
  it('인터뷰일을 기준으로 3개월 뒤 삭제일을 계산한다', () => {
    expect(getInterviewArchiveDeleteDate('2026-07-23')).toBe('2026-10-23')
    expect(getInterviewArchiveDeleteDate('2026-01-31')).toBe('2026-04-30')
  })
})

describe('createInterviewArchiveSummary', () => {
  it('후보자명과 운영 이력만 구성하고 면접관 정보는 제외한다', () => {
    const summary = createInterviewArchiveSummary({
      candidateName: '홍길동',
      positionName: '프론트엔드 개발',
      typeLabel: '원데이 인터뷰',
      sessions: [{ rounds: ['1차'] }, { rounds: ['2차'] }],
      interviewerNames: ['김면접', '이인터뷰'],
      bookedByNames: ['박채용'],
      confirmedSlot: {
        date: '2026-07-23',
        slots: [
          { startTime: '10:00', endTime: '11:00', roomName: '[818호] 행복룸' },
          { startTime: '11:00', endTime: '12:00', roomName: '[818호] 행복룸' },
        ],
      },
    })

    expect(summary).toEqual({
      interviewDate: '2026-07-23',
      deleteAfter: '2026-10-23',
      candidateName: '홍길동',
      positionName: '프론트엔드 개발',
      typeLabel: '원데이 인터뷰',
      sessionCount: 2,
      scheduledSlots: [
        { startTime: '10:00', endTime: '11:00', roomName: '[818호] 행복룸' },
        { startTime: '11:00', endTime: '12:00', roomName: '[818호] 행복룸' },
      ],
      interviewerNames: ['김면접', '이인터뷰'],
      bookedByNames: ['박채용'],
    })
    expect(summary).not.toHaveProperty('interviewerIds')
  })
})
