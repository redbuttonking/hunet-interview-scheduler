import { AvailabilitySlot, InterviewerAvailability } from '../model/Interview'
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

/** 두 시간 문자열('HH:MM')을 분 단위 정수로 변환 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 면접관 전원이 해당 슬롯에 가능한지 검사 */
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

/** 점심(12:00~13:00)과 겹치는지 검사 */
function overlapsLunch(startTime: string, endTime: string): boolean {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  const lunchStart = 12 * 60
  const lunchEnd = 13 * 60
  return start < lunchEnd && end > lunchStart
}

/**
 * 일반 면접 일정 추천
 * - 면접관 전원 가능 + 회의실 예약됨 슬롯 기준
 */
export function recommendSlots(
  availabilities: InterviewerAvailability[],
  reservations: RoomReservation[],
  excludedInterviewIds: string[],
): RecommendedSlot[] {
  const results: RecommendedSlot[] = []

  // 예약됨 상태이고 아직 면접 미배정 슬롯만 후보로 사용
  const candidateReservations = reservations.filter(
    (r) => r.status === 'reserved' && r.interviewId === null,
  )

  for (const reservation of candidateReservations) {
    const { id: reservationId, date, startTime, endTime, roomId, roomName } = reservation
    if (!isAllAvailable(availabilities, date, startTime, endTime)) continue
    results.push({ date, startTime, endTime, roomId, roomName, reservationId })
  }

  return results
}

/**
 * 원데이 인터뷰 일정 추천
 * - 같은 날 같은 회의실에서 1시간 + 1시간 연속 슬롯 탐색
 * - 점심(12:00~13:00)을 가로지르는 연속 블록은 제외
 */
export function recommendOneDaySlots(
  firstRoundAvailabilities: InterviewerAvailability[],
  secondRoundAvailabilities: InterviewerAvailability[],
  reservations: RoomReservation[],
): OneDayRecommendedSlot[] {
  const results: OneDayRecommendedSlot[] = []

  const candidateReservations = reservations.filter(
    (r) => r.status === 'reserved' && r.interviewId === null,
  )

  // 같은 날, 같은 회의실로 그룹핑
  const grouped: Record<string, RoomReservation[]> = {}
  for (const r of candidateReservations) {
    const key = `${r.date}__${r.roomId}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(r)
  }

  for (const slots of Object.values(grouped)) {
    // 시작 시간 순으로 정렬
    slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

    for (let i = 0; i < slots.length - 1; i++) {
      const first = slots[i]
      const second = slots[i + 1]

      // 연속 여부 확인 (첫 번째 종료 == 두 번째 시작)
      if (first.endTime !== second.startTime) continue

      // 점심 걸침 여부 확인
      if (
        overlapsLunch(first.startTime, first.endTime) ||
        overlapsLunch(second.startTime, second.endTime)
      )
        continue

      const { date, roomId, roomName } = first

      // 1차 면접관 전원 가능 여부
      if (!isAllAvailable(firstRoundAvailabilities, date, first.startTime, first.endTime)) continue
      // 2차 면접관 전원 가능 여부
      if (!isAllAvailable(secondRoundAvailabilities, date, second.startTime, second.endTime)) continue

      results.push({
        date,
        firstRound: { startTime: first.startTime, endTime: first.endTime, reservationId: first.id },
        secondRound: { startTime: second.startTime, endTime: second.endTime, reservationId: second.id },
        roomId,
        roomName,
      })
    }
  }

  return results
}
