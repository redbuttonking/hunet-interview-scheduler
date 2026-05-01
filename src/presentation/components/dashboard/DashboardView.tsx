'use client'

import Link from 'next/link'
import { CalendarCheck, ClipboardList, ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Interview, InterviewStatus } from '@/domain/model/Interview'
import { useInterviews } from '@/application/usecase/interview/useInterviews'


const STATUS_CONFIG: Record<InterviewStatus, { label: string; className: string }> = {
  pending_slack:     { label: '슬랙 발송 전',   className: 'bg-muted text-muted-foreground' },
  collecting:        { label: '수집 중',         className: 'bg-blue-50 text-blue-700' },
  ready_to_schedule: { label: '일정 추천 가능',  className: 'bg-emerald-50 text-emerald-700' },
  confirmed:         { label: '확정',            className: 'bg-primary/10 text-primary' },
}

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

export default function DashboardView() {
  const { data: interviews = [], isLoading } = useInterviews()

  const today = localDateStr()

  // 오늘 이후 확정된 면접, 날짜/시간 오름차순
  const upcomingConfirmed = interviews
    .filter((iv) => iv.status === 'confirmed' && iv.confirmedSlot && iv.confirmedSlot.date >= today)
    .sort((a, b) => {
      const da = a.confirmedSlot!.date + a.confirmedSlot!.startTime
      const db = b.confirmedSlot!.date + b.confirmedSlot!.startTime
      return da.localeCompare(db)
    })

  const pending = interviews.filter(
    (iv) => iv.status === 'pending_slack' || iv.status === 'collecting' || iv.status === 'ready_to_schedule',
  )

  return (
    <div className="max-w-3xl space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">{formatToday()}</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="예정된 인터뷰"
          value={isLoading ? '—' : String(upcomingConfirmed.length)}
          icon={CalendarCheck}
          color="text-primary bg-primary/10"
        />
        <StatCard
          label="조율 대기"
          value={isLoading ? '—' : String(pending.length)}
          icon={ClipboardList}
          color="text-blue-600 bg-blue-50"
        />
      </div>

      {/* 예정된 인터뷰 목록 */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">예정된 인터뷰</h2>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading && <LoadingRow />}
          {!isLoading && upcomingConfirmed.length === 0 && (
            <EmptyRow text="예정된 인터뷰가 없습니다." />
          )}
          {!isLoading && upcomingConfirmed.length > 0 && (
            <div className="divide-y divide-border">
              {upcomingConfirmed.map((iv) => (
                <div key={iv.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-16 text-xs font-semibold text-primary shrink-0">
                    {formatDateKo(iv.confirmedSlot!.date)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{iv.candidateName}</p>
                    <p className="text-xs text-muted-foreground">
                      {iv.positionName} · {iv.typeLabel}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-foreground">
                      {iv.confirmedSlot!.startTime} ~ {iv.confirmedSlot!.endTime}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {iv.confirmedSlot!.slots?.length
                        ? [...new Set(iv.confirmedSlot!.slots.map((s) => s.roomName))].join(' / ')
                        : (iv.confirmedSlot as unknown as { roomName: string }).roomName}
                    </p>
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
            <EmptyRow text="조율 대기 중인 인터뷰가 없습니다." />
          )}
          {!isLoading && pending.length > 0 && (
            <div className="divide-y divide-border">
              {pending.map((iv) => <PendingRow key={iv.id} interview={iv} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', color)}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
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
          {iv.positionName} · {iv.typeLabel}
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
  return <div className="py-8 text-center text-xs text-muted-foreground">{text}</div>
}
