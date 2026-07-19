import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getIdToken } from 'firebase/auth'
import Holidays from 'date-holidays'
import { auth } from '@/infrastructure/firebase/config'
import { interviewRepository } from '@/infrastructure/firebase/InterviewRepository'
import { interviewerRepository } from '@/infrastructure/firebase/InterviewerRepository'
import { roomReservationRepository } from '@/infrastructure/firebase/RoomReservationRepository'
import { CreateInterviewInput, UpdateInterviewInput } from '@/domain/repository/IInterviewRepository'
import { UpdateReservationInput, ProposeOptionInput } from '@/domain/repository/IRoomReservationRepository'
import { Interview, InterviewerAvailability, CandidateOption } from '@/domain/model/Interview'
import { Interviewer } from '@/domain/model/Interviewer'
import { RoomReservation } from '@/domain/model/Room'
import { RecommendedSchedule } from '@/domain/service/ScheduleRecommendService'
import {
  buildChannelChangeMessage,
  buildChannelConfirmMessage,
  buildDmChangeMessage,
  buildDmConfirmMessage,
} from './confirmSlackMessage'

/** 기준일 기준으로 다음 평일(월~목, 공휴일 제외)을 YYYY-MM-DD로 반환 */
function nextBusinessDay(): string {
  const hd = new Holidays('KR')
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const next = new Date(kstNow)
  next.setUTCDate(next.getUTCDate() + 1)
  while (true) {
    const day = next.getUTCDay()
    if (day >= 1 && day <= 4 && !hd.isHoliday(next)) break
    next.setUTCDate(next.getUTCDate() + 1)
  }
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function postSlackMessage(slackIds: string[], message: string): Promise<string[]> {
  if (!slackIds.length) return []
  if (!auth.currentUser) return slackIds

  const token = await getIdToken(auth.currentUser)
  const res = await fetch('/api/slack/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ slackIds, message }),
  })
  const data = (await res.json().catch(() => ({}))) as { failed?: string[] }
  if (!res.ok) return slackIds
  return Array.isArray(data.failed) ? data.failed : []
}

async function notifyInterviewConfirmed(interview: Interview): Promise<void> {
  if (!interview.confirmedSlot || !interview.slackSendMode) return

  if (interview.slackSendMode === 'channel') {
    const targets = interview.slackTargetIds ?? []
    const failed = await postSlackMessage(targets, buildChannelConfirmMessage(interview))
    if (failed.length > 0) console.warn('[Slack] 확정 안내 채널 발송 실패:', failed)
    return
  }

  const allInterviewers = await interviewerRepository.findAll()
  const bySlackId = new Map(allInterviewers.filter((iv) => iv.slackId).map((iv) => [iv.slackId, iv]))
  const fallbackSlackIds = allInterviewers
    .filter((iv) => interview.interviewerIds.includes(iv.id) && iv.slackId)
    .map((iv) => iv.slackId)
  const targetSlackIds = (interview.slackTargetIds?.length ? interview.slackTargetIds : fallbackSlackIds)
    .filter((slackId) => bySlackId.has(slackId))

  const failed: string[] = []
  for (const slackId of targetSlackIds) {
    const interviewer = bySlackId.get(slackId) as Interviewer
    const result = await postSlackMessage([slackId], buildDmConfirmMessage(interview, interviewer.id))
    failed.push(...result)
  }
  if (failed.length > 0) console.warn('[Slack] 확정 안내 DM 발송 실패:', failed)
}

async function notifyInterviewScheduleChanged(previous: Interview, updated: Interview): Promise<boolean> {
  if (!updated.confirmedSlot || !updated.slackSendMode) return false

  if (updated.slackSendMode === 'channel') {
    const targets = updated.slackTargetIds ?? []
    const failed = await postSlackMessage(targets, buildChannelChangeMessage(previous, updated))
    if (failed.length > 0) console.warn('[Slack] 일정 변경 안내 채널 발송 실패:', failed)
    return targets.length > 0 && failed.length === 0
  }

  const allInterviewers = await interviewerRepository.findAll()
  const bySlackId = new Map(allInterviewers.filter((iv) => iv.slackId).map((iv) => [iv.slackId, iv]))
  const fallbackSlackIds = allInterviewers
    .filter((iv) => updated.interviewerIds.includes(iv.id) && iv.slackId)
    .map((iv) => iv.slackId)
  const targetSlackIds = (updated.slackTargetIds?.length ? updated.slackTargetIds : fallbackSlackIds)
    .filter((slackId) => bySlackId.has(slackId))

  const failed: string[] = []
  for (const slackId of targetSlackIds) {
    const interviewer = bySlackId.get(slackId) as Interviewer
    const result = await postSlackMessage([slackId], buildDmChangeMessage(previous, updated, interviewer.id))
    failed.push(...result)
  }
  if (failed.length > 0) console.warn('[Slack] 일정 변경 안내 DM 발송 실패:', failed)
  return targetSlackIds.length > 0 && failed.length === 0
}

async function resetReservation(interview: Interview): Promise<void> {
  const reservations = await roomReservationRepository.findByInterviewId(interview.id)
  if (!reservations.length) return
  await Promise.all(
    reservations.map((r) => roomReservationRepository.update(r.id, { status: 'reserved', interviewId: null })),
  )
}


export const INTERVIEWS_KEY = ['interviews']

export function useInterviews() {
  const qc = useQueryClient()

  // Firestore onSnapshot으로 실시간 동기화 — 면접관 제출 시 즉시 반영
  useEffect(() => {
    return interviewRepository.subscribe((interviews) => {
      qc.setQueryData(INTERVIEWS_KEY, interviews)
    })
  }, [qc])

  return useQuery({
    queryKey: INTERVIEWS_KEY,
    queryFn: () => interviewRepository.findAll(),
    staleTime: 60 * 1000, // 구독이 주된 갱신 수단이지만 연결 끊김 대비 1분 후 재조회
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
        candidateOptions: null,
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
    mutationFn: ({
      interviewId,
      interviewerIds,
      availability,
    }: {
      interviewId: string
      interviewerIds: string[]
      availability: InterviewerAvailability
    }) => interviewRepository.addAvailability(interviewId, availability, interviewerIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: INTERVIEWS_KEY }),
  })
}

/** 면접 취소 시 면접관들에게 단순 텍스트 DM 발송 (인터뷰 상태 변경 없음) */
export function useSendCancellationSlack() {
  return useMutation({
    mutationFn: async ({
      slackIds,
      message,
    }: {
      slackIds: string[]
      message: string
    }) => {
      if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
      const token = await getIdToken(auth.currentUser)
      const res = await fetch('/api/slack/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slackIds, message, includeCancellationRecipients: true }),
      })
      if (!res.ok) throw new Error('슬랙 발송 실패')
      const data = (await res.json()) as { failed?: string[]; unmatchedSystemUserNames?: string[] }
      return {
        failed: data.failed ?? [],
        unmatchedSystemUserNames: data.unmatchedSystemUserNames ?? [],
      }
    },
  })
}

export function useSendSlack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      interviewId,
      slackIds,
      sendMode,
      message,
      dates,
      candidateName,
      positionName,
    }: {
      interviewId: string
      slackIds: string[]
      sendMode: 'channel' | 'dm'
      message: string
      dates?: string[]
      candidateName?: string
      positionName?: string
    }) => {
      if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
      const token = await getIdToken(auth.currentUser)
      const res = await fetch('/api/slack/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slackIds, message, interviewId, dates, candidateName, positionName }),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))

      // 완전 실패 (4xx/5xx) — 아무도 못 받은 경우
      if (!res.ok) {
        throw new Error('슬랙 발송에 실패했습니다. 채널에 봇이 초대되어 있는지 확인해주세요.')
      }

      // 실패한 대상 목록 반환 (빈 배열 = 전원 성공)
      const partialFailures = (data.ok === false && Array.isArray(data.failed))
        ? (data.failed as string[])
        : []
      const successfulTargets = slackIds.filter((id) => !partialFailures.includes(id))

      await interviewRepository.update(interviewId, {
        status: 'collecting',
        reminderScheduledFor: nextBusinessDay(),
        slackSendMode: sendMode,
        slackTargetIds: successfulTargets,
      })

      return { partialFailures }
    },
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

/** 조율 시작: 선택한 슬롯을 조율중으로 분할하고 인터뷰를 pending_candidate로 전환 */
export function useProposeCandidateOptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      interviewId,
      options,
    }: {
      interviewId: string
      options: ProposeOptionInput[]
    }) => {
      const updatedOptions = await roomReservationRepository.proposeSlots(options, interviewId)
      return interviewRepository.update(interviewId, {
        status: 'pending_candidate',
        candidateOptions: updatedOptions,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

/** 후보자 선택 확정: 선택한 옵션 회의실 confirmed, 나머지 coordinating → reserved 복원 */
export function useConfirmCandidateChoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      interview,
      chosenOption,
    }: {
      interview: Interview
      chosenOption: CandidateOption
    }) => {
      const chosenIds = new Set(chosenOption.slots.map((s) => s.reservationId))

      // candidateOptions에서 모든 coordinating ID 수집 — Firestore 재조회 불필요
      const allCoordinatingIds = [
        ...new Set(
          (interview.candidateOptions ?? []).flatMap((opt) => opt.slots.map((s) => s.reservationId)),
        ),
      ]

      // 선택 → confirmed, 나머지 → reserved 동시 처리
      await Promise.all([
        ...chosenOption.slots.map((s) =>
          roomReservationRepository.update(s.reservationId, { status: 'confirmed' }),
        ),
        ...allCoordinatingIds
          .filter((id) => !chosenIds.has(id))
          .map((id) => roomReservationRepository.update(id, { status: 'reserved', interviewId: null })),
      ])

      const confirmedSlot = {
        date: chosenOption.date,
        startTime: chosenOption.slots[0].startTime,
        endTime: chosenOption.slots[chosenOption.slots.length - 1].endTime,
        slots: chosenOption.slots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          roomId: s.roomId,
          roomName: s.roomName,
        })),
      }

      await interviewRepository.update(interview.id, {
        status: 'confirmed',
        candidateOptions: null,
        confirmedSlot,
      })
      await notifyInterviewConfirmed({
        ...interview,
        status: 'confirmed',
        candidateOptions: null,
        confirmedSlot,
      }).catch((error) => {
        console.warn('[Slack] 확정 안내 발송 중 오류:', error)
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

      const confirmedSlot = {
        date: schedule.date,
        startTime: schedule.slots[0].startTime,
        endTime: schedule.slots[schedule.slots.length - 1].endTime,
        slots: schedule.slots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          roomId: s.roomId,
          roomName: s.roomName,
        })),
      }

      await interviewRepository.update(interviewId, {
        status: 'confirmed',
        confirmedSlot,
      })
      const interview = await interviewRepository.findById(interviewId)
      if (interview) {
        await notifyInterviewConfirmed({ ...interview, status: 'confirmed', confirmedSlot }).catch((error) => {
          console.warn('[Slack] 확정 안내 발송 중 오류:', error)
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

/** 확정 인터뷰의 회의실 예약을 새 일정으로 교체하고 변경 안내를 발송한다. */
export function useChangeConfirmedSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      interviewId,
      schedule,
    }: {
      interviewId: string
      schedule: RecommendedSchedule
    }) => {
      const previous = await interviewRepository.findById(interviewId)
      if (!previous?.confirmedSlot) throw new Error('확정된 인터뷰를 찾을 수 없습니다.')

      const previousReservations = await roomReservationRepository.findByInterviewId(interviewId)
      const previousReservationIds = previousReservations
        .filter((reservation) => reservation.status === 'confirmed')
        .map((reservation) => reservation.id)

      await roomReservationRepository.replaceConfirmedSlots(
        previousReservationIds,
        schedule.slots.map((slot) => ({
          reservationId: slot.reservationId,
          date: schedule.date,
          confirmedStart: slot.startTime,
          confirmedEnd: slot.endTime,
          interviewId,
        })),
      )

      const confirmedSlot = {
        date: schedule.date,
        startTime: schedule.slots[0].startTime,
        endTime: schedule.slots[schedule.slots.length - 1].endTime,
        slots: schedule.slots.map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomId: slot.roomId,
          roomName: slot.roomName,
        })),
      }
      const updated = { ...previous, confirmedSlot }

      await interviewRepository.update(interviewId, { confirmedSlot })
      const notificationSent = await notifyInterviewScheduleChanged(previous, updated).catch((error) => {
        console.warn('[Slack] 일정 변경 안내 발송 중 오류:', error)
        return false
      })
      return { notificationSent }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INTERVIEWS_KEY })
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}
