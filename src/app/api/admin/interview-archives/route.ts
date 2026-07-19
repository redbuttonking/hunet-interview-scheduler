// 관리자만 개인정보 없는 인터뷰 보관 이력을 조회하는 API
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

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 })
  }

  const archivesSnap = await adminDb()
    .collection(COLLECTIONS.INTERVIEW_ARCHIVES)
    .orderBy('archivedAt', 'desc')
    .limit(100)
    .get()

  const archives = archivesSnap.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      interviewDate: data.interviewDate as string,
      positionName: data.positionName as string,
      typeLabel: data.typeLabel as string,
      sessionCount: data.sessionCount as number,
      roomNames: (data.roomNames as string[]) ?? [],
      archivedAt: (data.archivedAt as { toDate?: () => Date } | undefined)?.toDate?.().toISOString() ?? null,
    }
  })

  return NextResponse.json({ archives })
}
