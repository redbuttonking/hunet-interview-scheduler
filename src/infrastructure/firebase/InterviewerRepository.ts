import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, getDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { Interviewer } from '@/domain/model/Interviewer'
import {
  IInterviewerRepository,
  CreateInterviewerInput,
  UpdateInterviewerInput,
} from '@/domain/repository/IInterviewerRepository'

function toInterviewer(id: string, data: Record<string, unknown>): Interviewer {
  return {
    id,
    name: data.name as string,
    slackId: data.slackId as string,
    createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
  }
}

class InterviewerFirestoreRepository implements IInterviewerRepository {
  private col = collection(db, COLLECTIONS.INTERVIEWERS)

  async findAll(): Promise<Interviewer[]> {
    const snap = await getDocs(query(this.col, orderBy('createdAt', 'asc')))
    return snap.docs.map((d) => toInterviewer(d.id, d.data()))
  }

  async create(input: CreateInterviewerInput): Promise<Interviewer> {
    const ref = await addDoc(this.col, {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const snap = await getDoc(ref)
    return toInterviewer(snap.id, snap.data() as Record<string, unknown>)
  }

  async update(id: string, input: UpdateInterviewerInput): Promise<Interviewer> {
    const ref = doc(db, COLLECTIONS.INTERVIEWERS, id)
    await updateDoc(ref, { ...input, updatedAt: serverTimestamp() })
    const snap = await getDoc(ref)
    return toInterviewer(snap.id, snap.data() as Record<string, unknown>)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.INTERVIEWERS, id))
  }
}

export const interviewerRepository = new InterviewerFirestoreRepository()
