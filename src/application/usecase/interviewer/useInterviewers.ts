import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewerRepository } from '@/infrastructure/firebase/InterviewerRepository'
import { CreateInterviewerInput, UpdateInterviewerInput } from '@/domain/repository/IInterviewerRepository'

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
    mutationFn: (id: string) => interviewerRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWERS_KEY }),
  })
}
