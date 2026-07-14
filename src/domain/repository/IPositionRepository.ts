import { Position, InterviewType, Round } from '../model/Position'

export interface CreatePositionInput {
  name: string
  interviewTypes: InterviewType[]
  interviewersByRound: Partial<Record<Round, string[]>>
  slackChannelId?: string
  slackChannelName?: string
}

export interface UpdatePositionInput {
  name?: string
  interviewTypes?: InterviewType[]
  interviewersByRound?: Partial<Record<Round, string[]>>
  slackChannelId?: string
  slackChannelName?: string
}

export interface IPositionRepository {
  findAll(): Promise<Position[]>
  create(input: CreatePositionInput): Promise<Position>
  update(id: string, input: UpdatePositionInput): Promise<Position>
  delete(id: string): Promise<void>
}
