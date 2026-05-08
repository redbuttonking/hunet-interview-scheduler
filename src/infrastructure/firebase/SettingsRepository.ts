// Firestore 기반 설정 저장소 구현체

import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { SlackTemplate } from '@/domain/model/Settings'
import { ISettingsRepository } from '@/domain/repository/ISettingsRepository'

const SLACK_TEMPLATE_DOC = 'slack-template'

class SettingsFirestoreRepository implements ISettingsRepository {
  async getSlackTemplate(): Promise<SlackTemplate | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, SLACK_TEMPLATE_DOC))
    if (!snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    return {
      header: data.header as string,
      footer: data.footer as string,
      updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
    }
  }

  async saveSlackTemplate(input: Pick<SlackTemplate, 'header' | 'footer'>): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, SLACK_TEMPLATE_DOC), {
      ...input,
      updatedAt: serverTimestamp(),
    })
  }
}

export const settingsRepository = new SettingsFirestoreRepository()
