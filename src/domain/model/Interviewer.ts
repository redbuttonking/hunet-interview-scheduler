/** 면접관 — 이름과 슬랙 ID를 보유하는 명부 엔티티 */
export interface Interviewer {
  id: string
  name: string
  /** 슬랙 멤버 ID (@없이 저장, 예: U12345678) */
  slackId: string
  createdAt: Date
  updatedAt: Date
}
