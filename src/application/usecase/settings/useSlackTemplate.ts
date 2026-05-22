// 슬랙 메시지 템플릿 조회 및 저장 유스케이스

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsRepository } from '@/infrastructure/firebase/SettingsRepository'

export const DEFAULT_TEMPLATE = {
  message:
    '안녕하세요!\n{포지션} ({후보자명}) {유형} 인터뷰 일정 조율로 연락 드립니다~\n\n아래 버튼을 눌러 가능하신 시간대를 선택해 주시면 감사 드리겠습니다 ^^',
}

const SLACK_TEMPLATE_KEY = ['settings', 'slack-template']

export function useSlackTemplate() {
  return useQuery({
    queryKey: SLACK_TEMPLATE_KEY,
    queryFn: async () => {
      const tpl = await settingsRepository.getSlackTemplate()
      return tpl ?? DEFAULT_TEMPLATE
    },
    staleTime: 1000 * 60 * 10, // 10분간 캐시 유지
  })
}

export function useSaveSlackTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { message: string }) =>
      settingsRepository.saveSlackTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: SLACK_TEMPLATE_KEY }),
  })
}
