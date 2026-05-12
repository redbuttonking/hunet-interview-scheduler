import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'

async function verifyAdmin(req: NextRequest): Promise<void> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('인증 필요')
  const decoded = await adminAuth().verifyIdToken(token)
  const userDoc = await adminDb().collection(COLLECTIONS.USERS).doc(decoded.uid).get()
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') throw new Error('권한 없음')
}

export async function DELETE(req: NextRequest) {
  try {
    await verifyAdmin(req)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const { userId } = (await req.json()) as { userId: string }
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  try {
    await adminAuth().deleteUser(userId)
    await adminDb().collection(COLLECTIONS.USERS).doc(userId).delete()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
