// Slack API 조회 라우트에서 사용하는 권한 확인 도우미
import { NextRequest } from 'next/server'
import { UserRole } from '@/domain/model/User'
import { adminAuth, adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'

const ALLOWED_ROLES: UserRole[] = ['admin', 'recruiter']

export async function verifySlackDirectoryAccess(req: NextRequest): Promise<void> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('인증이 필요합니다.')

  const decoded = await adminAuth().verifyIdToken(token)
  const userDoc = await adminDb().collection(COLLECTIONS.USERS).doc(decoded.uid).get()
  const role = userDoc.data()?.role as UserRole | undefined

  if (!userDoc.exists || !role || !ALLOWED_ROLES.includes(role)) {
    throw new Error('Slack 목록을 조회할 권한이 없습니다.')
  }
}
