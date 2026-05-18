import { NotificationRecipient } from '../model/NotificationRecipient'

export interface CreateNotificationRecipientInput {
  name: string
  slackId: string
}

export interface INotificationRecipientRepository {
  findAll(): Promise<NotificationRecipient[]>
  create(input: CreateNotificationRecipientInput): Promise<NotificationRecipient>
  delete(id: string): Promise<void>
}
