import {
  collection, getDocs, addDoc, deleteDoc,
  doc, getDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { NotificationRecipient } from '@/domain/model/NotificationRecipient'
import {
  INotificationRecipientRepository,
  CreateNotificationRecipientInput,
} from '@/domain/repository/INotificationRecipientRepository'

function toNotificationRecipient(id: string, data: Record<string, unknown>): NotificationRecipient {
  return {
    id,
    name: data.name as string,
    slackId: data.slackId as string,
    createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
  }
}

class NotificationRecipientFirestoreRepository implements INotificationRecipientRepository {
  private col = collection(db, COLLECTIONS.NOTIFICATION_RECIPIENTS)

  async findAll(): Promise<NotificationRecipient[]> {
    const snap = await getDocs(query(this.col, orderBy('createdAt', 'asc')))
    return snap.docs.map((d) => toNotificationRecipient(d.id, d.data()))
  }

  async create(input: CreateNotificationRecipientInput): Promise<NotificationRecipient> {
    const ref = await addDoc(this.col, {
      ...input,
      createdAt: serverTimestamp(),
    })
    const snap = await getDoc(ref)
    return toNotificationRecipient(snap.id, snap.data() as Record<string, unknown>)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.NOTIFICATION_RECIPIENTS, id))
  }
}

export const notificationRecipientRepository = new NotificationRecipientFirestoreRepository()
