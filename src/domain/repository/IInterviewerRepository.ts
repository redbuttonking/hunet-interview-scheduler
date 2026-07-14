import { Interviewer } from '../model/Interviewer'

export interface CreateInterviewerInput {
  name: string
  slackId: string
  email?: string
}

export interface UpdateInterviewerInput {
  name?: string
  slackId?: string
  email?: string
}

export interface IInterviewerRepository {
  findAll(): Promise<Interviewer[]>
  create(input: CreateInterviewerInput): Promise<Interviewer>
  update(id: string, input: UpdateInterviewerInput): Promise<Interviewer>
  delete(id: string): Promise<void>
}
