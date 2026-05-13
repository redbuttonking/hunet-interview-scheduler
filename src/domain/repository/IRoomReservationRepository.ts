import { RoomReservation, ReservationStatus } from '@/domain/model/Room'

export interface CreateReservationInput {
  roomId: string
  roomName: string
  date: string
  startTime: string
  endTime: string
  status: ReservationStatus
  interviewId: string | null
}

export type UpdateReservationInput = Partial<CreateReservationInput>

/** 일정 확정 시 예약 블록 분할에 필요한 슬롯 정보 */
export interface ConfirmSlotInput {
  reservationId: string
  date: string
  confirmedStart: string
  confirmedEnd: string
  interviewId: string
}

/** 후보자 옵션 발송 시 조율중 처리에 필요한 슬롯 */
export interface ProposeOptionSlot {
  reservationId: string
  startTime: string
  endTime: string
  roomId: string
  roomName: string
}

export interface ProposeOptionInput {
  date: string
  slots: ProposeOptionSlot[]
}

export interface IRoomReservationRepository {
  findByDateRange(startDate: string, endDate: string): Promise<RoomReservation[]>
  /** 인터뷰 ID로 연결된 예약 전체 조회 — cascade 삭제용 */
  findByInterviewId(interviewId: string): Promise<RoomReservation[]>
  create(input: CreateReservationInput): Promise<RoomReservation>
  update(id: string, input: UpdateReservationInput): Promise<void>
  delete(id: string): Promise<void>
  /** 복수 슬롯을 원자적으로 분할·확정 (runTransaction) */
  confirmSlots(slots: ConfirmSlotInput[]): Promise<void>
  /**
   * 조율 시작 — 선택한 슬롯을 조율중으로 분할.
   * 동일 블록에서 여러 옵션을 선택해도 올바르게 처리.
   * 반환값: 분할 후 실제 reservation ID가 반영된 옵션 목록.
   */
  proposeSlots(options: ProposeOptionInput[], interviewId: string): Promise<ProposeOptionInput[]>
}
