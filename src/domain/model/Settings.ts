/** 슬랙 메시지 템플릿 설정 */
export interface SlackTemplate {
  header: string
  footer: string
  updatedAt: Date
}

/** 리마인드 메시지 템플릿 설정 */
export interface ReminderTemplate {
  message: string
  updatedAt: Date
}
