import { User, UserRole } from '@/domain/model/User'

export interface CreateUserInput {
  email: string
  name: string
  role: UserRole
}

/** 사용자 리포지토리 인터페이스 */
export interface IUserRepository {
  findAll(): Promise<User[]>
  findById(id: string): Promise<User | null>
  create(id: string, input: CreateUserInput): Promise<User>
  update(id: string, input: { name?: string; role?: UserRole }): Promise<void>
  delete(id: string): Promise<void>
}
