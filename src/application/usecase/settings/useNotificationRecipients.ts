// 슬랙 알림 수신 담당자 관리 유스케이스 훅
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationRecipientRepository } from '@/infrastructure/firebase/NotificationRecipientRepository'
import { CreateNotificationRecipientInput } from '@/domain/repository/INotificationRecipientRepository'

export const NOTIFICATION_RECIPIENTS_KEY = ['notificationRecipients']

export function useNotificationRecipients() {
  return useQuery({
    queryKey: NOTIFICATION_RECIPIENTS_KEY,
    queryFn: () => notificationRecipientRepository.findAll(),
  })
}

export function useCreateNotificationRecipient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateNotificationRecipientInput) =>
      notificationRecipientRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATION_RECIPIENTS_KEY }),
  })
}

export function useDeleteNotificationRecipient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationRecipientRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATION_RECIPIENTS_KEY }),
  })
}
