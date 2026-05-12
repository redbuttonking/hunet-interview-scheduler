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

export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const { email, name, role } = (await req.json()) as {
    email: string
    name: string
    role: UserRole
  }

  if (!email || !name || !role) {
    return NextResponse.json({ error: '이메일, 이름, 역할은 필수입니다.' }, { status: 400 })
  }

  try {
    const userRecord = await adminAuth().createUser({ email, displayName: name })
    await adminDb()
      .collection(COLLECTIONS.USERS)
      .doc(userRecord.uid)
      .set({ email, name, role, createdAt: new Date(), updatedAt: new Date() })
    return NextResponse.json({ uid: userRecord.uid })
  } catch (e) {
    const msg = (e as Error).message
    const isEmailTaken = msg.includes('EMAIL_EXISTS') || msg.includes('email-already-exists')
    return NextResponse.json(
      { error: isEmailTaken ? '이미 사용 중인 이메일입니다.' : '계정 생성에 실패했습니다.' },
      { status: 400 },
    )
  }
}
