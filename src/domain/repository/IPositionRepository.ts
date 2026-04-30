import { Position } from '../model/Position'
import { Round } from '../model/Position'

export interface CreatePositionInput {
  name: string
  rounds: Round[]
  oneDayInterview: boolean
  interviewersByRound: Partial<Record<Round, string[]>>
}

export interface UpdatePositionInput {
  name?: string
  rounds?: Round[]
  oneDayInterview?: boolean
  interviewersByRound?: Partial<Record<Round, string[]>>
}

export interface IPositionRepository {
  findAll(): Promise<Position[]>
  create(input: CreatePositionInput): Promise<Position>
  update(id: string, input: UpdatePositionInput): Promise<Position>
  delete(id: string): Promise<void>
}
