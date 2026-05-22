// Firestore 기반 설정 저장소 구현체

import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { SlackTemplate, ReminderTemplate } from '@/domain/model/Settings'
import { ISettingsRepository } from '@/domain/repository/ISettingsRepository'

const SLACK_TEMPLATE_DOC = 'slack-template'
const REMINDER_TEMPLATE_DOC = 'reminder-template'

class SettingsFirestoreRepository implements ISettingsRepository {
  async getSlackTemplate(): Promise<SlackTemplate | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, SLACK_TEMPLATE_DOC))
    if (!snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    // message 필드가 없으면 기존 header 필드로 하위 호환 처리
    const message = (data.message ?? data.header ?? '') as string
    return {
      message,
      updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
    }
  }

  async saveSlackTemplate(input: Pick<SlackTemplate, 'message'>): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, SLACK_TEMPLATE_DOC), {
      ...input,
      updatedAt: serverTimestamp(),
    })
  }

  async getReminderTemplate(): Promise<ReminderTemplate | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, REMINDER_TEMPLATE_DOC))
    if (!snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    return {
      message: data.message as string,
      updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
    }
  }

  async saveReminderTemplate(input: Pick<ReminderTemplate, 'message'>): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, REMINDER_TEMPLATE_DOC), {
      ...input,
      updatedAt: serverTimestamp(),
    })
  }
}

export const settingsRepository = new SettingsFirestoreRepository()
