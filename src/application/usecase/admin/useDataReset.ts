// 데이터 초기화 유스케이스 훅 (관리자 전용)
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getIdToken } from 'firebase/auth'
import { auth } from '@/infrastructure/firebase/config'

export type ResetCollectionKey = 'interviews' | 'interviewers' | 'positions' | 'roomReservations' | 'rooms'

/** 선택한 컬렉션의 모든 문서를 서버에서 일괄 삭제한다 */
export function useResetData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (collections: ResetCollectionKey[]) => {
      if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
      const token = await getIdToken(auth.currentUser)
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ collections }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? '초기화에 실패했습니다.')
      }
      return res.json() as Promise<{ ok: boolean; results: Record<string, number> }>
    },
    onSuccess: () => {
      // 초기화 후 모든 캐시 무효화
      qc.invalidateQueries()
    },
  })
}
