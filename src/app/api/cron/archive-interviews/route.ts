// 확정 인터뷰를 개인정보 없는 보관 이력으로 전환하는 일일 Cron API
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { isInterviewArchiveDue, createInterviewArchiveSummary } from '@/domain/service/interviewArchive'
import { adminDb } from '@/infrastructure/firebase/adminConfig'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'

/** KST 기준 오늘 날짜를 YYYY-MM-DD로 반환한다. */
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const db = adminDb()
  const today = todayKST()
  const interviewsSnap = await db
    .collection(COLLECTIONS.INTERVIEWS)
    .where('status', '==', 'confirmed')
    .get()

  let archived = 0
  const errors: string[] = []

  for (const interviewDoc of interviewsSnap.docs) {
    const interview = interviewDoc.data()
    const confirmedSlot = interview.confirmedSlot as { date?: string } | null | undefined
    if (!confirmedSlot?.date || !isInterviewArchiveDue(confirmedSlot.date, today)) continue

    try {
      const summary = createInterviewArchiveSummary({
        positionName: interview.positionName as string,
        typeLabel: interview.typeLabel as string,
        sessions: (interview.sessions as { rounds: string[] }[]) ?? [],
        confirmedSlot: interview.confirmedSlot as {
          date: string
          slots: { roomName: string }[]
        },
      })
      const reservationSnap = await db
        .collection(COLLECTIONS.ROOM_RESERVATIONS)
        .where('interviewId', '==', interviewDoc.id)
        .get()

      const batch = db.batch()
      batch.set(db.collection(COLLECTIONS.INTERVIEW_ARCHIVES).doc(interviewDoc.id), {
        ...summary,
        archivedAt: FieldValue.serverTimestamp(),
      })
      reservationSnap.docs.forEach((reservationDoc) => batch.delete(reservationDoc.ref))
      batch.delete(interviewDoc.ref)
      await batch.commit()
      archived++
    } catch (error) {
      console.error(`[cron/archive-interviews] 보관 실패 [${interviewDoc.id}]:`, (error as Error).message)
      errors.push(interviewDoc.id)
    }
  }

  return NextResponse.json({ ok: true, archived, errors })
}
