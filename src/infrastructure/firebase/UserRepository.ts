import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { COLLECTIONS } from './collections'
import { User, UserRole } from '@/domain/model/User'
import { IUserRepository, CreateUserInput } from '@/domain/repository/IUserRepository'

function toUser(id: string, data: Record<string, unknown>): User {
  return {
    id,
    email: data.email as string,
    name: data.name as string,
    role: data.role as UserRole,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  }
}

class UserFirestoreRepository implements IUserRepository {
  async findAll(): Promise<User[]> {
    const q = query(collection(db, COLLECTIONS.USERS), orderBy('createdAt', 'asc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => toUser(d.id, d.data()))
  }

  async findById(id: string): Promise<User | null> {
    const docSnap = await getDoc(doc(db, COLLECTIONS.USERS, id))
    if (!docSnap.exists()) return null
    return toUser(docSnap.id, docSnap.data())
  }

  async create(id: string, input: CreateUserInput): Promise<User> {
    const now = serverTimestamp()
    await setDoc(doc(db, COLLECTIONS.USERS, id), { ...input, createdAt: now, updatedAt: now })
    return { id, ...input, createdAt: new Date(), updatedAt: new Date() }
  }

  async update(id: string, input: { name?: string; role?: UserRole }): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.USERS, id), { ...input, updatedAt: serverTimestamp() })
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.USERS, id))
  }
}

export const userRepository = new UserFirestoreRepository()
