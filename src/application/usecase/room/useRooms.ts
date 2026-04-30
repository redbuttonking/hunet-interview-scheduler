import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { roomRepository } from '@/infrastructure/firebase/RoomRepository'

export const ROOMS_KEY = ['rooms']

export function useRooms() {
  return useQuery({
    queryKey: ROOMS_KEY,
    queryFn: async () => {
      await roomRepository.seedDefaults()
      return roomRepository.findAll()
    },
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => roomRepository.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOMS_KEY }),
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => roomRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOMS_KEY }),
  })
}

export function useUpdateRoomOrders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { id: string; order: number }[]) =>
      roomRepository.updateOrders(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOMS_KEY }),
  })
}
