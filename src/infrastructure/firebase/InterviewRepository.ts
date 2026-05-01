import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, getDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { Interview, InterviewerAvailability } from '@/domain/model/Interview'
import { ScheduleType } from '@/domain/model/Interview'
import {
  IInterviewRepository,
  CreateInterviewInput,
  UpdateInterviewInput,
} from '@/domain/repository/IInterviewRepository'

function toInterview(id: string, data: Record<string, unknown>): Interview {
  return {
    id,
    candidateName: data.candidateName as string,
    positionId: data.positionId as string,
    positionName: data.positionName as string,
    scheduleType: data.scheduleType as ScheduleType,
    interviewerIds: (data.interviewerIds as string[]) ?? [],
    status: data.status as Interview['status'],
    availabilityPeriod: (data.availabilityPeriod as Interview['availabilityPeriod']) ?? null,
    availabilities: (data.availabilities as InterviewerAvailability[]) ?? [],
    confirmedSlot: (data.confirmedSlot as Interview['confirmedSlot']) ?? null,
    createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
  }
}

class InterviewFirestoreRepository implements IInterviewRepository {
  private col = collection(db, COLLECTIONS.INTERVIEWS)

  async findAll(): Promise<Interview[]> {
    const snap = await getDocs(query(this.col, orderBy('createdAt', 'desc')))
    return snap.docs.map((d) => toInterview(d.id, d.data()))
  }

  async findById(id: string): Promise<Interview | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.INTERVIEWS, id))
    if (!snap.exists()) return null
    return toInterview(snap.id, snap.data() as Record<string, unknown>)
  }

  async create(input: CreateInterviewInput): Promise<Interview> {
    const ref = await addDoc(this.col, {
      ...input,
      status: 'pending_slack',
      availabilities: [],
      confirmedSlot: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(ref)
    return toInterview(snap.id, snap.data() as Record<string, unknown>)
  }

  async update(id: string, input: UpdateInterviewInput): Promise<Interview> {
    const ref = doc(db, COLLECTIONS.INTERVIEWS, id)
    await updateDoc(ref, { ...input, updatedAt: serverTimestamp() })
    const snap = await getDoc(ref)
    return toInterview(snap.id, snap.data() as Record<string, unknown>)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.INTERVIEWS, id))
  }
}

export const interviewRepository = new InterviewFirestoreRepository()
