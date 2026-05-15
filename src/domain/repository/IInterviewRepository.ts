import { Interview, InterviewStatus, InterviewerAvailability, CandidateOption } from '../model/Interview'
import { Round } from '../model/Position'

export interface CreateInterviewInput {
  candidateName: string
  positionId: string
  positionName: string
  typeLabel: string
  sessions: { rounds: Round[] }[]
  interviewerIds: string[]
  interviewersByRound: Partial<Record<Round, string[]>>
  availabilityPeriod: { startDate: string; endDate: string }
}

export interface UpdateInterviewInput {
  candidateName?: string
  positionId?: string
  positionName?: string
  typeLabel?: string
  sessions?: { rounds: Round[] }[]
  status?: InterviewStatus
  interviewerIds?: string[]
  interviewersByRound?: Partial<Record<Round, string[]>>
  availabilityPeriod?: { startDate: string; endDate: string } | null
  availabilities?: InterviewerAvailability[]
  confirmedSlot?: Interview['confirmedSlot']
  candidateOptions?: CandidateOption[] | null
}

export interface IInterviewRepository {
  findAll(): Promise<Interview[]>
  findById(id: string): Promise<Interview | null>
  create(input: CreateInterviewInput): Promise<Interview>
  update(id: string, input: UpdateInterviewInput): Promise<void>
  delete(id: string): Promise<void>
  /** 가용 일정을 트랜잭션으로 추가 — 동시 제출 시 데이터 유실 방지 */
  addAvailability(
    interviewId: string,
    availability: InterviewerAvailability,
    interviewerIds: string[],
  ): Promise<void>
  /** 실시간 구독 — 데이터 변경 시 콜백 호출, 반환값은 구독 해제 함수 */
  subscribe(callback: (interviews: Interview[]) => void): () => void
}
