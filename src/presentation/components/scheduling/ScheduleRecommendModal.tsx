'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, Clock, CheckCircle2 } from 'lucide-react'
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

type SortType = 'time' | 'room'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

function normalSlotKey(slot: RecommendedSlot) {
  return `${slot.date}_${slot.startTime}_${slot.reservationId}`
}
function oneDaySlotKey(slot: OneDayRecommendedSlot) {
  return `${slot.date}_${slot.firstRound.startTime}_${slot.firstRound.reservationId}`
}

export default function ScheduleRecommendModal({ open, onOpenChange, interview }: Props) {
  const period = interview.availabilityPeriod
  const confirmSlot = useConfirmSlot()

  const { data: reservations = [], isLoading } = useRoomReservations(
    period?.startDate ?? '',
    period?.endDate ?? '',
  )

  const isOneDay = interview.scheduleType === 'oneday'

  const rawNormalSlots = useMemo(
    () => isOneDay ? [] : recommendSlots(interview.availabilities, reservations, []),
    [isOneDay, interview.availabilities, reservations],
  )

  const rawOneDaySlots = useMemo(
    () => isOneDay ? recommendOneDaySlots(interview.availabilities, interview.availabilities, reservations) : [],
    [isOneDay, interview.availabilities, reservations],
  )

  const [selectedNormal, setSelectedNormal] = useState<RecommendedSlot | null>(null)
  const [selectedOneDay, setSelectedOneDay] = useState<OneDayRecommendedSlot | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortType>('time')

  const normalSlots = useMemo(() => {
    const copy = [...rawNormalSlots]
    return sortBy === 'time'
      ? copy.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      : copy.sort((a, b) => a.roomName.localeCompare(b.roomName) || (a.date + a.startTime).localeCompare(b.date + b.startTime))
  }, [rawNormalSlots, sortBy])

  const oneDaySlots = useMemo(() => {
    const copy = [...rawOneDaySlots]
    return sortBy === 'time'
      ? copy.sort((a, b) => (a.date + a.firstRound.startTime).localeCompare(b.date + b.firstRound.startTime))
      : copy.sort((a, b) => a.roomName.localeCompare(b.roomName) || (a.date + a.firstRound.startTime).localeCompare(b.date + b.firstRound.startTime))
  }, [rawOneDaySlots, sortBy])

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
  const totalCount = isOneDay ? oneDaySlots.length : normalSlots.length

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
              <p className="text-xs">캘린더에 회의실 예약을 먼저 등록하거나, 면접관 가용 일정을 다시 확인해주세요.</p>
            </div>
          )}

          {!isLoading && hasSlots && (
            <>
              {/* 정렬 + 건수 */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">총 {totalCount}개 슬롯</span>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  {(['time', 'room'] as SortType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSortBy(type)}
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

              {/* 슬롯 목록 */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {!isOneDay && normalSlots.map((slot, i) => {
                  const selected = selectedKey === normalSlotKey(slot)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSelectedNormal(slot); setSelectedKey(normalSlotKey(slot)) }}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn('font-semibold', selected ? 'text-primary' : 'text-foreground')}>
                          {formatDate(slot.date)}
                        </span>
                        {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock size={12} className={selected ? 'text-primary' : 'text-muted-foreground'} />
                        <span className={selected ? 'text-primary font-medium' : 'text-muted-foreground'}>
                          {slot.startTime} ~ {slot.endTime}
                        </span>
                        <span className="text-muted-foreground mx-0.5">·</span>
                        <span className="text-muted-foreground">{slot.roomName}</span>
                      </div>
                    </button>
                  )
                })}

                {isOneDay && oneDaySlots.map((slot, i) => {
                  const selected = selectedKey === oneDaySlotKey(slot)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSelectedOneDay(slot); setSelectedKey(oneDaySlotKey(slot)) }}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn('font-semibold', selected ? 'text-primary' : 'text-foreground')}>
                          {formatDate(slot.date)}
                        </span>
                        {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-muted-foreground" />
                          <span className="text-blue-600 font-semibold text-xs">1차</span>
                          <span className={selected ? 'text-primary font-medium' : 'text-muted-foreground'}>
                            {slot.firstRound.startTime} ~ {slot.firstRound.endTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-muted-foreground" />
                          <span className="text-violet-600 font-semibold text-xs">2차</span>
                          <span className={selected ? 'text-primary font-medium' : 'text-muted-foreground'}>
                            {slot.secondRound.startTime} ~ {slot.secondRound.endTime}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground mt-0.5">· {slot.roomName}</span>
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
