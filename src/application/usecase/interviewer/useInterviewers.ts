import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewerRepository } from '@/infrastructure/firebase/InterviewerRepository'
import { positionRepository } from '@/infrastructure/firebase/PositionRepository'
import { CreateInterviewerInput, UpdateInterviewerInput } from '@/domain/repository/IInterviewerRepository'
import { POSITIONS_KEY } from '../position/usePositions'

export const INTERVIEWERS_KEY = ['interviewers']

export function useInterviewers() {
  return useQuery({
    queryKey: INTERVIEWERS_KEY,
    queryFn: () => interviewerRepository.findAll(),
  })
}

export function useCreateInterviewer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInterviewerInput) => interviewerRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWERS_KEY }),
  })
}

export function useUpdateInterviewer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInterviewerInput }) =>
      interviewerRepository.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWERS_KEY }),
  })
}

export function useDeleteInterviewer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await interviewerRepository.delete(id)
      // 해당 면접관이 배치된 포지션에서도 제거
      const positions = await positionRepository.findAll()
      const affected = positions.filter((p) =>
        Object.values(p.interviewersByRound).some((ids) => ids.includes(id)),
      )
      await Promise.all(
        affected.map((p) => {
          const cleaned: Record<string, string[]> = {}
          for (const [round, ids] of Object.entries(p.interviewersByRound)) {
            const filtered = (ids as string[]).filter((i) => i !== id)
            if (filtered.length > 0) cleaned[round] = filtered
          }
          return positionRepository.update(p.id, { interviewersByRound: cleaned })
        }),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWERS_KEY })
      qc.invalidateQueries({ queryKey: POSITIONS_KEY })
    },
  })
}
