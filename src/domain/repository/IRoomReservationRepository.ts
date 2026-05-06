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

export interface UpdateReservationInput extends Partial<CreateReservationInput> {}

/** 일정 확정 시 예약 블록 분할에 필요한 슬롯 정보 */
export interface ConfirmSlotInput {
  reservationId: string
  date: string
  confirmedStart: string
  confirmedEnd: string
  interviewId: string
}

export interface IRoomReservationRepository {
  findByDateRange(startDate: string, endDate: string): Promise<RoomReservation[]>
  create(input: CreateReservationInput): Promise<RoomReservation>
  update(id: string, input: UpdateReservationInput): Promise<void>
  delete(id: string): Promise<void>
  /** 복수 슬롯을 원자적으로 분할·확정 (writeBatch) */
  confirmSlots(slots: ConfirmSlotInput[]): Promise<void>
}
