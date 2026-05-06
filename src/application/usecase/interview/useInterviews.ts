import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewRepository } from '@/infrastructure/firebase/InterviewRepository'
import { roomReservationRepository } from '@/infrastructure/firebase/RoomReservationRepository'
import { CreateInterviewInput, UpdateInterviewInput } from '@/domain/repository/IInterviewRepository'
import { UpdateReservationInput } from '@/domain/repository/IRoomReservationRepository'
import { Interview, InterviewerAvailability } from '@/domain/model/Interview'
import { RoomReservation } from '@/domain/model/Room'
import { RecommendedSchedule } from '@/domain/service/ScheduleRecommendService'

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

export function useDeleteInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (interview: Interview) => {
      await resetReservation(interview)
      return interviewRepository.delete(interview.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
      // resetReservation이 예약 상태를 변경하므로 캘린더도 갱신
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

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

export function useSendSlack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (interviewId: string) =>
      interviewRepository.update(interviewId, { status: 'collecting' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

/**
 * 캘린더에서 확정된 인터뷰 예약 수정.
 * RoomReservation 업데이트 + Interview.confirmedSlot 동기화.
 */
export function useUpdateConfirmedReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      old: oldRes,
      input,
    }: {
      old: RoomReservation
      input: UpdateReservationInput
    }) => {
      await roomReservationRepository.update(oldRes.id, input)

      if (!oldRes.interviewId) return
      const interview = await interviewRepository.findById(oldRes.interviewId)
      if (!interview?.confirmedSlot) return

      const updatedSlots = interview.confirmedSlot.slots.map((slot) => {
        if (
          slot.startTime === oldRes.startTime &&
          slot.endTime === oldRes.endTime &&
          slot.roomId === oldRes.roomId
        ) {
          return {
            startTime: input.startTime ?? slot.startTime,
            endTime: input.endTime ?? slot.endTime,
            roomId: input.roomId ?? slot.roomId,
            roomName: input.roomName ?? slot.roomName,
          }
        }
        return slot
      })

      // 세션 시간 변경 후 순서가 달라질 수 있으므로 min/max로 전체 범위 재계산
      const summaryStart = updatedSlots.reduce(
        (min, s) => (s.startTime < min ? s.startTime : min),
        updatedSlots[0].startTime,
      )
      const summaryEnd = updatedSlots.reduce(
        (max, s) => (s.endTime > max ? s.endTime : max),
        updatedSlots[0].endTime,
      )

      await interviewRepository.update(oldRes.interviewId, {
        confirmedSlot: {
          date: input.date ?? interview.confirmedSlot.date,
          startTime: summaryStart,
          endTime: summaryEnd,
          slots: updatedSlots,
        },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

/** 일정 확정: N개 세션 슬롯을 순서대로 예약 분할하고 면접 상태 업데이트 */
export function useConfirmSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      interviewId,
      schedule,
    }: {
      interviewId: string
      schedule: RecommendedSchedule
    }) => {
      await roomReservationRepository.confirmSlots(
        schedule.slots.map((slot) => ({
          reservationId: slot.reservationId,
          date: schedule.date,
          confirmedStart: slot.startTime,
          confirmedEnd: slot.endTime,
          interviewId,
        })),
      )

      return interviewRepository.update(interviewId, {
        status: 'confirmed',
        confirmedSlot: {
          date: schedule.date,
          startTime: schedule.slots[0].startTime,
          endTime: schedule.slots[schedule.slots.length - 1].endTime,
          slots: schedule.slots.map((s) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            roomId: s.roomId,
            roomName: s.roomName,
          })),
        },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}
