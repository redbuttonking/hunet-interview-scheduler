import { describe, it, expect } from 'vitest'
import {
  findConflictingInterviewerIds,
  recommendFixedSchedules,
  recommendSchedules,
} from '../ScheduleRecommendService'
import type { Interview, InterviewerAvailability } from '../../model/Interview'
import type { RoomReservation } from '../../model/Room'

// 테스트용 회의실 예약 생성 헬퍼
function makeReservation(overrides: Partial<RoomReservation> = {}): RoomReservation {
  return {
    id: 'res-1',
    roomId: 'room-1',
    roomName: '행복룸',
    date: '2026-05-19',
    startTime: '09:00',
    endTime: '18:00',
    status: 'reserved',
    interviewId: null,
    bookedByUserId: null,
    bookedByName: null,
    memo: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// 테스트용 면접관 가용 일정 생성 헬퍼
function makeAvailability(
  interviewerId: string,
  slots: { date: string; startTime: string; endTime: string }[],
): InterviewerAvailability {
  return { interviewerId, allAvailable: false, slots }
}

function makeAllAvailable(interviewerId: string): InterviewerAvailability {
  return { interviewerId, allAvailable: true, slots: [] }
}

describe('recommendSchedules', () => {
  describe('기본 동작', () => {
    it('세션 스펙이 없으면 빈 배열을 반환한다', () => {
      const result = recommendSchedules([], [], [makeReservation()])
      expect(result).toEqual([])
    })

    it('예약된 회의실이 없으면 빈 배열을 반환한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAllAvailable('iv-1')],
        [],
      )
      expect(result).toEqual([])
    })

    it('이미 면접이 배정된 예약(interviewId != null)은 후보에서 제외한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAllAvailable('iv-1')],
        [makeReservation({ interviewId: 'some-interview' })],
      )
      expect(result).toEqual([])
    })

    it('status가 reserved가 아닌 예약은 후보에서 제외한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAllAvailable('iv-1')],
        [makeReservation({ status: 'confirmed' as 'reserved' })],
      )
      expect(result).toEqual([])
    })
  })

  describe('단일 세션 추천', () => {
    it('면접관이 전 시간 가능이면 회의실 예약 시간 내 모든 슬롯을 추천한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAllAvailable('iv-1')],
        [makeReservation({ startTime: '09:00', endTime: '11:00' })],
      )
      expect(result).toHaveLength(2)
      expect(result[0].slots[0].startTime).toBe('09:00')
      expect(result[0].slots[0].endTime).toBe('10:00')
      expect(result[1].slots[0].startTime).toBe('10:00')
      expect(result[1].slots[0].endTime).toBe('11:00')
    })

    it('면접관 가용 시간과 회의실 예약 시간의 교집합만 추천한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAvailability('iv-1', [{ date: '2026-05-19', startTime: '10:00', endTime: '11:00' }])],
        [makeReservation({ startTime: '09:00', endTime: '12:00' })],
      )
      expect(result).toHaveLength(1)
      expect(result[0].slots[0].startTime).toBe('10:00')
    })

    it('면접관이 가능하지 않은 시간대는 추천하지 않는다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAvailability('iv-1', [{ date: '2026-05-19', startTime: '14:00', endTime: '15:00' }])],
        [makeReservation({ startTime: '09:00', endTime: '12:00' })],
      )
      expect(result).toHaveLength(0)
    })
  })

  describe('점심시간 제외', () => {
    it('12:00~13:00에 걸치는 슬롯은 추천하지 않는다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAllAvailable('iv-1')],
        [makeReservation({ startTime: '11:00', endTime: '14:00' })],
      )
      const startTimes = result.map((r) => r.slots[0].startTime)
      // 12:00~13:00 슬롯은 제외, 11:00~12:00과 13:00~14:00만 추천
      expect(startTimes).not.toContain('12:00')
      expect(startTimes).toContain('11:00')
      expect(startTimes).toContain('13:00')
    })
  })

  describe('복수 면접관', () => {
    it('면접관 전원이 가능한 시간대만 추천한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1', 'iv-2'] }],
        [
          makeAvailability('iv-1', [{ date: '2026-05-19', startTime: '09:00', endTime: '11:00' }]),
          makeAvailability('iv-2', [{ date: '2026-05-19', startTime: '10:00', endTime: '12:00' }]),
        ],
        [makeReservation({ startTime: '09:00', endTime: '12:00' })],
      )
      // 교집합: 10:00~11:00
      expect(result).toHaveLength(1)
      expect(result[0].slots[0].startTime).toBe('10:00')
    })

    it('면접관 중 한 명이라도 불가능하면 해당 슬롯은 제외한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1', 'iv-2'] }],
        [
          makeAllAvailable('iv-1'),
          makeAvailability('iv-2', []), // iv-2는 가능한 시간 없음
        ],
        [makeReservation({ startTime: '09:00', endTime: '11:00' })],
      )
      expect(result).toHaveLength(0)
    })
  })

  describe('원데이 인터뷰 (연속 세션)', () => {
    it('2개 세션이 연속으로 이어지는 경우만 추천한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }, { interviewerIds: ['iv-2'] }],
        [makeAllAvailable('iv-1'), makeAllAvailable('iv-2')],
        [makeReservation({ startTime: '09:00', endTime: '11:00' })],
      )
      // 09:00~10:00 + 10:00~11:00 연속 조합만 가능
      expect(result).toHaveLength(1)
      expect(result[0].slots[0].startTime).toBe('09:00')
      expect(result[0].slots[1].startTime).toBe('10:00')
    })

    it('세션별 담당 면접관의 가능 시간을 따로 계산한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }, { interviewerIds: ['iv-2'] }],
        [
          makeAvailability('iv-1', [{ date: '2026-05-19', startTime: '09:00', endTime: '10:00' }]),
          makeAvailability('iv-2', [{ date: '2026-05-19', startTime: '10:00', endTime: '11:00' }]),
        ],
        [makeReservation({ startTime: '09:00', endTime: '11:00' })],
      )

      expect(result).toHaveLength(1)
      expect(result[0].slots[0].startTime).toBe('09:00')
      expect(result[0].slots[1].startTime).toBe('10:00')
    })

    it('연속 세션이 점심시간에 걸치면 추천하지 않는다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }, { interviewerIds: ['iv-2'] }],
        [makeAllAvailable('iv-1'), makeAllAvailable('iv-2')],
        [makeReservation({ startTime: '11:00', endTime: '14:00' })],
      )
      const chainStartTimes = result.map((r) => r.slots[0].startTime)
      // 11:00~12:00 + 12:00~13:00 연속은 점심 걸쳐서 제외
      // 13:00~14:00은 단독 1시간 슬롯이라 세션 2개 연속 불가
      expect(chainStartTimes).not.toContain('11:00')
    })
  })

  describe('복수 날짜', () => {
    it('여러 날짜에 걸쳐 각각 추천 결과를 반환한다', () => {
      const result = recommendSchedules(
        [{ interviewerIds: ['iv-1'] }],
        [makeAllAvailable('iv-1')],
        [
          makeReservation({ id: 'res-1', date: '2026-05-19', startTime: '10:00', endTime: '11:00' }),
          makeReservation({ id: 'res-2', date: '2026-05-20', startTime: '14:00', endTime: '15:00' }),
        ],
      )
      const dates = result.map((r) => r.date)
      expect(dates).toContain('2026-05-19')
      expect(dates).toContain('2026-05-20')
    })
  })
})

describe('recommendFixedSchedules', () => {
  it('입력한 시작 시간에 맞는 예약된 회의실 조합만 반환한다', () => {
    const result = recommendFixedSchedules(2, '2026-05-19', '10:00', [
      makeReservation({ id: 'res-1', startTime: '09:00', endTime: '12:00' }),
      makeReservation({ id: 'res-2', roomId: 'room-2', roomName: '성장룸', startTime: '11:00', endTime: '12:00' }),
    ])

    expect(result).toHaveLength(2)
    expect(result[0].slots.map((slot) => slot.startTime)).toEqual(['10:00', '11:00'])
    expect(result[0].slots[0].reservationId).toBe('res-1')
  })

  it('조율 중 또는 확정된 회의실은 후보에서 제외한다', () => {
    const result = recommendFixedSchedules(1, '2026-05-19', '10:00', [
      makeReservation({ status: 'coordinating' }),
      makeReservation({ id: 'res-2', status: 'confirmed' }),
    ])

    expect(result).toEqual([])
  })
})

describe('findConflictingInterviewerIds', () => {
  const confirmedInterview: Interview = {
    id: 'confirmed-1',
    candidateName: '기존 후보자',
    positionId: 'position-1',
    positionName: '개발자',
    typeLabel: '1차 인터뷰',
    sessions: [{ rounds: ['1차'] }],
    interviewerIds: ['iv-1', 'iv-2'],
    interviewersByRound: { '1차': ['iv-1', 'iv-2'] },
    status: 'confirmed',
    availabilityPeriod: null,
    availabilities: [],
    candidateOptions: null,
    confirmedSlot: {
      date: '2026-05-19',
      startTime: '10:00',
      endTime: '11:00',
      slots: [{ startTime: '10:00', endTime: '11:00', roomId: 'room-1', roomName: '행복룸' }],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('같은 날짜와 시간에 겹치는 면접관만 반환한다', () => {
    const result = findConflictingInterviewerIds(
      ['iv-1', 'iv-3'],
      '2026-05-19',
      '10:30',
      '11:30',
      [confirmedInterview],
    )

    expect(result).toEqual(['iv-1'])
  })

  it('날짜 또는 시간이 겹치지 않으면 충돌이 없다', () => {
    const result = findConflictingInterviewerIds(
      ['iv-1'],
      '2026-05-20',
      '10:00',
      '11:00',
      [confirmedInterview],
    )

    expect(result).toEqual([])
  })

  it('후보자 응답 대기 중인 조율 일정도 충돌로 처리한다', () => {
    const pendingCandidateInterview: Interview = {
      ...confirmedInterview,
      id: 'pending-candidate-1',
      status: 'pending_candidate',
      confirmedSlot: null,
      candidateOptions: [{
        date: '2026-05-19',
        slots: [{
          reservationId: 'res-2',
          startTime: '10:00',
          endTime: '11:00',
          roomId: 'room-2',
          roomName: '성장룸',
        }],
      }],
    }

    const result = findConflictingInterviewerIds(
      ['iv-2'],
      '2026-05-19',
      '10:00',
      '11:00',
      [pendingCandidateInterview],
    )

    expect(result).toEqual(['iv-2'])
  })
})
