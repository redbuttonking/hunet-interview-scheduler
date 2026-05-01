import { InterviewerAvailability } from '../model/Interview'
import { RoomReservation } from '../model/Room'

export interface RecommendedScheduleSlot {
  startTime: string
  endTime: string
  roomId: string
  roomName: string
  reservationId: string
}

export interface RecommendedSchedule {
  date: string
  slots: RecommendedScheduleSlot[]
}

interface InternalSlot extends RecommendedScheduleSlot {
  date: string
}

const INTERVIEW_DURATION = 60

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function overlapsLunch(startTime: string, endTime: string): boolean {
  return toMinutes(startTime) < 13 * 60 && toMinutes(endTime) > 12 * 60
}

function isAllAvailable(
  availabilities: InterviewerAvailability[],
  date: string,
  startTime: string,
  endTime: string,
): boolean {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  return availabilities.every((avail) => {
    if (avail.allAvailable) return true
    return avail.slots.some(
      (s) => s.date === date && toMinutes(s.startTime) <= start && toMinutes(s.endTime) >= end,
    )
  })
}

function findChains(
  sessionSpecs: { interviewerIds: string[] }[],
  availabilities: InterviewerAvailability[],
  date: string,
  dateSlots: InternalSlot[],
  specIdx: number,
  chain: InternalSlot[],
  results: RecommendedSchedule[],
) {
  if (specIdx === sessionSpecs.length) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    results.push({ date, slots: chain.map(({ date: _d, ...rest }) => rest) })
    return
  }

  const spec = sessionSpecs[specIdx]
  const prevEndTime = chain.length > 0 ? chain[chain.length - 1].endTime : null
  const sessionAvails = availabilities.filter((a) => spec.interviewerIds.includes(a.interviewerId))

  for (const slot of dateSlots) {
    if (prevEndTime !== null && slot.startTime !== prevEndTime) continue
    if (chain.some((s) => s.startTime === slot.startTime)) continue
    if (overlapsLunch(slot.startTime, slot.endTime)) continue
    if (!isAllAvailable(sessionAvails, date, slot.startTime, slot.endTime)) continue

    findChains(sessionSpecs, availabilities, date, dateSlots, specIdx + 1, [...chain, slot], results)
  }
}

/**
 * N개 세션의 면접 일정 추천
 * - 각 세션은 1시간, 세션들은 연속 진행 (다른 회의실 가능)
 * - sessionSpecs[i].interviewerIds = 세션 i에 필요한 면접관 ID 목록
 */
export function recommendSchedules(
  sessionSpecs: { interviewerIds: string[] }[],
  availabilities: InterviewerAvailability[],
  reservations: RoomReservation[],
): RecommendedSchedule[] {
  if (sessionSpecs.length === 0) return []

  const candidates = reservations.filter((r) => r.status === 'reserved' && r.interviewId === null)

  const allSlots: InternalSlot[] = []
  for (const res of candidates) {
    const resStart = toMinutes(res.startTime)
    const resEnd = toMinutes(res.endTime)
    for (let s = resStart; s + INTERVIEW_DURATION <= resEnd; s += INTERVIEW_DURATION) {
      allSlots.push({
        date: res.date,
        startTime: toTime(s),
        endTime: toTime(s + INTERVIEW_DURATION),
        roomId: res.roomId,
        roomName: res.roomName,
        reservationId: res.id,
      })
    }
  }

  const byDate: Record<string, InternalSlot[]> = {}
  for (const slot of allSlots) {
    if (!byDate[slot.date]) byDate[slot.date] = []
    byDate[slot.date].push(slot)
  }

  const results: RecommendedSchedule[] = []
  for (const [date, dateSlots] of Object.entries(byDate)) {
    dateSlots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    findChains(sessionSpecs, availabilities, date, dateSlots, 0, [], results)
  }

  return results
}
