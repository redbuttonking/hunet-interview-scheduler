import { NextResponse } from 'next/server'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/infrastructure/firebase/config'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { Round, ALL_ROUNDS, InterviewType } from '@/domain/model/Position'

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

async function migratePositions(): Promise<{ migrated: number; skipped: number }> {
  const snap = await getDocs(collection(db, COLLECTIONS.POSITIONS))
  let migrated = 0
  let skipped = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data()

    // 이미 새 형식이면 skip
    if (Array.isArray(data.interviewTypes)) { skipped++; continue }

    const rounds: Round[] = (data.rounds as Round[]) ?? []
    const oneDayInterview: boolean = data.oneDayInterview ?? false

    // 차수별 개별 유형 생성
    const interviewTypes: InterviewType[] = ALL_ROUNDS
      .filter((r) => rounds.includes(r))
      .map((r) => ({ label: `${r} 면접`, sessions: [{ rounds: [r] }] }))

    // 원데이 유형 추가 (1차+2차 포함 시)
    if (oneDayInterview && rounds.includes('1차') && rounds.includes('2차')) {
      interviewTypes.push({
        label: '원데이 (1차→2차)',
        sessions: [{ rounds: ['1차'] }, { rounds: ['2차'] }],
      })
    }

    await updateDoc(doc(db, COLLECTIONS.POSITIONS, docSnap.id), {
      interviewTypes,
      // 구 필드 제거는 FieldValue.delete()가 필요하지만 단순 덮어쓰기로도 동작함
    })
    migrated++
  }

  return { migrated, skipped }
}

async function migrateInterviews(): Promise<{ migrated: number; skipped: number }> {
  const snap = await getDocs(collection(db, COLLECTIONS.INTERVIEWS))
  let migrated = 0
  let skipped = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data()

    // 이미 새 형식이면 skip
    if (typeof data.typeLabel === 'string' && Array.isArray(data.sessions)) { skipped++; continue }

    const scheduleType: string = data.scheduleType ?? '1차'
    const interviewerIds: string[] = data.interviewerIds ?? []

    let typeLabel: string
    let sessions: { rounds: Round[] }[]

    switch (scheduleType) {
      case '1차':
        typeLabel = '1차 면접'
        sessions = [{ rounds: ['1차'] }]
        break
      case '2차':
        typeLabel = '2차 면접'
        sessions = [{ rounds: ['2차'] }]
        break
      case '3차':
        typeLabel = '3차 면접'
        sessions = [{ rounds: ['3차'] }]
        break
      case 'oneday':
        typeLabel = '원데이 (1차→2차)'
        sessions = [{ rounds: ['1차'] }, { rounds: ['2차'] }]
        break
      default:
        typeLabel = `${scheduleType} 면접`
        sessions = [{ rounds: [scheduleType as Round] }]
    }

    // confirmedSlot 마이그레이션
    let confirmedSlot = data.confirmedSlot ?? null
    if (confirmedSlot && !Array.isArray(confirmedSlot.slots)) {
      const oldSlot = confirmedSlot as {
        date: string; startTime: string; endTime: string
        roomId: string; roomName: string
        secondRoomId?: string; secondRoomName?: string
      }

      if (scheduleType === 'oneday') {
        const midTime = addMinutes(oldSlot.startTime, 60)
        confirmedSlot = {
          date: oldSlot.date,
          startTime: oldSlot.startTime,
          endTime: oldSlot.endTime,
          slots: [
            { startTime: oldSlot.startTime, endTime: midTime, roomId: oldSlot.roomId, roomName: oldSlot.roomName },
            {
              startTime: midTime, endTime: oldSlot.endTime,
              roomId: oldSlot.secondRoomId ?? oldSlot.roomId,
              roomName: oldSlot.secondRoomName ?? oldSlot.roomName,
            },
          ],
        }
      } else {
        confirmedSlot = {
          date: oldSlot.date,
          startTime: oldSlot.startTime,
          endTime: oldSlot.endTime,
          slots: [{ startTime: oldSlot.startTime, endTime: oldSlot.endTime, roomId: oldSlot.roomId, roomName: oldSlot.roomName }],
        }
      }
    }

    await updateDoc(doc(db, COLLECTIONS.INTERVIEWS, docSnap.id), {
      typeLabel,
      sessions,
      interviewerIds,
      interviewersByRound: data.interviewersByRound ?? {},
      confirmedSlot,
    })
    migrated++
  }

  return { migrated, skipped }
}

export async function POST() {
  try {
    const [positions, interviews] = await Promise.all([
      migratePositions(),
      migrateInterviews(),
    ])
    return NextResponse.json({ ok: true, positions, interviews })
  } catch (err) {
    console.error('Migration error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
