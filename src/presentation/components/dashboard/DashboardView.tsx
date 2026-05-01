'use client'

import Link from 'next/link'
import { CalendarCheck, ClipboardList, Users, Briefcase, ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Interview, InterviewStatus } from '@/domain/model/Interview'
import { useInterviews } from '@/application/usecase/interview/useInterviews'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { usePositions } from '@/application/usecase/position/usePositions'

const SCHEDULE_LABEL: Record<string, string> = {
  '1차': '1차', '2차': '2차', '3차': '3차', oneday: '원데이',
}

const STATUS_CONFIG: Record<InterviewStatus, { label: string; className: string }> = {
  pending_slack: { label: '슬랙 발송 전', className: 'bg-muted text-muted-foreground' },
  collecting:    { label: '수집 중',       className: 'bg-blue-50 text-blue-700' },
  ready_to_schedule: { label: '일정 추천 가능', className: 'bg-emerald-50 text-emerald-700' },
  confirmed:     { label: '확정',          className: 'bg-primary/10 text-primary' },
}

/** 이번 주 월~금 범위 반환 */
function getThisWeekRange(): { start: string; end: string } {
  const today = new Date()
  const day = today.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(today)
  mon.setDate(today.getDate() + diffToMon)
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start: fmt(mon), end: fmt(fri) }
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

export default function DashboardView() {
  const { data: interviews = [], isLoading } = useInterviews()
  const { data: interviewers = [] } = useInterviewers()
  const { data: positions = [] } = usePositions()

  const { start, end } = getThisWeekRange()

  const thisWeekConfirmed = interviews
    .filter((iv) => iv.status === 'confirmed' && iv.confirmedSlot)
    .filter((iv) => iv.confirmedSlot!.date >= start && iv.confirmedSlot!.date <= end)
    .sort((a, b) => {
      const da = a.confirmedSlot!.date + a.confirmedSlot!.startTime
      const db = b.confirmedSlot!.date + b.confirmedSlot!.startTime
      return da.localeCompare(db)
    })

  const pending = interviews.filter((iv) =>
    iv.status === 'pending_slack' || iv.status === 'collecting' || iv.status === 'ready_to_schedule',
  )

  const stats = [
    {
      label: '이번 주 확정 면접',
      value: thisWeekConfirmed.length,
      icon: CalendarCheck,
      color: 'text-primary bg-primary/10',
    },
    {
      label: '조율 중인 건',
      value: pending.length,
      icon: ClipboardList,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: '등록된 면접관',
      value: interviewers.length,
      icon: Users,
      color: 'text-violet-600 bg-violet-50',
    },
    {
      label: '활성 포지션',
      value: positions.length,
      icon: Briefcase,
      color: 'text-orange-600 bg-orange-50',
    },
  ]

  return (
    <div className="max-w-3xl space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">{formatToday()}</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', s.color)}>
              <s.icon size={16} />
            </div>
            <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 이번 주 확정 면접 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">이번 주 확정 면접</h2>
          <span className="text-xs text-muted-foreground">{start} ~ {end}</span>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading && <LoadingRow />}
          {!isLoading && thisWeekConfirmed.length === 0 && (
            <EmptyRow text="이번 주 확정된 면접이 없습니다." />
          )}
          {!isLoading && thisWeekConfirmed.length > 0 && (
            <div className="divide-y divide-border">
              {thisWeekConfirmed.map((iv) => (
                <div key={iv.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-16 text-xs font-semibold text-primary shrink-0">
                    {formatDateKo(iv.confirmedSlot!.date)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{iv.candidateName}</p>
                    <p className="text-xs text-muted-foreground">
                      {iv.positionName} · {SCHEDULE_LABEL[iv.scheduleType]}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-foreground">
                      {iv.confirmedSlot!.startTime} ~ {iv.confirmedSlot!.endTime}
                    </p>
                    <p className="text-xs text-muted-foreground">{iv.confirmedSlot!.roomName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 조율 대기 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">조율 대기</h2>
          {pending.length > 0 && (
            <Link href="/scheduling" className="text-xs text-primary hover:underline flex items-center gap-1">
              전체 보기 <ArrowRight size={11} />
            </Link>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading && <LoadingRow />}
          {!isLoading && pending.length === 0 && (
            <EmptyRow text="조율 대기 중인 면접이 없습니다." />
          )}
          {!isLoading && pending.length > 0 && (
            <div className="divide-y divide-border">
              {pending.map((iv) => (
                <PendingRow key={iv.id} interview={iv} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function PendingRow({ interview: iv }: { interview: Interview }) {
  const cfg = STATUS_CONFIG[iv.status]
  const submittedCount = iv.availabilities.length
  const totalCount = iv.interviewerIds.length

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', cfg.className)}>
        {cfg.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{iv.candidateName}</p>
        <p className="text-xs text-muted-foreground">
          {iv.positionName} · {SCHEDULE_LABEL[iv.scheduleType]}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {iv.status === 'collecting' && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {Array.from({ length: totalCount }).map((_, i) =>
              i < submittedCount
                ? <CheckCircle2 key={i} size={12} className="text-emerald-500" />
                : <Circle key={i} size={12} className="opacity-30" />,
            )}
            <span className="ml-1">{submittedCount}/{totalCount}</span>
          </div>
        )}
        {iv.status === 'ready_to_schedule' && (
          <Link href="/scheduling" className="text-xs text-primary hover:underline">
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
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">{text}</div>
  )
}
