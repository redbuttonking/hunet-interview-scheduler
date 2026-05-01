import { Interview, InterviewStatus, InterviewerAvailability } from '../model/Interview'
import { ScheduleType } from '../model/Interview'

/** 면접 생성 입력 */
export interface CreateInterviewInput {
  candidateName: string
  positionId: string
  positionName: string
  scheduleType: ScheduleType
  interviewerIds: string[]
  availabilityPeriod: {
    startDate: string
    endDate: string
  }
}

/** 면접 수정 입력 */
export interface UpdateInterviewInput {
  status?: InterviewStatus
  interviewerIds?: string[]
  availabilities?: InterviewerAvailability[]
  confirmedSlot?: Interview['confirmedSlot']
}

/** 면접 조율 리포지토리 인터페이스 */
export interface IInterviewRepository {
  findAll(): Promise<Interview[]>
  findById(id: string): Promise<Interview | null>
  create(input: CreateInterviewInput): Promise<Interview>
  update(id: string, input: UpdateInterviewInput): Promise<Interview>
  delete(id: string): Promise<void>
}
