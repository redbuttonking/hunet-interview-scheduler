'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Interview } from '@/domain/model/Interview'
import { useRoomReservations } from '@/application/usecase/room/useRoomReservations'
import { useConfirmSlot } from '@/application/usecase/interview/useInterviews'
import {
  recommendSlots,
  recommendOneDaySlots,
  RecommendedSlot,
  OneDayRecommendedSlot,
} from '@/domain/service/ScheduleRecommendService'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

export default function ScheduleRecommendModal({ open, onOpenChange, interview }: Props) {
  const period = interview.availabilityPeriod
  const confirmSlot = useConfirmSlot()

  const { data: reservations = [], isLoading } = useRoomReservations(
    period?.startDate ?? '',
    period?.endDate ?? '',
  )

  const isOneDay = interview.scheduleType === 'oneday'

  const normalSlots: RecommendedSlot[] = isOneDay
    ? []
    : recommendSlots(interview.availabilities, reservations, [])

  const oneDaySlots: OneDayRecommendedSlot[] = isOneDay
    ? recommendOneDaySlots(interview.availabilities, interview.availabilities, reservations)
    : []

  const [selectedNormal, setSelectedNormal] = useState<RecommendedSlot | null>(null)
  const [selectedOneDay, setSelectedOneDay] = useState<OneDayRecommendedSlot | null>(null)

  async function handleConfirm() {
    if (!isOneDay && !selectedNormal) return toast.error('슬롯을 선택해주세요.')
    if (isOneDay && !selectedOneDay) return toast.error('슬롯을 선택해주세요.')

    try {
      if (isOneDay && selectedOneDay) {
        await confirmSlot.mutateAsync({ interviewId: interview.id, slot: { oneDaySlot: selectedOneDay } })
      } else if (selectedNormal) {
        await confirmSlot.mutateAsync({ interviewId: interview.id, slot: selectedNormal })
      }
      toast.success('면접 일정이 확정되었습니다.')
      onOpenChange(false)
    } catch {
      toast.error('확정 중 오류가 발생했습니다.')
    }
  }

  const hasSlots = isOneDay ? oneDaySlots.length > 0 : normalSlots.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>일정 추천</DialogTitle>
          <DialogDescription>
            {interview.candidateName} · {interview.positionName} · {interview.scheduleType}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {isLoading && (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-sm">예약 슬롯 불러오는 중...</span>
            </div>
          )}

          {!isLoading && !hasSlots && (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground text-center">
              <CalendarCheck size={28} className="opacity-40" />
              <p className="text-sm font-medium text-foreground">추천 가능한 슬롯이 없습니다</p>
              <p className="text-xs">
                캘린더에 회의실 예약을 먼저 등록하거나, 면접관 가용 일정을 다시 확인해주세요.
              </p>
            </div>
          )}

          {!isLoading && !isOneDay && normalSlots.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {normalSlots.map((slot, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedNormal(slot)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors',
                    selectedNormal === slot
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <div className="font-medium">{formatDate(slot.date)}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                    <Clock size={12} />
                    {slot.startTime} ~ {slot.endTime}
                    <span className="mx-1">·</span>
                    {slot.roomName}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && isOneDay && oneDaySlots.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {oneDaySlots.map((slot, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedOneDay(slot)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors',
                    selectedOneDay === slot
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <div className="font-medium">{formatDate(slot.date)}</div>
                  <div className="flex flex-col gap-0.5 text-muted-foreground mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} />
                      <span className="text-blue-600 font-medium text-xs">1차</span>
                      {slot.firstRound.startTime} ~ {slot.firstRound.endTime}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} />
                      <span className="text-violet-600 font-medium text-xs">2차</span>
                      {slot.secondRound.startTime} ~ {slot.secondRound.endTime}
                    </div>
                    <div className="mt-0.5">· {slot.roomName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
          {hasSlots && (
            <Button
              onClick={handleConfirm}
              disabled={confirmSlot.isPending || (!selectedNormal && !selectedOneDay)}
            >
              {confirmSlot.isPending ? '확정 중...' : '일정 확정'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
