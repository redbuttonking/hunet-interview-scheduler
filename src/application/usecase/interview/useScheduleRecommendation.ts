import { useMemo } from 'react'
import { Interview } from '@/domain/model/Interview'
import { Round } from '@/domain/model/Position'
import { recommendSchedules, RecommendedSchedule } from '@/domain/service/ScheduleRecommendService'
import { useRoomReservations } from '@/application/usecase/room/useRoomReservations'

// presentation이 domain/service에 직접 의존하지 않도록 타입을 application 계층에서 재공개
export type { RecommendedSchedule }

/** 인터뷰 일정 추천 결과와 로딩 상태를 반환하는 훅 */
export function useRecommendedSchedules(interview: Interview): {
  schedules: RecommendedSchedule[]
  isLoading: boolean
} {
  const period = interview.availabilityPeriod

  const { data: reservations = [], isLoading } = useRoomReservations(
    period?.startDate ?? '',
    period?.endDate ?? '',
  )

  const sessionSpecs = useMemo(
    () =>
      interview.sessions.map((session) => {
        const ids = [
          ...new Set(
            session.rounds.flatMap((r) => interview.interviewersByRound[r as Round] ?? []),
          ),
        ].filter((id) => interview.interviewerIds.includes(id))
        return { interviewerIds: ids }
      }),
    [interview],
  )

  const schedules = useMemo(
    () => recommendSchedules(sessionSpecs, interview.availabilities, reservations),
    [sessionSpecs, interview.availabilities, reservations],
  )

  return { schedules, isLoading }
}
