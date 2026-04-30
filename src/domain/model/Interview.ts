import { Round } from './Position'

/** 면접 조율 상태 */
export type InterviewStatus =
  | 'pending_slack'      // 슬랙 발송 전
  | 'collecting'         // 가능 일정 수집 중
  | 'ready_to_schedule'  // 전원 입력 완료, 일정 추천 가능
  | 'confirmed'          // 확정 완료

/** 면접관 가능 일정 슬롯 */
export interface AvailabilitySlot {
  date: string        // 'YYYY-MM-DD'
  startTime: string   // 'HH:MM'
  endTime: string     // 'HH:MM'
}

/** 면접관별 가능 일정 */
export interface InterviewerAvailability {
  interviewerId: string
  /** true이면 요청 기간 전체 가능 */
  allAvailable: boolean
  slots: AvailabilitySlot[]
}

/** 채용 절차 선택값 — 원데이 인터뷰는 1차+2차를 하나의 건으로 처리 */
export type ScheduleType = Round | 'oneday'

/** 면접 조율 건 — 후보자 1명의 특정 차수 면접 조율 */
export interface Interview {
  id: string
  candidateName: string
  positionId: string
  positionName: string
  scheduleType: ScheduleType
  /** 이 건에 실제 배정된 면접관 ID 목록 (포지션 기본값에서 임시 수정 가능) */
  interviewerIds: string[]
  status: InterviewStatus
  /** 슬랙 가용성 요청 기간 */
  availabilityPeriod: {
    startDate: string  // 'YYYY-MM-DD'
    endDate: string    // 'YYYY-MM-DD'
  } | null
  /** 면접관별 가능 일정 입력 현황 */
  availabilities: InterviewerAvailability[]
  /** 확정된 면접 일시 */
  confirmedSlot: {
    date: string
    startTime: string
    endTime: string
    roomId: string
    roomName: string
  } | null
  createdAt: Date
  updatedAt: Date
}
