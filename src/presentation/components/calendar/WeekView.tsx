'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Room, RoomReservation, ReservationStatus } from '@/domain/model/Room'
import RoomManageModal from './RoomManageModal'

const STATUS_PILL: Record<ReservationStatus, string> = {
  reserved:    'bg-amber-100 text-amber-700 border border-amber-200',
  coordinating:'bg-blue-100 text-blue-700 border border-blue-200',
  confirmed:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
}
const STATUS_LABEL: Record<ReservationStatus, string> = {
  reserved:    '예약됨',
  coordinating:'조율중',
  confirmed:   '확정',
}
const STATUS_DOT: Record<ReservationStatus, string> = {
  reserved:    'bg-amber-400',
  coordinating:'bg-blue-400',
  confirmed:   'bg-emerald-400',
}

interface Props {
  days: Date[]
  rooms: Room[]
  reservations: RoomReservation[]
  weekStart: Date
  onWeekChange: (date: Date) => void
  onDayClick: (date: Date) => void
  onCreateDraft: (draft: { roomId: string; date: string; startTime: string; endTime: string }) => void
  onEditReservation: (reservation: RoomReservation) => void
}

export default function WeekView({
  days,
  rooms,
  reservations,
  weekStart,
  onWeekChange,
  onDayClick,
  onCreateDraft,
  onEditReservation,
}: Props) {
  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  function getCellRes(roomId: string, dateStr: string) {
    return reservations.filter((r) => r.roomId === roomId && r.date === dateStr)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        {/* 주간 네비게이션 */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onWeekChange(subWeeks(weekStart, 1))}>
            <ChevronLeft size={15} />
          </Button>
          <span className="text-sm font-semibold min-w-[210px] text-center">
            {format(days[0], 'yyyy년 M월 d일', { locale: ko })}
            {' – '}
            {format(days[4], 'M월 d일', { locale: ko })}
          </span>
          <Button variant="outline" size="sm" onClick={() => onWeekChange(addWeeks(weekStart, 1))}>
            <ChevronRight size={15} />
          </Button>
          <Button
            size="sm"
            onClick={() => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            오늘
          </Button>
        </div>

        {/* 범례 + 안내 (오늘 버튼 바로 오른쪽) */}
        <div className="flex items-center gap-3 flex-1">
          <span className="text-muted-foreground/40 text-sm">|</span>
          {(Object.keys(STATUS_LABEL) as ReservationStatus[]).map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', STATUS_DOT[status])} />
              <span className="text-sm text-muted-foreground">{STATUS_LABEL[status]}</span>
            </div>
          ))}
          <span className="text-sm text-muted-foreground/60 hidden lg:inline">
            · 날짜를 클릭하면 상세 뷰로 이동합니다
          </span>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRoomModalOpen(true)}>
            <Settings2 size={14} />
            회의실 관리
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onCreateDraft({
                roomId: rooms[0]?.id ?? '',
                date: todayStr,
                startTime: '10:00',
                endTime: '11:00',
              })
            }
          >
            <Plus size={14} />
            예약 추가
          </Button>
        </div>
      </div>

      {/* 주간 그리드 */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* 요일/날짜 헤더 */}
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: '110px repeat(5, 1fr)' }}
        >
          <div className="px-3 py-3 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center">
            회의실
          </div>
          {days.map((d) => {
            const dStr = format(d, 'yyyy-MM-dd')
            const isToday = dStr === todayStr
            return (
              <button
                key={dStr}
                onClick={() => onDayClick(d)}
                className={cn(
                  'px-3 py-3 text-center border-l border-border transition-colors',
                  isToday
                    ? 'bg-primary/8 hover:bg-primary/12'
                    : 'bg-muted/40 hover:bg-muted/70',
                )}
              >
                <p className={cn('text-xs font-semibold', isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {format(d, 'EEE', { locale: ko })}
                </p>
                <p className={cn('text-lg font-bold mt-0.5', isToday ? 'text-primary' : 'text-foreground')}>
                  {format(d, 'd')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(d, 'M/d')}
                </p>
              </button>
            )
          })}
        </div>

        {/* 회의실 행 */}
        {rooms.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">불러오는 중...</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="grid"
                style={{ gridTemplateColumns: '110px repeat(5, 1fr)' }}
              >
                <div className="flex items-start px-3 py-3 bg-muted/10 border-r border-border min-h-[96px]">
                  <span className="text-xs font-semibold text-foreground leading-tight pt-0.5">
                    {room.name}
                  </span>
                </div>
                {days.map((d) => {
                  const dStr = format(d, 'yyyy-MM-dd')
                  const isToday = dStr === todayStr
                  const cellRes = getCellRes(room.id, dStr)
                  return (
                    <div
                      key={dStr}
                      className={cn(
                        'border-l border-border px-1.5 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors min-h-[96px]',
                        isToday && 'bg-primary/3',
                      )}
                      onClick={() => onDayClick(d)}
                    >
                      <div className="flex flex-col gap-1">
                        {cellRes.slice(0, 3).map((res) => (
                          <div
                            key={res.id}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate cursor-pointer',
                              STATUS_PILL[res.status],
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditReservation(res)
                            }}
                          >
                            {res.startTime}–{res.endTime}
                          </div>
                        ))}
                        {cellRes.length > 3 && (
                          <span className="text-[10px] font-semibold text-muted-foreground pl-1">
                            +{cellRes.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 회의실 관리 모달 */}
      <RoomManageModal
        open={roomModalOpen}
        onOpenChange={setRoomModalOpen}
        rooms={rooms}
      />
    </div>
  )
}
