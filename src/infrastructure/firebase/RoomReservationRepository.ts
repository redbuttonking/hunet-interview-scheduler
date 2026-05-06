import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { RoomReservation } from '@/domain/model/Room'
import {
  IRoomReservationRepository,
  CreateReservationInput,
  UpdateReservationInput,
  ConfirmSlotInput,
} from '@/domain/repository/IRoomReservationRepository'

function toReservation(id: string, data: Record<string, unknown>): RoomReservation {
  return {
    id,
    roomId: data.roomId as string,
    roomName: data.roomName as string,
    date: data.date as string,
    startTime: data.startTime as string,
    endTime: data.endTime as string,
    status: data.status as RoomReservation['status'],
    interviewId: (data.interviewId as string | null) ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  }
}

export const roomReservationRepository: IRoomReservationRepository = {
  async findByDateRange(startDate: string, endDate: string): Promise<RoomReservation[]> {
    const q = query(
      collection(db, COLLECTIONS.ROOM_RESERVATIONS),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => toReservation(d.id, d.data() as Record<string, unknown>))
  },

  async create(input: CreateReservationInput): Promise<RoomReservation> {
    const ref = await addDoc(collection(db, COLLECTIONS.ROOM_RESERVATIONS), {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return {
      id: ref.id,
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  },

  async update(id: string, input: UpdateReservationInput): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.ROOM_RESERVATIONS, id), {
      ...input,
      updatedAt: serverTimestamp(),
    })
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.ROOM_RESERVATIONS, id))
  },

  async confirmSlots(slots: ConfirmSlotInput[]): Promise<void> {
    const col = collection(db, COLLECTIONS.ROOM_RESERVATIONS)
    const batch = writeBatch(db)

    for (const slot of slots) {
      const originalRef = doc(db, COLLECTIONS.ROOM_RESERVATIONS, slot.reservationId)
      const originalSnap = await getDoc(originalRef)
      if (!originalSnap.exists()) throw new Error(`예약을 찾을 수 없습니다: ${slot.reservationId}`)

      const d = originalSnap.data() as Record<string, unknown>
      const roomId = d.roomId as string
      const roomName = d.roomName as string
      const blockStart = d.startTime as string
      const blockEnd = d.endTime as string

      if (blockStart < slot.confirmedStart) {
        batch.set(doc(col), {
          roomId, roomName, date: slot.date,
          startTime: blockStart, endTime: slot.confirmedStart,
          status: 'reserved', interviewId: null,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }

      if (slot.confirmedEnd < blockEnd) {
        batch.set(doc(col), {
          roomId, roomName, date: slot.date,
          startTime: slot.confirmedEnd, endTime: blockEnd,
          status: 'reserved', interviewId: null,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }

      batch.update(originalRef, {
        startTime: slot.confirmedStart,
        endTime: slot.confirmedEnd,
        status: 'confirmed',
        interviewId: slot.interviewId,
        updatedAt: serverTimestamp(),
      })
    }

    await batch.commit()
  },
}
