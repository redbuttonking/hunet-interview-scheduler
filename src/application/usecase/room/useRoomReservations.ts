import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { roomReservationRepository } from '@/infrastructure/firebase/RoomReservationRepository'
import { CreateReservationInput, UpdateReservationInput } from '@/domain/repository/IRoomReservationRepository'

export const RESERVATIONS_KEY = (startDate: string, endDate: string) => [
  'reservations',
  startDate,
  endDate,
]

export function useRoomReservations(startDate: string, endDate: string) {
  return useQuery({
    queryKey: RESERVATIONS_KEY(startDate, endDate),
    queryFn: () => roomReservationRepository.findByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}

export function useCreateReservation(_startDate?: string, _endDate?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReservationInput) => roomReservationRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useUpdateReservation(_startDate?: string, _endDate?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReservationInput }) =>
      roomReservationRepository.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useDeleteReservation(startDate: string, endDate: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => roomReservationRepository.delete(id),
    onSuccess: () => {
      // 날짜 범위에 상관없이 모든 예약 캐시 무효화 (일정 추천 즉시 반영)
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}
