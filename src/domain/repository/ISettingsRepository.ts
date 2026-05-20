import { SlackTemplate, ReminderTemplate } from '../model/Settings'

/** 앱 전역 설정 저장소 인터페이스 */
export interface ISettingsRepository {
  getSlackTemplate(): Promise<SlackTemplate | null>
  saveSlackTemplate(input: Pick<SlackTemplate, 'header' | 'footer'>): Promise<void>
  getReminderTemplate(): Promise<ReminderTemplate | null>
  saveReminderTemplate(input: Pick<ReminderTemplate, 'message'>): Promise<void>
}
