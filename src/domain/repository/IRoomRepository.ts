import { Room } from '@/domain/model/Room'

export interface IRoomRepository {
  findAll(): Promise<Room[]>
  create(name: string): Promise<Room>
  delete(id: string): Promise<void>
  updateOrders(items: { id: string; order: number }[]): Promise<void>
  seedDefaults(): Promise<void>
}
