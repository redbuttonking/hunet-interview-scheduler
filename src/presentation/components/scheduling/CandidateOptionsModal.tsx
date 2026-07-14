'use client'

// 후보자에게 발송할 일정 옵션 선택 모달
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, Clock, CheckSquare, Square } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Interview } from '@/domain/model/Interview'
import { Round } from '@/domain/model/Position'
import { useProposeCandidateOptions } from '@/application/usecase/interview/useInterviews'
import { useRecommendedSchedules, RecommendedSchedule } from '@/application/usecase/interview/useScheduleRecommendation'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
}

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

export default function CandidateOptionsModal({ open, onOpenChange, interview }: Props) {
  const proposeOptions = useProposeCandidateOptions()
  const { schedules, isLoading } = useRecommendedSchedules(interview)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const sorted = useMemo(
    () => [...schedules].sort((a, b) =>
      (a.date + a.slots[0].startTime).localeCompare(b.date + b.slots[0].startTime),
    ),
    [schedules],
  )

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function handlePropose() {
    if (selected.size === 0) return toast.error('옵션을 1개 이상 선택해주세요.')
    const options = [...selected].map((i) => {
      const s = sorted[i] as RecommendedSchedule
      return {
        date: s.date,
        slots: s.slots.map((slot) => ({
          reservationId: slot.reservationId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomId: slot.roomId,
          roomName: slot.roomName,
        })),
      }
    })
    try {
      await proposeOptions.mutateAsync({ interviewId: interview.id, options })
      toast.success(`${selected.size}개 일정을 조율중으로 변경했습니다.`)
      onOpenChange(false)
    } catch {
      toast.error('처리 중 오류가 발생했습니다.')
    }
  }

  const isSingleSession = interview.sessions.length === 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>조율 일정 선택</DialogTitle>
          <DialogDescription>
            {interview.candidateName} · {interview.positionName} · {interview.typeLabel}
            <br />
            조율할 일정을 선택해주세요. 선택한 회의실은 조율중 상태로 변경됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-1">
          {isLoading && (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-sm">슬롯 불러오는 중...</span>
            </div>
          )}

          {!isLoading && sorted.length === 0 && (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground text-center">
              <CalendarCheck size={28} className="opacity-40" />
              <p className="text-sm font-medium text-foreground">추천 가능한 슬롯이 없습니다</p>
              <p className="text-xs">캘린더에 회의실 예약을 먼저 등록하거나, 면접관 가용 일정을 확인해주세요.</p>
            </div>
          )}

          {!isLoading && sorted.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mb-3">총 {sorted.length}개 슬롯 · {selected.size}개 선택됨</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {sorted.map((schedule, i) => {
                  const isSelected = selected.has(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggle(i)}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                        isSelected
                          ? 'border-foreground bg-muted/70 shadow-sm ring-1 ring-foreground/10'
                          : 'border-border hover:border-foreground/30 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {formatDate(schedule.date)}
                        </span>
                        {isSelected
                          ? <CheckSquare size={16} className="text-foreground shrink-0" />
                          : <Square size={16} className="text-muted-foreground/40 shrink-0" />
                        }
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {schedule.slots.map((slot, si) => {
                          const rounds = interview.sessions[si]?.rounds ?? []
                          return (
                            <div key={si} className="flex items-center gap-1.5">
                              <Clock size={12} className="text-muted-foreground shrink-0" />
                              {!isSingleSession && rounds.length > 0 && (
                                <span className={cn('font-semibold text-xs shrink-0', ROUND_COLORS[rounds[0] as Round] ?? 'text-muted-foreground')}>
                                  {rounds.join('+')}
                                </span>
                              )}
                              <span className={isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}>
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
          {sorted.length > 0 && (
            <Button
              onClick={handlePropose}
              disabled={proposeOptions.isPending || selected.size === 0}
            >
              {proposeOptions.isPending ? '처리 중...' : `${selected.size}개 조율중으로 변경`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
