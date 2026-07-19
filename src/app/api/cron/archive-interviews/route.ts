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
  let deletedArchives = 0
  const errors: string[] = []

  for (const interviewDoc of interviewsSnap.docs) {
    const interview = interviewDoc.data()
    const confirmedSlot = interview.confirmedSlot as { date?: string } | null | undefined
    if (!confirmedSlot?.date || !isInterviewArchiveDue(confirmedSlot.date, today)) continue

    try {
      const [reservationSnap, interviewerSnaps] = await Promise.all([
        db
          .collection(COLLECTIONS.ROOM_RESERVATIONS)
          .where('interviewId', '==', interviewDoc.id)
          .get(),
        Promise.all(
          ((interview.interviewerIds as string[] | undefined) ?? []).map((id) =>
            db.collection(COLLECTIONS.INTERVIEWERS).doc(id).get(),
          ),
        ),
      ])
      const manualInterviewerNames = ((interview.manualInterviewers as { name?: string }[] | undefined) ?? [])
        .map((interviewer) => interviewer.name ?? '')
      const interviewerNames = [
        ...interviewerSnaps
          .filter((interviewer) => interviewer.exists)
          .map((interviewer) => interviewer.data()?.name as string),
        ...manualInterviewerNames,
      ]
      const bookedByNames = reservationSnap.docs
        .map((reservation) => reservation.data().bookedByName as string | null)
        .filter((name): name is string => Boolean(name))
      const reservationSlots = reservationSnap.docs.map((reservation) => {
        const data = reservation.data()
        return {
          startTime: data.startTime as string,
          endTime: data.endTime as string,
          roomName: data.roomName as string,
        }
      })
      const summary = createInterviewArchiveSummary({
        candidateName: interview.candidateName as string,
        positionName: interview.positionName as string,
        typeLabel: interview.typeLabel as string,
        sessions: (interview.sessions as { rounds: string[] }[]) ?? [],
        interviewerNames,
        bookedByNames,
        confirmedSlot: interview.confirmedSlot as {
          date: string
          slots: { startTime: string; endTime: string; roomName: string }[]
        },
      })
      if (reservationSlots.length > 0) summary.scheduledSlots = reservationSlots

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

  while (true) {
    const expiredArchiveSnap = await db
      .collection(COLLECTIONS.INTERVIEW_ARCHIVES)
      .where('deleteAfter', '<=', today)
      .limit(400)
      .get()
    if (expiredArchiveSnap.empty) break
    const batch = db.batch()
    expiredArchiveSnap.docs.forEach((archiveDoc) => batch.delete(archiveDoc.ref))
    await batch.commit()
    deletedArchives += expiredArchiveSnap.size
    if (expiredArchiveSnap.size < 400) break
  }

  return NextResponse.json({ ok: true, archived, deletedArchives, errors })
}
