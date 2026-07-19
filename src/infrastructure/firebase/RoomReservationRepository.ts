import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  Timestamp,
  type Transaction,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { RoomReservation } from '@/domain/model/Room'
import {
  IRoomReservationRepository,
  CreateReservationInput,
  UpdateReservationInput,
  ConfirmSlotInput,
  ProposeOptionInput,
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
    bookedByUserId: (data.bookedByUserId as string | null) ?? null,
    bookedByName: (data.bookedByName as string | null) ?? null,
    memo: (data.memo as string | undefined) ?? '',
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  }
}

function assertReservableBlock(
  data: Record<string, unknown>,
  ranges: { startTime: string; endTime: string }[],
  id: string,
): void {
  if (data.status !== 'reserved' || data.interviewId != null) {
    throw new Error(`이미 사용 중인 예약입니다: ${id}`)
  }
  const blockStart = data.startTime as string
  const blockEnd = data.endTime as string
  const invalid = ranges.some((range) => range.startTime < blockStart || range.endTime > blockEnd || range.startTime >= range.endTime)
  if (invalid) {
    throw new Error(`예약 가능한 시간 범위를 벗어났습니다: ${id}`)
  }
}

async function confirmReservableBlocks(tx: Transaction, slots: ConfirmSlotInput[]): Promise<void> {
  const col = collection(db, COLLECTIONS.ROOM_RESERVATIONS)
  const blockMap = new Map<string, ConfirmSlotInput[]>()
  for (const slot of slots) {
    if (!blockMap.has(slot.reservationId)) blockMap.set(slot.reservationId, [])
    blockMap.get(slot.reservationId)!.push(slot)
  }
  const blockIds = [...blockMap.keys()]
  const blockRefs = blockIds.map((id) => doc(db, COLLECTIONS.ROOM_RESERVATIONS, id))
  const snaps = await Promise.all(blockRefs.map((ref) => tx.get(ref)))

  snaps.forEach((snap, i) => {
    if (!snap.exists()) throw new Error(`예약을 찾을 수 없습니다: ${blockIds[i]}`)
  })

  snaps.forEach((snap, i) => {
    const blockRef = blockRefs[i]
    const d = snap.data() as Record<string, unknown>
    const roomId = d.roomId as string
    const roomName = d.roomName as string
    const date = d.date as string
    const blockStart = d.startTime as string
    const blockEnd = d.endTime as string
    const bookingFields = {
      bookedByUserId: (d.bookedByUserId as string | null) ?? null,
      bookedByName: (d.bookedByName as string | null) ?? null,
      memo: (d.memo as string | undefined) ?? '',
    }
    const confirmedRanges = blockMap.get(blockIds[i])!
      .sort((a, b) => a.confirmedStart.localeCompare(b.confirmedStart))

    assertReservableBlock(
      d,
      confirmedRanges.map((range) => ({ startTime: range.confirmedStart, endTime: range.confirmedEnd })),
      blockIds[i],
    )

    let prevEnd = blockStart
    let firstRange = true
    for (const range of confirmedRanges) {
      if (prevEnd < range.confirmedStart) {
        tx.set(doc(col), {
          roomId, roomName, date,
          startTime: prevEnd, endTime: range.confirmedStart,
          status: 'reserved', interviewId: null,
          ...bookingFields,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }

      if (firstRange) {
        tx.update(blockRef, {
          startTime: range.confirmedStart, endTime: range.confirmedEnd,
          status: 'confirmed', interviewId: range.interviewId,
          updatedAt: serverTimestamp(),
        })
        firstRange = false
      } else {
        tx.set(doc(col), {
          roomId, roomName, date,
          startTime: range.confirmedStart, endTime: range.confirmedEnd,
          status: 'confirmed', interviewId: range.interviewId,
          ...bookingFields,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }
      prevEnd = range.confirmedEnd
    }

    if (prevEnd < blockEnd) {
      tx.set(doc(col), {
        roomId, roomName, date,
        startTime: prevEnd, endTime: blockEnd,
        status: 'reserved', interviewId: null,
        ...bookingFields,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    }
  })
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

  subscribeByDateRange(startDate: string, endDate: string, onData: (reservations: RoomReservation[]) => void): () => void {
    const q = query(
      collection(db, COLLECTIONS.ROOM_RESERVATIONS),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    )
    return onSnapshot(q, (snap) => {
      onData(snap.docs.map((d) => toReservation(d.id, d.data() as Record<string, unknown>)))
    })
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

  async findByInterviewId(interviewId: string): Promise<RoomReservation[]> {
    const q = query(
      collection(db, COLLECTIONS.ROOM_RESERVATIONS),
      where('interviewId', '==', interviewId),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => toReservation(d.id, d.data() as Record<string, unknown>))
  },

  async confirmSlots(slots: ConfirmSlotInput[]): Promise<void> {
    await runTransaction(db, (tx) => confirmReservableBlocks(tx, slots))
  },

  async replaceConfirmedSlots(previousReservationIds: string[], slots: ConfirmSlotInput[]): Promise<void> {
    const interviewId = slots[0]?.interviewId
    if (!interviewId || previousReservationIds.length === 0) {
      throw new Error('변경할 확정 예약이 없습니다.')
    }

    await runTransaction(db, async (tx) => {
      const previousRefs = previousReservationIds.map((id) => doc(db, COLLECTIONS.ROOM_RESERVATIONS, id))
      const previousSnaps = await Promise.all(previousRefs.map((ref) => tx.get(ref)))

      previousSnaps.forEach((snap, i) => {
        if (!snap.exists()) throw new Error(`기존 확정 예약을 찾을 수 없습니다: ${previousReservationIds[i]}`)
        const data = snap.data() as Record<string, unknown>
        if (data.status !== 'confirmed' || data.interviewId !== interviewId) {
          throw new Error(`변경할 수 없는 예약입니다: ${previousReservationIds[i]}`)
        }
      })

      await confirmReservableBlocks(tx, slots)
      previousRefs.forEach((ref) => {
        tx.update(ref, {
          status: 'reserved',
          interviewId: null,
          updatedAt: serverTimestamp(),
        })
      })
    })
  },

  async proposeSlots(options: ProposeOptionInput[], interviewId: string): Promise<ProposeOptionInput[]> {
    const col = collection(db, COLLECTIONS.ROOM_RESERVATIONS)

    // 블록별로 필요한 슬롯 그룹핑 (같은 블록에서 여러 옵션 선택 가능)
    const blockMap = new Map<string, { optionIdx: number; slotIdx: number; startTime: string; endTime: string }[]>()
    options.forEach((opt, oi) => {
      opt.slots.forEach((slot, si) => {
        if (!blockMap.has(slot.reservationId)) blockMap.set(slot.reservationId, [])
        blockMap.get(slot.reservationId)!.push({ optionIdx: oi, slotIdx: si, startTime: slot.startTime, endTime: slot.endTime })
      })
    })

    const blockIds = [...blockMap.keys()]
    const resultIdMap = new Map<string, string>()

    await runTransaction(db, async (tx) => {
      const blockRefs = blockIds.map((id) => doc(db, COLLECTIONS.ROOM_RESERVATIONS, id))
      const snaps = await Promise.all(blockRefs.map((ref) => tx.get(ref)))

      snaps.forEach((snap, i) => {
        if (!snap.exists()) throw new Error(`예약을 찾을 수 없습니다: ${blockIds[i]}`)
      })

      snaps.forEach((snap, i) => {
        const blockId = blockIds[i]
        const blockRef = blockRefs[i]
        const d = snap.data() as Record<string, unknown>
        const roomId = d.roomId as string
        const roomName = d.roomName as string
        const date = d.date as string
        const blockStart = d.startTime as string
        const blockEnd = d.endTime as string
        const bookingFields = {
          bookedByUserId: (d.bookedByUserId as string | null) ?? null,
          bookedByName: (d.bookedByName as string | null) ?? null,
          memo: (d.memo as string | undefined) ?? '',
        }

        const coordRanges = blockMap.get(blockId)!
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
        assertReservableBlock(d, coordRanges, blockId)

        let prevEnd = blockStart
        let firstRange = true

        for (const range of coordRanges) {
          if (prevEnd < range.startTime) {
            tx.set(doc(col), {
              roomId, roomName, date,
              startTime: prevEnd, endTime: range.startTime,
              status: 'reserved', interviewId: null,
              ...bookingFields,
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            })
          }

          const key = `${range.optionIdx},${range.slotIdx}`
          if (firstRange) {
            tx.update(blockRef, {
              startTime: range.startTime, endTime: range.endTime,
              status: 'coordinating', interviewId,
              updatedAt: serverTimestamp(),
            })
            resultIdMap.set(key, blockId)
            firstRange = false
          } else {
            const newRef = doc(col)
            tx.set(newRef, {
              roomId, roomName, date,
              startTime: range.startTime, endTime: range.endTime,
              status: 'coordinating', interviewId,
              ...bookingFields,
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            })
            resultIdMap.set(key, newRef.id)
          }

          prevEnd = range.endTime
        }

        if (prevEnd < blockEnd) {
          tx.set(doc(col), {
            roomId, roomName, date,
            startTime: prevEnd, endTime: blockEnd,
            status: 'reserved', interviewId: null,
            ...bookingFields,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          })
        }
      })
    })

    return options.map((opt, oi) => ({
      date: opt.date,
      slots: opt.slots.map((slot, si) => ({
        ...slot,
        reservationId: resultIdMap.get(`${oi},${si}`) ?? slot.reservationId,
      })),
    }))
  },
}
