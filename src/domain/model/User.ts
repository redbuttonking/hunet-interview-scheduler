/** 사용자 역할 */
export type UserRole = 'admin' | 'recruiter'

/** 시스템 사용자 (채용 담당자 또는 관리자) */
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}
