// Slack 워크스페이스 목록 조회를 담당하는 유스케이스 훅
import { useQuery } from '@tanstack/react-query'
import { getIdToken } from 'firebase/auth'
import { auth } from '@/infrastructure/firebase/config'
import type { SlackDirectoryChannel, SlackDirectoryUser } from '@/infrastructure/slack/SlackDirectoryService'

export const SLACK_CHANNELS_KEY = ['slack', 'channels']
export const SLACK_USERS_KEY = ['slack', 'users']

async function getBearerToken(): Promise<string> {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
  return getIdToken(auth.currentUser)
}

async function fetchSlackDirectory<T>(url: string): Promise<T> {
  const token = await getBearerToken()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Slack 목록을 불러오지 못했습니다.')
  }

  return res.json() as Promise<T>
}

export function useSlackChannels(enabled = true) {
  return useQuery({
    queryKey: SLACK_CHANNELS_KEY,
    queryFn: () => fetchSlackDirectory<{ channels: SlackDirectoryChannel[] }>('/api/slack/channels'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSlackUsers(enabled = true) {
  return useQuery({
    queryKey: SLACK_USERS_KEY,
    queryFn: () => fetchSlackDirectory<{ users: SlackDirectoryUser[] }>('/api/slack/users'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
