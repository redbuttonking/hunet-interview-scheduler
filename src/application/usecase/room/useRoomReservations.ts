import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { roomReservationRepository } from '@/infrastructure/firebase/RoomReservationRepository'
import { CreateReservationInput, UpdateReservationInput } from '@/domain/repository/IRoomReservationRepository'

export const RESERVATIONS_KEY = (startDate: string, endDate: string) => [
  'reservations',
  startDate,
  endDate,
]

export function useRoomReservations(startDate: string, endDate: string) {
  const qc = useQueryClient()

  // Firestore 실시간 구독 — 다우오피스 동기화 포함 모든 변경을 즉시 반영
  useEffect(() => {
    if (!startDate || !endDate) return
    return roomReservationRepository.subscribeByDateRange(startDate, endDate, (data) => {
      qc.setQueryData(RESERVATIONS_KEY(startDate, endDate), data)
    })
  }, [startDate, endDate, qc])

  return useQuery({
    queryKey: RESERVATIONS_KEY(startDate, endDate),
    queryFn: () => roomReservationRepository.findByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReservationInput) => roomReservationRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useUpdateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReservationInput }) =>
      roomReservationRepository.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useDeleteReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => roomReservationRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}
