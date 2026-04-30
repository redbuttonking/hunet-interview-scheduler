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

export interface IRoomReservationRepository {
  findByDateRange(startDate: string, endDate: string): Promise<RoomReservation[]>
  create(input: CreateReservationInput): Promise<RoomReservation>
  update(id: string, input: UpdateReservationInput): Promise<void>
  delete(id: string): Promise<void>
}
