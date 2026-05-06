'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, LayoutGrid, Plus } from 'lucide-react'
import { format, addDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Room, RoomReservation, ReservationStatus } from '@/domain/model/Room'
import { hasTimeOverlap } from '@/lib/reservationUtils'

// 09:00 ~ 18:00
const DAY_START = 9 * 60
const DAY_END   = 18 * 60
const DAY_RANGE = DAY_END - DAY_START

// 표시할 시간 눈금: 09 ~ 18 (매 정시)
const HOURS = Array.from({ length: 10 }, (_, i) => 9 + i)

const STATUS_STYLE: Record<ReservationStatus, { block: string; text: string }> = {
  reserved:    { block: 'bg-amber-100 border-amber-300',   text: 'text-amber-800'   },
  coordinating:{ block: 'bg-blue-100 border-blue-300',     text: 'text-blue-800'    },
  confirmed:   { block: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-800' },
}
const STATUS_LABEL: Record<ReservationStatus, string> = {
  reserved:    '예약됨',
  coordinating:'조율중',
  confirmed:   '확정',
}

function minsToTime(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`
}

function minsToPct(mins: number): number {
  return ((mins - DAY_START) / DAY_RANGE) * 100
}

function pxToMins(pxOffset: number, cellWidth: number): number {
  const raw = Math.round(((pxOffset / cellWidth) * DAY_RANGE + DAY_START) / 30) * 30
  return Math.max(DAY_START, Math.min(DAY_END, raw))
}

interface DragState {
  roomId: string
  startMins: number
  currentMins: number
}

interface Props {
  date: Date
  rooms: Room[]
  reservations: RoomReservation[]
  /** interviewId → 후보자명 맵 */
  interviewMap: Record<string, string>
  onDateChange: (date: Date) => void
  onWeekView: () => void
  onCreateDraft: (draft: { roomId: string; date: string; startTime: string; endTime: string }) => void
  onEditReservation: (reservation: RoomReservation) => void
}

export default function DayView({
  date,
  rooms,
  reservations,
  interviewMap,
  onDateChange,
  onWeekView,
  onCreateDraft,
  onEditReservation,
}: Props) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const dayRes = reservations.filter((r) => r.date === dateStr)
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

  const [drag, setDrag] = useState<DragState | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!drag) return
      const row = rowRefs.current.get(drag.roomId)
      if (!row) return
      const rect = row.getBoundingClientRect()
      const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      setDrag((prev) => (prev ? { ...prev, currentMins: pxToMins(offsetX, rect.width) } : null))
    },
    [drag],
  )

  const handleMouseUp = useCallback(() => {
    if (!drag) return
    const start = Math.min(drag.startMins, drag.currentMins)
    const end = Math.max(drag.startMins, drag.currentMins)
    if (end - start >= 30) {
      const startTime = minsToTime(start)
      const endTime = minsToTime(end)
      if (hasTimeOverlap(reservations, drag.roomId, dateStr, startTime, endTime)) {
        toast.error('해당 시간에 이미 예약이 있습니다.')
      } else {
        onCreateDraft({ roomId: drag.roomId, date: dateStr, startTime, endTime })
      }
    }
    setDrag(null)
  }, [drag, dateStr, reservations, onCreateDraft])

  useEffect(() => {
    if (!drag) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, handleMouseMove, handleMouseUp])

  function handleRowMouseDown(e: React.MouseEvent<HTMLDivElement>, roomId: string) {
    e.preventDefault()
    const row = rowRefs.current.get(roomId)
    if (!row) return
    const rect = row.getBoundingClientRect()
    const startMins = pxToMins(e.clientX - rect.left, rect.width)
    setDrag({ roomId, startMins, currentMins: startMins })
  }

  const isDragging = (roomId: string) => drag?.roomId === roomId
  const dragStart = drag ? Math.min(drag.startMins, drag.currentMins) : 0
  const dragEnd   = drag ? Math.max(drag.startMins, drag.currentMins) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        {/* 주간보기 버튼 */}
        <Button variant="ghost" size="sm" onClick={onWeekView} className="gap-1.5 text-muted-foreground">
          <LayoutGrid size={14} />
          주간 보기
        </Button>

        {/* 날짜 네비게이션 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onDateChange(subDays(date, 1))}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[220px]">
            <span className={cn('text-xl font-bold', isToday && 'text-primary')}>
              {format(date, 'yyyy년 M월 d일', { locale: ko })}
            </span>
            <span className={cn('ml-2 text-base font-medium', isToday ? 'text-primary' : 'text-muted-foreground')}>
              ({format(date, 'EEE', { locale: ko })})
            </span>
          </div>
          <button
            onClick={() => onDateChange(addDays(date, 1))}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <Button size="sm" onClick={() => onDateChange(new Date())}>
            오늘
          </Button>
        </div>

        {/* 예약 추가 */}
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() =>
            onCreateDraft({
              roomId: rooms[0]?.id ?? '',
              date: dateStr,
              startTime: '10:00',
              endTime: '11:00',
            })
          }
        >
          <Plus size={14} />
          예약 추가
        </Button>
      </div>

      {/* 캘린더 그리드 (CalendarEX 스타일) */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* 시간 헤더 행 */}
        <div
          className="grid border-b border-border bg-muted/40"
          style={{ gridTemplateColumns: '110px 1fr' }}
        >
          <div className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center border-r border-border">
            회의실
          </div>
          {/* 시간축 */}
          <div className="relative" style={{ height: 36 }}>
            {HOURS.map((h) => {
              const pct = ((h * 60 - DAY_START) / DAY_RANGE) * 100
              return (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 border-l border-border/50"
                  style={{ left: `${pct}%` }}
                >
                  <span className="absolute top-2 left-1 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                    {h.toString().padStart(2, '0')}:00
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 회의실 행 */}
        {rooms.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">불러오는 중...</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rooms.map((room) => {
              const roomRes = dayRes.filter((r) => r.roomId === room.id)
              const dragging = isDragging(room.id)

              return (
                <div
                  key={room.id}
                  className="grid"
                  style={{ gridTemplateColumns: '110px 1fr' }}
                >
                  {/* 회의실명 */}
                  <div className="flex items-center px-3 py-0 bg-muted/10 border-r border-border">
                    <span className="text-xs font-semibold text-foreground">{room.name}</span>
                  </div>

                  {/* 타임라인 셀 */}
                  <div
                    ref={(el) => {
                      if (el) rowRefs.current.set(room.id, el)
                      else rowRefs.current.delete(room.id)
                    }}
                    className="relative select-none cursor-crosshair"
                    style={{ height: 88 }}
                    onMouseDown={(e) => handleRowMouseDown(e, room.id)}
                  >
                    {/* 시간 구분선 */}
                    {HOURS.map((h) => {
                      const pct = ((h * 60 - DAY_START) / DAY_RANGE) * 100
                      return (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-border/30 pointer-events-none"
                          style={{ left: `${pct}%` }}
                        />
                      )
                    })}

                    {/* 예약 블록 */}
                    {roomRes.map((res) => {
                      const [sh, sm] = res.startTime.split(':').map(Number)
                      const [eh, em] = res.endTime.split(':').map(Number)
                      const startMins = sh * 60 + sm
                      const endMins   = eh * 60 + em
                      const leftPct   = minsToPct(startMins)
                      const widthPct  = ((endMins - startMins) / DAY_RANGE) * 100
                      const style     = STATUS_STYLE[res.status]
                      const candidateName = res.interviewId ? interviewMap[res.interviewId] : null

                      return (
                        <div
                          key={res.id}
                          className={cn(
                            'absolute top-2 bottom-2 rounded-md border cursor-pointer hover:brightness-95 transition-all overflow-hidden z-10',
                            style.block,
                          )}
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(widthPct, 0.8)}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditReservation(res)
                          }}
                        >
                          <div className="px-2 py-1 h-full flex flex-col justify-center overflow-hidden">
                            <p className={cn('text-xs font-semibold leading-tight truncate', style.text)}>
                              {res.startTime} ~ {res.endTime}
                            </p>
                            <p className={cn('text-[10px] leading-tight truncate opacity-80', style.text)}>
                              {candidateName ?? STATUS_LABEL[res.status]}
                            </p>
                          </div>
                        </div>
                      )
                    })}

                    {/* 드래그 미리보기 — 실제 저장 기준(30분)과 동일하게 */}
                    {dragging && dragEnd - dragStart >= 30 && (
                      <div
                        className="absolute top-2 bottom-2 rounded-md border border-primary/50 bg-primary/15 pointer-events-none z-20"
                        style={{
                          left: `${minsToPct(dragStart)}%`,
                          width: `${((dragEnd - dragStart) / DAY_RANGE) * 100}%`,
                        }}
                      >
                        <p className="text-[10px] font-semibold text-primary px-2 mt-1 leading-tight">
                          {minsToTime(dragStart)} ~ {minsToTime(dragEnd)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground/60">
        · 타임라인을 드래그하여 예약을 추가할 수 있습니다
      </p>
    </div>
  )
}
