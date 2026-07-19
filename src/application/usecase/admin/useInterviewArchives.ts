// 관리자용 개인정보 없는 인터뷰 보관 이력 조회 훅
import { useQuery } from '@tanstack/react-query'
import { getIdToken } from 'firebase/auth'
import { auth } from '@/infrastructure/firebase/config'

export interface InterviewArchive {
  id: string
  interviewDate: string
  deleteAfter: string
  candidateName: string
  positionName: string
  typeLabel: string
  sessionCount: number
  scheduledSlots: { startTime: string; endTime: string; roomName: string }[]
  interviewerNames: string[]
  bookedByNames: string[]
  archivedAt: string | null
}

export function useInterviewArchives() {
  return useQuery({
    queryKey: ['interview-archives'],
    queryFn: async () => {
      if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
      const token = await getIdToken(auth.currentUser)
      const response = await fetch('/api/admin/interview-archives', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? '보관 이력을 불러오지 못했습니다.')
      }
      return (await response.json() as { archives: InterviewArchive[] }).archives
    },
  })
}
