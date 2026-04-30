import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { Room } from '@/domain/model/Room'
import { IRoomRepository } from '@/domain/repository/IRoomRepository'

const DEFAULT_ROOMS = ['행복룸', '열정룸', '게임체인저', '의문당', 'Zoom']

let seeded = false

function toRoom(id: string, data: Record<string, unknown>): Room {
  return {
    id,
    name: data.name as string,
    order: typeof data.order === 'number' ? data.order : 9999,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
  }
}

export const roomRepository: IRoomRepository = {
  async findAll(): Promise<Room[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.ROOMS))
    const all = snap.docs.map((d) => toRoom(d.id, d.data() as Record<string, unknown>))
    // 이름 중복 제거 후 order 기준 정렬
    const seen = new Set<string>()
    return all
      .filter((r) => {
        if (seen.has(r.name)) return false
        seen.add(r.name)
        return true
      })
      .sort((a, b) => a.order - b.order)
  },

  async create(name: string): Promise<Room> {
    const snap = await getDocs(collection(db, COLLECTIONS.ROOMS))
    const maxOrder = snap.docs.reduce((max, d) => {
      const o = (d.data() as Record<string, unknown>).order
      return typeof o === 'number' ? Math.max(max, o) : max
    }, -1)
    const order = maxOrder + 1
    const ref = await addDoc(collection(db, COLLECTIONS.ROOMS), {
      name,
      order,
      createdAt: serverTimestamp(),
    })
    return { id: ref.id, name, order, createdAt: new Date() }
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.ROOMS, id))
  },

  async updateOrders(items: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, order }) =>
        updateDoc(doc(db, COLLECTIONS.ROOMS, id), { order }),
      ),
    )
  },

  async seedDefaults(): Promise<void> {
    if (seeded) return
    seeded = true

    const snap = await getDocs(collection(db, COLLECTIONS.ROOMS))

    // 중복 제거
    const seen = new Map<string, string>()
    const duplicateIds: string[] = []
    snap.docs.forEach((d) => {
      const name = (d.data() as Record<string, unknown>).name as string
      if (seen.has(name)) duplicateIds.push(d.id)
      else seen.set(name, d.id)
    })
    if (duplicateIds.length > 0) {
      await Promise.all(duplicateIds.map((id) => deleteDoc(doc(db, COLLECTIONS.ROOMS, id))))
    }

    const remaining = snap.docs.length - duplicateIds.length
    if (remaining > 0) return

    await Promise.all(
      DEFAULT_ROOMS.map((name, i) =>
        addDoc(collection(db, COLLECTIONS.ROOMS), {
          name,
          order: i,
          createdAt: serverTimestamp(),
        }),
      ),
    )
  },
}
