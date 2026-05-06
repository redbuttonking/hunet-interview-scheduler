import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewRepository } from '@/infrastructure/firebase/InterviewRepository'
import { roomReservationRepository } from '@/infrastructure/firebase/RoomReservationRepository'
import { CreateInterviewInput, UpdateInterviewInput } from '@/domain/repository/IInterviewRepository'
import { Interview, InterviewerAvailability } from '@/domain/model/Interview'
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

/**
 * 예약 블록을 확정 슬롯 크기로 분할.
 * 앞/뒤 남은 시간은 새 reserved 예약으로 생성.
 */
async function splitAndConfirmReservation(
  reservationId: string,
  date: string,
  confirmedStart: string,
  confirmedEnd: string,
  interviewId: string,
): Promise<void> {
  const dayReservations = await roomReservationRepository.findByDateRange(date, date)
  const original = dayReservations.find((r) => r.id === reservationId)
  if (!original) throw new Error('예약을 찾을 수 없습니다.')

  await roomReservationRepository.update(reservationId, {
    startTime: confirmedStart,
    endTime: confirmedEnd,
    status: 'confirmed',
    interviewId,
  })

  if (original.startTime < confirmedStart) {
    await roomReservationRepository.create({
      roomId: original.roomId, roomName: original.roomName, date,
      startTime: original.startTime, endTime: confirmedStart,
      status: 'reserved', interviewId: null,
    })
  }

  if (confirmedEnd < original.endTime) {
    await roomReservationRepository.create({
      roomId: original.roomId, roomName: original.roomName, date,
      startTime: confirmedEnd, endTime: original.endTime,
      status: 'reserved', interviewId: null,
    })
  }
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
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
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
      for (const slot of schedule.slots) {
        await splitAndConfirmReservation(
          slot.reservationId,
          schedule.date,
          slot.startTime,
          slot.endTime,
          interviewId,
        )
      }

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
