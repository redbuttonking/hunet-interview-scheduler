import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewerRepository } from '@/infrastructure/firebase/InterviewerRepository'
import { positionRepository } from '@/infrastructure/firebase/PositionRepository'
import { interviewRepository } from '@/infrastructure/firebase/InterviewRepository'
import { CreateInterviewerInput, UpdateInterviewerInput } from '@/domain/repository/IInterviewerRepository'
import { POSITIONS_KEY } from '../position/usePositions'
import { INTERVIEWS_KEY } from '../interview/useInterviews'

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

      // 포지션 interviewersByRound에서 제거
      const positions = await positionRepository.findAll()
      const affectedPositions = positions.filter((p) =>
        Object.values(p.interviewersByRound).some((ids) => ids.includes(id)),
      )
      await Promise.all(
        affectedPositions.map((p) => {
          const cleaned: Record<string, string[]> = {}
          for (const [round, ids] of Object.entries(p.interviewersByRound)) {
            const filtered = (ids as string[]).filter((i) => i !== id)
            if (filtered.length > 0) cleaned[round] = filtered
          }
          return positionRepository.update(p.id, { interviewersByRound: cleaned })
        }),
      )

      // 진행 중인 인터뷰의 interviewerIds, interviewersByRound, availabilities에서 제거
      const interviews = await interviewRepository.findAll()
      const affectedInterviews = interviews.filter((iv) => iv.interviewerIds.includes(id))
      await Promise.all(
        affectedInterviews.map((iv) => {
          const interviewerIds = iv.interviewerIds.filter((i) => i !== id)
          const interviewersByRound: Record<string, string[]> = {}
          for (const [round, ids] of Object.entries(iv.interviewersByRound)) {
            const filtered = (ids as string[]).filter((i) => i !== id)
            if (filtered.length > 0) interviewersByRound[round] = filtered
          }
          const availabilities = iv.availabilities.filter((a) => a.interviewerId !== id)
          return interviewRepository.update(iv.id, { interviewerIds, interviewersByRound, availabilities })
        }),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWERS_KEY })
      qc.invalidateQueries({ queryKey: POSITIONS_KEY })
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
    },
  })
}
