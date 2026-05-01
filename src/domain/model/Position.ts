/** 채용 절차 차수 */
export type Round = '1차' | '2차' | '3차'

export const ALL_ROUNDS: Round[] = ['1차', '2차', '3차']

/** 하나의 면접 세션 — 1시간 블록, 동시 진행할 차수 묶음 */
export interface InterviewSession {
  rounds: Round[]
}

/** 면접 유형 — 포지션에서 선택 가능한 면접 구성 */
export interface InterviewType {
  label: string
  sessions: InterviewSession[]
}

/** 포지션 — 면접 유형 구성과 차수별 면접관을 관리 */
export interface Position {
  id: string
  name: string
  interviewTypes: InterviewType[]
  interviewersByRound: Partial<Record<Round, string[]>>
  createdAt: Date
  updatedAt: Date
}
