'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns'
import { AlertTriangle, CalendarCheck, ClipboardList, ArrowRight, CheckCircle2, Circle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Interview, InterviewStatus } from '@/domain/model/Interview'
import { Round } from '@/domain/model/Position'
import { recommendSchedules } from '@/domain/service/ScheduleRecommendService'
import { useInterviews } from '@/application/usecase/interview/useInterviews'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { usePositions } from '@/application/usecase/position/usePositions'
import { useRoomReservations } from '@/application/usecase/room/useRoomReservations'

const STATUS_CONFIG: Record<InterviewStatus, { label: string; className: string }> = {
  pending_slack:     { label: '슬랙 발송 전',    className: 'bg-muted text-muted-foreground' },
  collecting:        { label: '수집 중',          className: 'bg-blue-50 text-blue-700' },
  ready_to_schedule: { label: '일정 추천 가능',   className: 'bg-amber-50 text-amber-700' },
  pending_candidate: { label: '후보자 응답 대기', className: 'bg-emerald-50 text-emerald-700' },
  confirmed:         { label: '확정',             className: 'bg-blue-50 text-blue-700' },
}

type WeekFilter = 'this_week' | 'next_week' | 'all'
type PendingFilter = 'all' | Exclude<InterviewStatus, 'confirmed'>
type AttentionLevel = 'danger' | 'warning' | 'info'

interface AttentionItem {
  key: string
  level: AttentionLevel
  title: string
  description: string
  interview?: Interview
}

const WEEK_FILTERS: { value: WeekFilter; label: string }[] = [
  { value: 'this_week', label: '이번 주' },
  { value: 'next_week', label: '다음 주' },
  { value: 'all', label: '전체' },
]

const PENDING_ORDER: Record<Exclude<InterviewStatus, 'confirmed'>, number> = {
  pending_slack: 0,
  collecting: 1,
  ready_to_schedule: 2,
  pending_candidate: 3,
}

const PENDING_FILTERS: { value: PendingFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending_slack', label: '슬랙 발송 전' },
  { value: 'collecting', label: '수집 중' },
  { value: 'ready_to_schedule', label: '일정 추천 가능' },
  { value: 'pending_candidate', label: '후보자 응답 대기' },
]

function localDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateKo(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

function formatToday(): string {
  const d = new Date()
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`
}

function daysSince(date: Date): number {
  const today = new Date(localDateStr() + 'T00:00:00')
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000))
}

export default function DashboardView() {
  const { data: interviews = [], isLoading } = useInterviews()
  const { data: interviewers = [] } = useInterviewers()
  const { data: positions = [] } = usePositions()
  const [weekFilter, setWeekFilter] = useState<WeekFilter>('this_week')
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>('all')

  const today = localDateStr()
  const readyPeriods = useMemo(
    () =>
      interviews
        .filter((iv) => iv.status === 'ready_to_schedule' && iv.availabilityPeriod)
        .map((iv) => iv.availabilityPeriod!),
    [interviews],
  )
  const recommendationStart = readyPeriods.length
    ? readyPeriods.reduce((min, p) => (p.startDate < min ? p.startDate : min), readyPeriods[0].startDate)
    : ''
  const recommendationEnd = readyPeriods.length
    ? readyPeriods.reduce((max, p) => (p.endDate > max ? p.endDate : max), readyPeriods[0].endDate)
    : ''
  const { data: recommendationReservations = [], isLoading: isRecommendationLoading } =
    useRoomReservations(recommendationStart, recommendationEnd)

  const allUpcomingConfirmed = useMemo(
    () =>
      interviews
        .filter((iv) => iv.status === 'confirmed' && iv.confirmedSlot && iv.confirmedSlot.date >= today)
        .sort((a, b) => {
          const da = a.confirmedSlot!.date + a.confirmedSlot!.startTime
          const db = b.confirmedSlot!.date + b.confirmedSlot!.startTime
          return da.localeCompare(db)
        }),
    [interviews, today],
  )

  const allPending = useMemo(
    () =>
      interviews
        .filter(
          (iv) =>
            iv.status === 'pending_slack' ||
            iv.status === 'collecting' ||
            iv.status === 'ready_to_schedule' ||
            iv.status === 'pending_candidate',
        )
        .sort(
          (a, b) =>
            PENDING_ORDER[a.status as keyof typeof PENDING_ORDER] -
            PENDING_ORDER[b.status as keyof typeof PENDING_ORDER],
        ),
    [interviews],
  )

  const filteredUpcoming = useMemo(() => {
    if (weekFilter === 'all') return allUpcomingConfirmed
    const offset = weekFilter === 'this_week' ? 0 : 1
    const base = addWeeks(new Date(), offset)
    const weekStart = format(startOfWeek(base, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(base, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    return allUpcomingConfirmed.filter((iv) => {
      const d = iv.confirmedSlot!.date
      return d >= weekStart && d <= weekEnd
    })
  }, [allUpcomingConfirmed, weekFilter])

  const filteredPending = useMemo(
    () =>
      pendingFilter === 'all'
        ? allPending
        : allPending.filter((iv) => iv.status === pendingFilter),
    [allPending, pendingFilter],
  )

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = []
    const interviewerMap = new Map(interviewers.map((iv) => [iv.id, iv]))
    const positionMap = new Map(positions.map((position) => [position.id, position]))

    for (const iv of interviews) {
      if (iv.status === 'collecting') {
        const submittedIds = new Set(iv.availabilities.map((a) => a.interviewerId))
        const missingNames = iv.interviewerIds
          .filter((id) => !submittedIds.has(id))
          .map((id) => interviewerMap.get(id)?.name ?? '알 수 없음')

        if (missingNames.length > 0) {
          items.push({
            key: `missing-${iv.id}`,
            level: 'warning',
            title: '미제출 면접관이 있습니다.',
            description: `${missingNames.join(', ')} 님의 가용 일정이 아직 없습니다.`,
            interview: iv,
          })
        }

        const position = positionMap.get(iv.positionId)
        if (!position?.slackChannelId) {
          items.push({
            key: `reminder-channel-${iv.id}`,
            level: 'info',
            title: '리마인드 채널이 없습니다.',
            description: '포지션에 Slack 채널 ID가 없어 자동·수동 리마인드가 막힐 수 있습니다.',
            interview: iv,
          })
        }
      }

      if (iv.status === 'pending_slack') {
        const missingSlackNames = iv.interviewerIds
          .map((id) => interviewerMap.get(id))
          .filter((interviewer) => interviewer && !interviewer.slackId)
          .map((interviewer) => interviewer!.name)

        if (missingSlackNames.length > 0) {
          items.push({
            key: `slack-id-${iv.id}`,
            level: 'danger',
            title: 'Slack ID가 없는 면접관이 있습니다.',
            description: `${missingSlackNames.join(', ')} 님은 Slack 발송 대상에서 제외됩니다.`,
            interview: iv,
          })
        }
      }

      if (iv.status === 'pending_candidate') {
        const waitingDays = daysSince(iv.updatedAt)
        if (waitingDays >= 3) {
          items.push({
            key: `candidate-wait-${iv.id}`,
            level: 'warning',
            title: '후보자 응답 대기가 오래되었습니다.',
            description: `${waitingDays}일째 후보자 선택이 확정되지 않았습니다. 조율 취소 또는 재안내가 필요합니다.`,
            interview: iv,
          })
        }
      }

      if (iv.status === 'ready_to_schedule' && iv.availabilityPeriod && !isRecommendationLoading) {
        const sessionSpecs = iv.sessions.map((session) => {
          const ids = [
            ...new Set(
              session.rounds.flatMap((round) => iv.interviewersByRound[round as Round] ?? []),
            ),
          ].filter((id) => iv.interviewerIds.includes(id))
          return { interviewerIds: ids }
        })
        const schedules = recommendSchedules(sessionSpecs, iv.availabilities, recommendationReservations)
        if (schedules.length === 0) {
          items.push({
            key: `no-slot-${iv.id}`,
            level: 'danger',
            title: '추천 가능한 일정이 없습니다.',
            description: '회의실 예약이 없거나 면접관 가용 시간과 겹치는 슬롯이 없습니다.',
            interview: iv,
          })
        }
      }
    }

    const order: Record<AttentionLevel, number> = { danger: 0, warning: 1, info: 2 }
    return items.sort((a, b) => order[a.level] - order[b.level])
  }, [interviews, interviewers, positions, recommendationReservations, isRecommendationLoading])

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">{formatToday()}</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="확정된 인터뷰"
          value={isLoading ? '—' : String(allUpcomingConfirmed.length)}
          icon={CalendarCheck}
          color="text-primary bg-primary/10"
        />
        <StatCard
          label="조율 대기"
          value={isLoading ? '—' : String(allPending.length)}
          icon={ClipboardList}
          color="text-blue-600 bg-blue-50"
        />
      </div>

      {/* 주의 필요 */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-foreground">주의 필요</h2>
          <Link href="/scheduling" className="text-xs text-primary hover:underline flex items-center gap-1">
            일정 조율로 이동 <ArrowRight size={11} />
          </Link>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {(isLoading || isRecommendationLoading) && <LoadingRow />}
          {!isLoading && !isRecommendationLoading && attentionItems.length === 0 && (
            <EmptyRow text="현재 막힌 조율 건이 없습니다." />
          )}
          {!isLoading && !isRecommendationLoading && attentionItems.length > 0 && (
            <div className="divide-y divide-border">
              {attentionItems.map((item) => (
                <AttentionRow key={item.key} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 확정된 인터뷰 */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-foreground">확정된 인터뷰</h2>
          <div className="flex items-center gap-1">
            {WEEK_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setWeekFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  weekFilter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading && <LoadingRow />}
          {!isLoading && filteredUpcoming.length === 0 && (
            <EmptyRow
              text={
                weekFilter === 'all'
                  ? '확정된 인터뷰가 없습니다.'
                  : `${weekFilter === 'this_week' ? '이번 주' : '다음 주'}에 확정된 인터뷰가 없습니다.`
              }
            />
          )}
          {!isLoading && filteredUpcoming.length > 0 && (
            <div className="divide-y divide-border">
              {filteredUpcoming.map((iv) => (
                <div key={iv.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4">
                  <div className="w-16 text-base font-bold text-foreground shrink-0">
                    {formatDateKo(iv.confirmedSlot!.date)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{iv.candidateName}</p>
                    <p className="text-sm text-muted-foreground">
                      {iv.positionName} · {iv.typeLabel}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {iv.confirmedSlot!.startTime} ~ {iv.confirmedSlot!.endTime}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <MapPin size={11} className="text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {[...new Set(iv.confirmedSlot!.slots.map((s) => s.roomName))].join(' / ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 조율 대기 */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-foreground">조율 대기</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {PENDING_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPendingFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  pendingFilter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading && <LoadingRow />}
          {!isLoading && filteredPending.length === 0 && (
            <EmptyRow
              text={
                pendingFilter === 'all'
                  ? '조율 대기 중인 인터뷰가 없습니다.'
                  : '해당 상태의 인터뷰가 없습니다.'
              }
            />
          )}
          {!isLoading && filteredPending.length > 0 && (
            <div className="divide-y divide-border">
              {filteredPending.map((iv) => (
                <PendingRow key={iv.id} interview={iv} />
              ))}
            </div>
          )}
        </div>
        {allPending.length > 0 && (
          <div className="mt-2 flex justify-end">
            <Link href="/scheduling" className="text-xs text-primary hover:underline flex items-center gap-1">
              일정 조율 페이지에서 전체 보기 <ArrowRight size={11} />
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const levelClass: Record<AttentionLevel, string> = {
    danger: 'bg-destructive/10 text-destructive',
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-blue-50 text-blue-700',
  }

  return (
    <div className="flex items-start gap-3 px-4 sm:px-5 py-4">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', levelClass[item.level])}>
        <AlertTriangle size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          {item.interview && (
            <span className="text-xs text-muted-foreground">
              {item.interview.candidateName} · {item.interview.positionName}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
      </div>
      <Link href="/scheduling" className="text-xs text-primary hover:underline shrink-0 pt-1">
        처리
      </Link>
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
          <Icon size={18} />
        </div>
        <p className="text-base font-bold text-foreground">{label}</p>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </div>
  )
}

function PendingRow({ interview: iv }: { interview: Interview }) {
  const cfg = STATUS_CONFIG[iv.status]
  const submittedCount = iv.availabilities.length
  const totalCount = iv.interviewerIds.length

  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-4 sm:py-5">
      <span className={cn('inline-flex items-center justify-center text-sm font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap w-[6rem] sm:w-[7.5rem]', cfg.className)}>
        {cfg.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{iv.candidateName}</p>
        <p className="text-sm text-muted-foreground">
          {iv.positionName} · {iv.typeLabel}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {iv.status === 'collecting' && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {Array.from({ length: totalCount }).map((_, i) =>
              i < submittedCount
                ? <CheckCircle2 key={i} size={14} className="text-emerald-500" />
                : <Circle key={i} size={14} className="opacity-30" />,
            )}
            <span className="ml-1">{submittedCount}/{totalCount}</span>
          </div>
        )}
        {iv.status === 'ready_to_schedule' && (
          <Link href="/scheduling" className="text-sm text-primary hover:underline">
            일정 추천 →
          </Link>
        )}
      </div>
    </div>
  )
}

function LoadingRow() {
  return (
    <div className="py-8 flex justify-center">
      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm font-medium text-muted-foreground">{text}</div>
}
