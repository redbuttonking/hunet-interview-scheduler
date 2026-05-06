'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, Clock, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Interview } from '@/domain/model/Interview'
import { Round } from '@/domain/model/Position'
import { useConfirmSchedule } from '@/application/usecase/interview/useInterviews'
import { useRecommendedSchedules, RecommendedSchedule } from '@/application/usecase/interview/useScheduleRecommendation'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
}

type SortType = 'time' | 'room'

const ROUND_COLORS: Record<Round, string> = {
  '1차': 'text-blue-600',
  '2차': 'text-violet-600',
  '3차': 'text-orange-600',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

function sessionLabel(rounds: Round[]): string {
  return rounds.join('+')
}

export default function ScheduleRecommendModal({ open, onOpenChange, interview }: Props) {
  const confirmSchedule = useConfirmSchedule()
  const { schedules: rawSchedules, isLoading } = useRecommendedSchedules(interview)

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortType>('time')

  const schedules = useMemo(() => {
    const copy = [...rawSchedules]
    return sortBy === 'time'
      ? copy.sort((a, b) => (a.date + a.slots[0].startTime).localeCompare(b.date + b.slots[0].startTime))
      : copy.sort((a, b) => a.slots[0].roomName.localeCompare(b.slots[0].roomName) || (a.date + a.slots[0].startTime).localeCompare(b.date + b.slots[0].startTime))
  }, [rawSchedules, sortBy])

  const selectedSchedule: RecommendedSchedule | null = selectedIndex !== null ? schedules[selectedIndex] ?? null : null

  async function handleConfirm() {
    if (!selectedSchedule) return toast.error('슬롯을 선택해주세요.')
    try {
      await confirmSchedule.mutateAsync({ interviewId: interview.id, schedule: selectedSchedule })
      toast.success('인터뷰 일정이 확정되었습니다.')
      onOpenChange(false)
    } catch {
      toast.error('확정 중 오류가 발생했습니다.')
    }
  }

  const isSingleSession = interview.sessions.length === 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>일정 추천</DialogTitle>
          <DialogDescription>
            {interview.candidateName} · {interview.positionName} · {interview.typeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {isLoading && (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-sm">예약 슬롯 불러오는 중...</span>
            </div>
          )}

          {!isLoading && schedules.length === 0 && (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground text-center">
              <CalendarCheck size={28} className="opacity-40" />
              <p className="text-sm font-medium text-foreground">추천 가능한 슬롯이 없습니다</p>
              <p className="text-xs">캘린더에 회의실 예약을 먼저 등록하거나, 면접관 가용 일정을 다시 확인해주세요.</p>
            </div>
          )}

          {!isLoading && schedules.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">총 {schedules.length}개 슬롯</span>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  {(['time', 'room'] as SortType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setSortBy(type); setSelectedIndex(null) }}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                        sortBy === type
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {type === 'time' ? '시간순' : '회의실순'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {schedules.map((schedule, i) => {
                  const selected = selectedIndex === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedIndex(i)}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn('font-semibold', selected ? 'text-primary' : 'text-foreground')}>
                          {formatDate(schedule.date)}
                        </span>
                        {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                      </div>

                      <div className="flex flex-col gap-0.5 mt-1">
                        {schedule.slots.map((slot, si) => {
                          const sessionRounds = interview.sessions[si]?.rounds ?? []
                          return (
                            <div key={si} className="flex items-center gap-1.5">
                              <Clock size={12} className="text-muted-foreground shrink-0" />
                              {!isSingleSession && (
                                <span className={cn('font-semibold text-xs shrink-0', sessionRounds.length > 0 ? (ROUND_COLORS[sessionRounds[0] as Round] ?? 'text-muted-foreground') : 'text-muted-foreground')}>
                                  {sessionLabel(sessionRounds as Round[])}
                                </span>
                              )}
                              <span className={selected ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                {slot.startTime} ~ {slot.endTime}
                              </span>
                              <span className="text-muted-foreground text-xs">· {slot.roomName}</span>
                            </div>
                          )
                        })}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
          {schedules.length > 0 && (
            <Button
              onClick={handleConfirm}
              disabled={confirmSchedule.isPending || selectedSchedule === null}
            >
              {confirmSchedule.isPending ? '확정 중...' : '일정 확정'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
