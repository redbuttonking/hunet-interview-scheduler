// 인터뷰 확정 Slack 안내 메시지 포맷을 검증하는 테스트
import { describe, expect, it } from 'vitest'
import type { Interview } from '@/domain/model/Interview'
import {
  buildChannelChangeMessage,
  buildChannelConfirmMessage,
  buildDmChangeMessage,
  buildDmConfirmMessage,
} from '../confirmSlackMessage'

function makeInterview(): Interview {
  return {
    id: 'interview-1',
    candidateName: '홍길동',
    positionId: 'position-1',
    positionName: '프론트엔드 개발자',
    typeLabel: '원데이 인터뷰',
    sessions: [{ rounds: ['1차', '2차'] }, { rounds: ['3차'] }],
    interviewerIds: ['iv-1', 'iv-2'],
    interviewersByRound: {
      '1차': ['iv-1'],
      '2차': ['iv-1'],
      '3차': ['iv-2'],
    },
    status: 'confirmed',
    availabilityPeriod: { startDate: '2026-07-23', endDate: '2026-07-23' },
    availabilities: [],
    candidateOptions: null,
    confirmedSlot: {
      date: '2026-07-23',
      startTime: '10:00',
      endTime: '12:00',
      slots: [
        { startTime: '10:00', endTime: '11:00', roomId: 'room-1', roomName: '행복룸' },
        { startTime: '11:00', endTime: '12:00', roomId: 'room-2', roomName: '성장룸' },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('confirmSlackMessage', () => {
  it('채널 안내에는 전체 원데이 일정과 묶음 차수를 표시한다', () => {
    const message = buildChannelConfirmMessage(makeInterview())

    expect(message).toContain('홍길동님(프론트엔드 개발자) 원데이 인터뷰 일정이 확정되었습니다.')
    expect(message).toContain('2026-07-23(목) 10:00 ~ 11:00 · 행복룸 · 1차+2차 인터뷰')
    expect(message).toContain('2026-07-23(목) 11:00 ~ 12:00 · 성장룸 · 3차 인터뷰')
    expect(message).toContain('일정 조정이 필요하시다면 담당자에게 문의 주시기 바랍니다.')
  })

  it('DM 안내에는 내 담당 일정만 표시한다', () => {
    const message = buildDmConfirmMessage(makeInterview(), 'iv-1')

    expect(message).toContain('내 담당 일정:')
    expect(message).toContain('2026-07-23(목) 10:00 ~ 11:00 · 행복룸 · 1차+2차 인터뷰')
    expect(message).not.toContain('전체 일정:')
    expect(message).not.toContain('2026-07-23(목) 11:00 ~ 12:00 · 성장룸 · 3차 인터뷰')
  })

  it('일정 변경 안내에는 변경 전후 원데이 일정을 구분해 표시한다', () => {
    const previous = makeInterview()
    const updated: Interview = {
      ...previous,
      confirmedSlot: {
        date: '2026-07-24',
        startTime: '14:00',
        endTime: '16:00',
        slots: [
          { startTime: '14:00', endTime: '15:00', roomId: 'room-3', roomName: '성장룸' },
          { startTime: '15:00', endTime: '16:00', roomId: 'room-4', roomName: '행복룸' },
        ],
      },
    }

    const channelMessage = buildChannelChangeMessage(previous, updated)
    const dmMessage = buildDmChangeMessage(previous, updated, 'iv-1')

    expect(channelMessage).toContain('[인터뷰 일정 변경 안내]')
    expect(channelMessage).toContain('변경 전:')
    expect(channelMessage).toContain('2026-07-23(목) 10:00 ~ 11:00 · 행복룸 · 1차+2차 인터뷰')
    expect(channelMessage).toContain('변경 후:')
    expect(channelMessage).toContain('2026-07-24(금) 14:00 ~ 15:00 · 성장룸 · 1차+2차 인터뷰')
    expect(dmMessage).toContain('내 담당 일정 변경:')
    expect(dmMessage).not.toContain('전체 일정 변경:')
    expect(dmMessage).not.toContain('2026-07-23(목) 11:00 ~ 12:00 · 성장룸 · 3차 인터뷰')
    expect(dmMessage).not.toContain('2026-07-24(금) 15:00 ~ 16:00 · 행복룸 · 3차 인터뷰')
  })
})
