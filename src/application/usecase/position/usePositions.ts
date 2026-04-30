import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { positionRepository } from '@/infrastructure/firebase/PositionRepository'
import { CreatePositionInput, UpdatePositionInput } from '@/domain/repository/IPositionRepository'

export const POSITIONS_KEY = ['positions']

export function usePositions() {
  return useQuery({
    queryKey: POSITIONS_KEY,
    queryFn: () => positionRepository.findAll(),
  })
}

export function useCreatePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePositionInput) => positionRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

export function useUpdatePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePositionInput }) =>
      positionRepository.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

export function useDeletePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positionRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}
