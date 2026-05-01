import { InterviewerAvailability } from '../model/Interview'
import { RoomReservation } from '../model/Room'

export interface RecommendedSlot {
  date: string
  startTime: string
  endTime: string
  roomId: string
  roomName: string
  reservationId: string
}

export interface OneDayRecommendedSlot {
  date: string
  firstRound: { startTime: string; endTime: string; reservationId: string }
  secondRound: { startTime: string; endTime: string; reservationId: string }
  roomId: string
  roomName: string
}

const INTERVIEW_DURATION = 60 // 면접 1회 소요 시간(분)

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
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
    return avail.slots.some((slot) => {
      if (slot.date !== date) return false
      return toMinutes(slot.startTime) <= start && toMinutes(slot.endTime) >= end
    })
  })
}

function overlapsLunch(startTime: string, endTime: string): boolean {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  return start < 13 * 60 && end > 12 * 60
}

/**
 * 일반 면접 일정 추천
 * - 회의실 예약 블록을 1시간 단위로 분할하여 가능한 슬롯 반환
 */
export function recommendSlots(
  availabilities: InterviewerAvailability[],
  reservations: RoomReservation[],
  _excludedInterviewIds: string[],
): RecommendedSlot[] {
  const results: RecommendedSlot[] = []

  const candidates = reservations.filter(
    (r) => r.status === 'reserved' && r.interviewId === null,
  )

  for (const res of candidates) {
    const resStart = toMinutes(res.startTime)
    const resEnd = toMinutes(res.endTime)

    // 예약 블록을 INTERVIEW_DURATION 단위로 분할
    for (let s = resStart; s + INTERVIEW_DURATION <= resEnd; s += INTERVIEW_DURATION) {
      const slotStart = toTime(s)
      const slotEnd = toTime(s + INTERVIEW_DURATION)

      if (overlapsLunch(slotStart, slotEnd)) continue
      if (!isAllAvailable(availabilities, res.date, slotStart, slotEnd)) continue

      results.push({
        date: res.date,
        startTime: slotStart,
        endTime: slotEnd,
        roomId: res.roomId,
        roomName: res.roomName,
        reservationId: res.id,
      })
    }
  }

  return results
}

/**
 * 원데이 인터뷰 일정 추천
 * - 단일 큰 블록에서 연속 2시간 탐색
 * - 또는 연속된 두 개의 1시간 예약 블록 탐색
 */
export function recommendOneDaySlots(
  firstRoundAvailabilities: InterviewerAvailability[],
  secondRoundAvailabilities: InterviewerAvailability[],
  reservations: RoomReservation[],
): OneDayRecommendedSlot[] {
  const results: OneDayRecommendedSlot[] = []
  const duration = INTERVIEW_DURATION

  const candidates = reservations.filter(
    (r) => r.status === 'reserved' && r.interviewId === null,
  )

  // 방법 1: 단일 블록 내 연속 2시간 탐색
  for (const res of candidates) {
    const resStart = toMinutes(res.startTime)
    const resEnd = toMinutes(res.endTime)
    if (resEnd - resStart < duration * 2) continue

    for (let s = resStart; s + duration * 2 <= resEnd; s += duration) {
      const firstStart = toTime(s)
      const firstEnd = toTime(s + duration)
      const secondStart = firstEnd
      const secondEnd = toTime(s + duration * 2)

      if (overlapsLunch(firstStart, firstEnd) || overlapsLunch(secondStart, secondEnd)) continue
      if (!isAllAvailable(firstRoundAvailabilities, res.date, firstStart, firstEnd)) continue
      if (!isAllAvailable(secondRoundAvailabilities, res.date, secondStart, secondEnd)) continue

      results.push({
        date: res.date,
        firstRound: { startTime: firstStart, endTime: firstEnd, reservationId: res.id },
        secondRound: { startTime: secondStart, endTime: secondEnd, reservationId: res.id },
        roomId: res.roomId,
        roomName: res.roomName,
      })
    }
  }

  // 방법 2: 같은 날/같은 회의실의 연속된 두 개 블록 탐색 (별도 예약인 경우)
  const grouped: Record<string, RoomReservation[]> = {}
  for (const r of candidates) {
    const key = `${r.date}__${r.roomId}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(r)
  }

  for (const slots of Object.values(grouped)) {
    slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

    for (let i = 0; i < slots.length - 1; i++) {
      const first = slots[i]
      const second = slots[i + 1]
      if (first.id === second.id) continue // 같은 예약이면 방법1에서 처리
      if (first.endTime !== second.startTime) continue
      if (overlapsLunch(first.startTime, first.endTime) || overlapsLunch(second.startTime, second.endTime)) continue
      if (!isAllAvailable(firstRoundAvailabilities, first.date, first.startTime, first.endTime)) continue
      if (!isAllAvailable(secondRoundAvailabilities, second.date, second.startTime, second.endTime)) continue

      results.push({
        date: first.date,
        firstRound: { startTime: first.startTime, endTime: first.endTime, reservationId: first.id },
        secondRound: { startTime: second.startTime, endTime: second.endTime, reservationId: second.id },
        roomId: first.roomId,
        roomName: first.roomName,
      })
    }
  }

  return results
}
