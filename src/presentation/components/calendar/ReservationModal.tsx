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
import { User } from '@/domain/model/User'
import { CreateReservationInput } from '@/domain/repository/IRoomReservationRepository'

const STATUS_OPTIONS: { value: ReservationStatus; label: string; color: string }[] = [
  { value: 'reserved', label: '예약됨', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'coordinating', label: '조율중', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'confirmed', label: '확정', color: 'bg-blue-100 text-blue-700 border-blue-300' },
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
  /** 면접 연동 예약일 때 표시할 후보자와 포지션 */
  interviewInfo?: { candidateName: string; positionName: string }
  currentUser: { uid: string; name: string } | null
  users: User[]
  isAdmin: boolean
  onSave: (data: CreateReservationInput) => Promise<void>
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
  interviewInfo,
  currentUser,
  users,
  isAdmin,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: Props) {
  const isEdit = reservation !== null
  const isConfirmedInterview = isEdit && !!reservation.interviewId && reservation.status === 'confirmed'
  const isCoordinatingInterview = isEdit && !!reservation.interviewId && reservation.status === 'coordinating'
  const isLockedInterview = isConfirmedInterview || isCoordinatingInterview

  const [roomId, setRoomId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [status, setStatus] = useState<ReservationStatus>('reserved')
  const [bookedByUserId, setBookedByUserId] = useState('')
  const [bookedByName, setBookedByName] = useState('')
  const [memo, setMemo] = useState('')

  useEffect(() => {
    if (!open) return
    if (reservation) {
      setRoomId(reservation.roomId)
      setDate(reservation.date)
      setStartTime(reservation.startTime)
      setEndTime(reservation.endTime)
      setStatus(reservation.status)
      setBookedByUserId(reservation.bookedByUserId ?? '')
      setBookedByName(reservation.bookedByName ?? '')
      setMemo(reservation.memo ?? '')
    } else if (draft) {
      setRoomId(draft.roomId)
      setDate(draft.date)
      setStartTime(draft.startTime)
      setEndTime(draft.endTime)
      setStatus('reserved')
      setBookedByUserId(currentUser?.uid ?? '')
      setBookedByName(currentUser?.name ?? '')
      setMemo('')
    } else {
      setRoomId(rooms[0]?.id ?? '')
      setDate('')
      setStartTime('09:00')
      setEndTime('10:00')
      setStatus('reserved')
      setBookedByUserId(currentUser?.uid ?? '')
      setBookedByName(currentUser?.name ?? '')
      setMemo('')
    }
  }, [open, reservation, draft, rooms, currentUser])

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
    const selectedUser = users.find((user) => user.id === bookedByUserId)
    await onSave({
      roomId,
      roomName: room.name,
      date,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      status,
      interviewId: reservation?.interviewId ?? null,
      bookedByUserId: (selectedUser?.id ?? bookedByUserId) || null,
      bookedByName: (selectedUser?.name ?? bookedByName) || null,
      memo: memo.trim(),
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
        {isConfirmedInterview && interviewInfo && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
            <p>확정된 인터뷰 예약입니다.</p>
            <p className="mt-0.5 font-semibold">{interviewInfo.candidateName} · {interviewInfo.positionName}</p>
          </div>
        )}
        {/* 조율 중인 예약 안내 */}
        {isCoordinatingInterview && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
            <p>조율 중인 인터뷰 예약입니다.</p>
            {interviewInfo && <p className="mt-0.5 font-semibold">{interviewInfo.candidateName} · {interviewInfo.positionName}</p>}
            <p className="text-xs mt-0.5 text-emerald-600">일정 조율 화면에서 조율을 취소한 뒤 수정할 수 있습니다.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* 회의실 */}
          <div className="flex flex-col gap-1.5">
            <Label>회의실</Label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={isCoordinatingInterview}
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
            {isCoordinatingInterview ? (
              <div className="h-9 rounded-md border border-border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground">{date}</div>
            ) : (
              <DatePickerField value={date} onChange={setDate} />
            )}
          </div>

          {/* 시간 */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label>시작</Label>
              {isCoordinatingInterview ? (
                <div className="h-9 rounded-md border border-border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground">{startTime}</div>
              ) : (
                <TimeSelectField value={startTime} onChange={setStartTime} />
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <Label>종료</Label>
              {isCoordinatingInterview ? (
                <div className="h-9 rounded-md border border-border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground">{endTime}</div>
              ) : (
                <TimeSelectField value={endTime} onChange={setEndTime} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>예약자</Label>
            {isAdmin ? (
              <select
                value={bookedByUserId}
                onChange={(e) => {
                  const selectedUser = users.find((user) => user.id === e.target.value)
                  setBookedByUserId(selectedUser?.id ?? '')
                  setBookedByName(selectedUser?.name ?? '')
                }}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">등록자 정보 없음</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
                ))}
              </select>
            ) : (
              <div className="h-9 rounded-md border border-border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground">
                {bookedByName || '등록자 정보 없음'}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reservation-memo">메모</Label>
            <textarea
              id="reservation-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* 상태 (확정/조율중 인터뷰는 상태 변경 불가) */}
          {!isLockedInterview && (
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
