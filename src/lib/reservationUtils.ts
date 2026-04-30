import { RoomReservation } from '@/domain/model/Room'

function timeToMins(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 동일 회의실·날짜에서 시간 중복 여부를 확인한다. excludeId는 수정 시 자기 자신을 제외할 때 사용. */
export function hasTimeOverlap(
  reservations: RoomReservation[],
  roomId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
): boolean {
  const newStart = timeToMins(startTime)
  const newEnd = timeToMins(endTime)
  return reservations.some((r) => {
    if (excludeId && r.id === excludeId) return false
    if (r.roomId !== roomId || r.date !== date) return false
    const rStart = timeToMins(r.startTime)
    const rEnd = timeToMins(r.endTime)
    // 두 구간이 겹치는 조건: newStart < rEnd && newEnd > rStart
    return newStart < rEnd && newEnd > rStart
  })
}
