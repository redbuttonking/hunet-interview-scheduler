import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewRepository } from '@/infrastructure/firebase/InterviewRepository'
import { roomReservationRepository } from '@/infrastructure/firebase/RoomReservationRepository'
import { CreateInterviewInput, UpdateInterviewInput } from '@/domain/repository/IInterviewRepository'
import { Interview, InterviewerAvailability } from '@/domain/model/Interview'
import { RecommendedSlot, OneDayRecommendedSlot } from '@/domain/service/ScheduleRecommendService'

/** 확정된 면접의 회의실 예약을 reserved 상태로 원복 */
async function resetReservation(interview: Interview): Promise<void> {
  if (!interview.confirmedSlot) return
  const reservations = await roomReservationRepository.findByDateRange(
    interview.confirmedSlot.date,
    interview.confirmedSlot.date,
  )
  const targets = reservations.filter((r) => r.interviewId === interview.id)
  await Promise.all(
    targets.map((r) => roomReservationRepository.update(r.id, { status: 'reserved', interviewId: null })),
  )
}

export const INTERVIEWS_KEY = ['interviews']

export function useInterviews() {
  return useQuery({
    queryKey: INTERVIEWS_KEY,
    queryFn: () => interviewRepository.findAll(),
  })
}

export function useCreateInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInterviewInput) => interviewRepository.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

export function useUpdateInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInterviewInput }) =>
      interviewRepository.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

/** 삭제 — 확정된 경우 회의실 예약도 reserved로 원복 */
export function useDeleteInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (interview: Interview) => {
      await resetReservation(interview)
      return interviewRepository.delete(interview.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

/** 확정 취소 — ready_to_schedule로 되돌리고 회의실 예약 원복 */
export function useRevertConfirmation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (interview: Interview) => {
      await resetReservation(interview)
      return interviewRepository.update(interview.id, {
        status: 'ready_to_schedule',
        confirmedSlot: null,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

/** 면접관 가용 일정 저장 + 전원 입력 시 상태 ready_to_schedule 자동 전환 */
export function useSubmitAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      interviewId,
      interviewerIds,
      availability,
    }: {
      interviewId: string
      interviewerIds: string[]
      availability: InterviewerAvailability
    }) => {
      const interview = await interviewRepository.findById(interviewId)
      if (!interview) throw new Error('면접 건을 찾을 수 없습니다.')

      const filtered = interview.availabilities.filter(
        (a) => a.interviewerId !== availability.interviewerId,
      )
      const updated = [...filtered, availability]
      const allSubmitted = interviewerIds.every((id) =>
        updated.some((a) => a.interviewerId === id),
      )

      return interviewRepository.update(interviewId, {
        availabilities: updated,
        status: allSubmitted ? 'ready_to_schedule' : 'collecting',
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

/** 수집 시작 — 상태를 collecting으로 전환 (슬랙 연동은 추후 구현) */
export function useSendSlack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (interviewId: string) =>
      interviewRepository.update(interviewId, { status: 'collecting' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

/** 일정 확정: 면접 상태 업데이트 + 회의실 예약 연동 */
export function useConfirmSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      interviewId,
      slot,
    }: {
      interviewId: string
      slot: RecommendedSlot | { oneDaySlot: OneDayRecommendedSlot }
    }) => {
      if ('oneDaySlot' in slot) {
        const { oneDaySlot } = slot
        await Promise.all([
          roomReservationRepository.update(oneDaySlot.firstRound.reservationId, {
            status: 'confirmed',
            interviewId,
          }),
          roomReservationRepository.update(oneDaySlot.secondRound.reservationId, {
            status: 'confirmed',
            interviewId,
          }),
        ])
        return interviewRepository.update(interviewId, {
          status: 'confirmed',
          confirmedSlot: {
            date: oneDaySlot.date,
            startTime: oneDaySlot.firstRound.startTime,
            endTime: oneDaySlot.secondRound.endTime,
            roomId: oneDaySlot.roomId,
            roomName: oneDaySlot.roomName,
          },
        })
      } else {
        await roomReservationRepository.update(slot.reservationId, {
          status: 'confirmed',
          interviewId,
        })
        return interviewRepository.update(interviewId, {
          status: 'confirmed',
          confirmedSlot: {
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            roomId: slot.roomId,
            roomName: slot.roomName,
          },
        })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}
