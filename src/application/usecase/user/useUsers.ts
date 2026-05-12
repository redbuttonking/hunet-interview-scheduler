// 사용자 계정 관리 유스케이스 훅 (관리자 전용)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getIdToken, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/infrastructure/firebase/config'
import { userRepository } from '@/infrastructure/firebase/UserRepository'
import { UserRole } from '@/domain/model/User'

export const USERS_KEY = ['users']

async function getBearerToken(): Promise<string> {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
  return getIdToken(auth.currentUser)
}

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => userRepository.findAll(),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; name: string; role: UserRole }) => {
      const token = await getBearerToken()
      const res = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '계정 생성에 실패했습니다.')
      }
      await sendPasswordResetEmail(auth, input.email)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const token = await getBearerToken()
      const res = await fetch('/api/auth/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '계정 삭제에 실패했습니다.')
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const token = await getBearerToken()
      const res = await fetch('/api/auth/update-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '역할 변경에 실패했습니다.')
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}
