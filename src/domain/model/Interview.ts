import { Round } from './Position'

export type InterviewStatus =
  | 'pending_slack'
  | 'collecting'
  | 'ready_to_schedule'
  | 'pending_candidate'
  | 'confirmed'

/** 후보자에게 제시한 일정 옵션 */
export interface CandidateOption {
  date: string
  slots: {
    reservationId: string
    startTime: string
    endTime: string
    roomId: string
    roomName: string
  }[]
}

export interface AvailabilitySlot {
  date: string
  startTime: string
  endTime: string
}

export interface InterviewerAvailability {
  interviewerId: string
  allAvailable: boolean
  slots: AvailabilitySlot[]
}

export interface Interview {
  id: string
  candidateName: string
  positionId: string
  positionName: string
  /** 면접 유형 표시명 (예: "원데이 (1차→2차)") */
  typeLabel: string
  /** 세션 구조 — 각 세션은 1시간, 동시 진행할 차수 목록 */
  sessions: { rounds: Round[] }[]
  /** 전체 면접관 ID (가용 일정 수집 대상) */
  interviewerIds: string[]
  /** 차수별 면접관 (일정 추천 시 세션별 가용성 계산에 사용) */
  interviewersByRound: Partial<Record<Round, string[]>>
  status: InterviewStatus
  availabilityPeriod: { startDate: string; endDate: string } | null
  availabilities: InterviewerAvailability[]
  /** 조율 중인 일정 옵션 목록 (pending_candidate 상태에서만 존재) */
  candidateOptions: CandidateOption[] | null
  confirmedSlot: {
    date: string
    startTime: string
    endTime: string
    slots: { startTime: string; endTime: string; roomId: string; roomName: string }[]
  } | null
  createdAt: Date
  updatedAt: Date
}
