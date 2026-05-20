// 리마인드 메시지 템플릿 조회 및 저장 유스케이스

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsRepository } from '@/infrastructure/firebase/SettingsRepository'

export const DEFAULT_REMINDER_MESSAGE =
  '{후보자명} ({포지션명}) 인터뷰 일정을 선택해 주시면 감사 드리겠습니다~'

const REMINDER_TEMPLATE_KEY = ['settings', 'reminder-template']

export function useReminderTemplate() {
  return useQuery({
    queryKey: REMINDER_TEMPLATE_KEY,
    queryFn: async () => {
      const tpl = await settingsRepository.getReminderTemplate()
      return tpl ?? { message: DEFAULT_REMINDER_MESSAGE, updatedAt: new Date() }
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useSaveReminderTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message: string) => settingsRepository.saveReminderTemplate({ message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: REMINDER_TEMPLATE_KEY }),
  })
}
