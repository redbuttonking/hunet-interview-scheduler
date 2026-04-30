/** 채용 절차 차수 */
export type Round = '1차' | '2차' | '3차'

/** 포지션 — 면접 라운드 구성과 원데이 인터뷰 여부를 관리 */
export interface Position {
  id: string
  name: string
  /** 활성화된 채용 절차 차수 목록 */
  rounds: Round[]
  /** 같은 날 1차+2차 연속 진행 여부 */
  oneDayInterview: boolean
  /** 차수별 기본 면접관 ID 목록 */
  interviewersByRound: Record<Round, string[]>
  createdAt: Date
  updatedAt: Date
}
