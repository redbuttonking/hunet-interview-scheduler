'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/ui/date-picker'
import { TimeSelectField } from '@/components/ui/time-select'
import { cn } from '@/lib/utils'
import { RoomReservation, ReservationStatus } from '@/domain/model/Room'
import { Room } from '@/domain/model/Room'

const STATUS_OPTIONS: { value: ReservationStatus; label: string; color: string }[] = [
  { value: 'reserved', label: '예약됨', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'coordinating', label: '조율중', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'confirmed', label: '확정', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
]

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function timeToMins(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rooms: Room[]
  /** null = 신규 생성 */
  reservation: RoomReservation | null
  /** 드래그로 미리 채워진 초기값 */
  draft: {
    roomId: string
    date: string
    startTime: string
    endTime: string
  } | null
  /** 확정 인터뷰 예약일 때 표시할 후보자명 */
  candidateName?: string
  onSave: (data: {
    roomId: string
    roomName: string
    date: string
    startTime: string
    endTime: string
    status: ReservationStatus
    interviewId: string | null
  }) => Promise<void>
  onDelete: () => Promise<void>
  isSaving: boolean
  isDeleting: boolean
}

export default function ReservationModal({
  open,
  onOpenChange,
  rooms,
  reservation,
  draft,
  candidateName,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: Props) {
  const isEdit = reservation !== null
  const isConfirmedInterview = isEdit && !!reservation.interviewId && reservation.status === 'confirmed'

  const [roomId, setRoomId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [status, setStatus] = useState<ReservationStatus>('reserved')

  useEffect(() => {
    if (!open) return
    if (reservation) {
      setRoomId(reservation.roomId)
      setDate(reservation.date)
      setStartTime(reservation.startTime)
      setEndTime(reservation.endTime)
      setStatus(reservation.status)
    } else if (draft) {
      setRoomId(draft.roomId)
      setDate(draft.date)
      setStartTime(draft.startTime)
      setEndTime(draft.endTime)
      setStatus('reserved')
    } else {
      setRoomId(rooms[0]?.id ?? '')
      setDate('')
      setStartTime('09:00')
      setEndTime('10:00')
      setStatus('reserved')
    }
  }, [open, reservation, draft, rooms])

  function roundToHalfHour(time: string): string {
    const mins = timeToMins(time)
    const rounded = Math.round(mins / 30) * 30
    return minsToTime(Math.min(rounded, 18 * 60))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // 30분 단위로 정규화 (HTML step 속성은 직접 입력 시 우회 가능)
    const normalizedStart = roundToHalfHour(startTime)
    const normalizedEnd = roundToHalfHour(endTime)
    const startMins = timeToMins(normalizedStart)
    const endMins = timeToMins(normalizedEnd)
    if (endMins <= startMins) {
      toast.error('종료 시간이 시작 시간보다 늦어야 합니다.')
      return
    }
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return
    await onSave({
      roomId,
      roomName: room.name,
      date,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      status,
      interviewId: reservation?.interviewId ?? null,
    })
  }

  const isPending = isSaving || isDeleting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? '예약 수정' : '예약 추가'}</DialogTitle>
        </DialogHeader>

        {/* 확정 인터뷰 안내 */}
        {isConfirmedInterview && candidateName && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
            확정된 인터뷰 예약입니다 — <span className="font-semibold">{candidateName}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* 회의실 */}
          <div className="flex flex-col gap-1.5">
            <Label>회의실</Label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              required
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* 날짜 */}
          <div className="flex flex-col gap-1.5">
            <Label>날짜</Label>
            <DatePickerField value={date} onChange={setDate} />
          </div>

          {/* 시간 */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label>시작</Label>
              <TimeSelectField value={startTime} onChange={setStartTime} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <Label>종료</Label>
              <TimeSelectField value={endTime} onChange={setEndTime} />
            </div>
          </div>

          {/* 상태 (확정 인터뷰는 상태 변경 불가) */}
          {!isConfirmedInterview && (
            <div className="flex flex-col gap-1.5">
              <Label>상태</Label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      status === opt.value
                        ? opt.color
                        : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex items-center justify-between pt-1">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 size={13} />
                삭제
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                취소
              </Button>
              <Button type="submit" disabled={isPending || !roomId || !date}>
                {isSaving ? '저장 중...' : isEdit ? '저장' : '추가'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
