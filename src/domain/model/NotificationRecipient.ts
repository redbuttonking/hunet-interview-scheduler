/** 일정 수집 완료 시 슬랙 DM 알림을 받는 채용 담당자 */
export interface NotificationRecipient {
  id: string
  name: string
  /** 슬랙 멤버 ID (@없이 저장, 예: U12345678) */
  slackId: string
  createdAt: Date
}
