import { Interview, InterviewStatus, InterviewerAvailability } from '../model/Interview'
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
  status?: InterviewStatus
  interviewerIds?: string[]
  availabilities?: InterviewerAvailability[]
  confirmedSlot?: Interview['confirmedSlot']
}

export interface IInterviewRepository {
  findAll(): Promise<Interview[]>
  findById(id: string): Promise<Interview | null>
  create(input: CreateInterviewInput): Promise<Interview>
  update(id: string, input: UpdateInterviewInput): Promise<void>
  delete(id: string): Promise<void>
}
