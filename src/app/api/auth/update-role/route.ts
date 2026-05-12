import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { UserRole } from '@/domain/model/User'

async function verifyAdmin(req: NextRequest): Promise<void> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('인증 필요')
  const decoded = await adminAuth().verifyIdToken(token)
  const userDoc = await adminDb().collection(COLLECTIONS.USERS).doc(decoded.uid).get()
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') throw new Error('권한 없음')
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const { userId, role } = (await req.json()) as { userId: string; role: UserRole }
  if (!userId || !role) return NextResponse.json({ error: 'userId, role 필요' }, { status: 400 })

  try {
    await adminDb().collection(COLLECTIONS.USERS).doc(userId).update({ role, updatedAt: new Date() })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
