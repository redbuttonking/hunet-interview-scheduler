import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, getDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { Position, Round } from '@/domain/model/Position'
import {
  IPositionRepository,
  CreatePositionInput,
  UpdatePositionInput,
} from '@/domain/repository/IPositionRepository'

function toPosition(id: string, data: Record<string, unknown>): Position {
  return {
    id,
    name: data.name as string,
    rounds: (data.rounds as Round[]) ?? [],
    oneDayInterview: (data.oneDayInterview as boolean) ?? false,
    interviewersByRound: (data.interviewersByRound as Record<Round, string[]>) ?? {},
    createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
  }
}

class PositionFirestoreRepository implements IPositionRepository {
  private col = collection(db, COLLECTIONS.POSITIONS)

  async findAll(): Promise<Position[]> {
    const snap = await getDocs(query(this.col, orderBy('createdAt', 'asc')))
    return snap.docs.map((d) => toPosition(d.id, d.data()))
  }

  async create(input: CreatePositionInput): Promise<Position> {
    const ref = await addDoc(this.col, {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(ref)
    return toPosition(snap.id, snap.data() as Record<string, unknown>)
  }

  async update(id: string, input: UpdatePositionInput): Promise<Position> {
    const ref = doc(db, COLLECTIONS.POSITIONS, id)
    await updateDoc(ref, { ...input, updatedAt: serverTimestamp() })
    const snap = await getDoc(ref)
    return toPosition(snap.id, snap.data() as Record<string, unknown>)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.POSITIONS, id))
  }
}

export const positionRepository = new PositionFirestoreRepository()
