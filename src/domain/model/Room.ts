/** 회의실 예약 상태 */
export type ReservationStatus =
  | 'reserved'    // 예약됨 (면접 미배정)
  | 'coordinating' // 조율중
  | 'confirmed'   // 확정

/** 회의실 */
export interface Room {
  id: string
  name: string
  order: number
  createdAt: Date
}

/** 회의실 예약 슬롯 — 외부 시스템에서 예약 후 수동 등록 */
export interface RoomReservation {
  id: string
  roomId: string
  roomName: string
  date: string        // 'YYYY-MM-DD'
  startTime: string   // 'HH:MM'
  endTime: string     // 'HH:MM'
  status: ReservationStatus
  /** 배정된 면접 ID (조율중/확정 상태에서만 존재) */
  interviewId: string | null
  createdAt: Date
  updatedAt: Date
}
