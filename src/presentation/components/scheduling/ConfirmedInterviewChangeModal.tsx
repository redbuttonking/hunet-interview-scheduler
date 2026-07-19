'use client'

// 확정 인터뷰의 새 일정과 회의실을 선택하는 모달
import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DatePickerField } from '@/components/ui/date-picker'
import { TimeSelectField } from '@/components/ui/time-select'
import { cn } from '@/lib/utils'
import { useRoomReservations } from '@/application/usecase/room/useRoomReservations'
import { useChangeConfirmedSchedule } from '@/application/usecase/interview/useInterviews'
import {
  findConflictingInterviewerIds,
  recommendFixedSchedules,
  RecommendedSchedule,
} from '@/application/usecase/interview/useScheduleRecommendation'
import { Interview } from '@/domain/model/Interview'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
  scheduledInterviews: Interview[]
  interviewerNames: Record<string, string>
}

function addSessionHours(startTime: string, sessionCount: number): string {
  const [hour, minute] = startTime.split(':').map(Number)
  const totalMinutes = hour * 60 + minute + sessionCount * 60
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`
}

function scheduleKey(schedule: RecommendedSchedule): string {
  return schedule.slots.map((slot) => `${slot.reservationId}-${slot.startTime}-${slot.endTime}`).join('|')
}

export default function ConfirmedInterviewChangeModal({
  open,
  onOpenChange,
  interview,
  scheduledInterviews,
  interviewerNames,
}: Props) {
  const changeSchedule = useChangeConfirmedSchedule()
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const { data: reservations = [], isLoading } = useRoomReservations(date, date)

  const endTime = addSessionHours(startTime, interview.sessions.length)
  const conflictingIds = useMemo(
    () => findConflictingInterviewerIds(
      interview.interviewerIds,
      date,
      startTime,
      endTime,
      scheduledInterviews.filter((item) => item.id !== interview.id),
    ),
    [interview, date, startTime, endTime, scheduledInterviews],
  )
  const schedules = useMemo(
    () => date && conflictingIds.length === 0
      ? recommendFixedSchedules(interview.sessions.length, date, startTime, reservations)
      : [],
    [date, conflictingIds.length, interview.sessions.length, startTime, reservations],
  )
  const selectedSchedule = schedules.find((schedule) => scheduleKey(schedule) === selectedKey) ?? null

  function handleDateChange(value: string) {
    setDate(value)
    setSelectedKey(null)
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value)
    setSelectedKey(null)
  }

  async function handleConfirm() {
    if (!selectedSchedule) {
      toast.error('변경할 회의실을 선택해주세요.')
      return
    }
    try {
      const result = await changeSchedule.mutateAsync({ interviewId: interview.id, schedule: selectedSchedule })
      if (result.notificationSent) {
        toast.success('일정이 변경되고 면접관에게 변경 안내를 발송했습니다.')
      } else if (interview.slackSendMode) {
        toast.warning('일정은 변경됐지만 슬랙 변경 안내를 확인하고 후보자 안내 메시지를 다시 생성해주세요.')
      } else {
        toast.success('일정이 변경되었습니다. 면접관과 후보자에게 직접 안내해주세요.')
      }
      onOpenChange(false)
    } catch {
      toast.error('일정 변경 중 오류가 발생했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>확정 일정 변경</DialogTitle>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
              {interview.candidateName}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {interview.positionName}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {interview.typeLabel}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {interview.confirmedSlot && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="font-medium">현재 확정 일정</p>
              <div className="mt-1 space-y-0.5 text-xs">
                {interview.confirmedSlot.slots.map((slot, index) => (
                  <p key={`${slot.roomId}-${slot.startTime}`}>
                    {interview.sessions.length > 1 ? `${interview.sessions[index]?.rounds.join('+')} · ` : ''}
                    {formatDate(interview.confirmedSlot!.date)} · {slot.startTime} ~ {slot.endTime} · {slot.roomName}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>변경 날짜</Label>
              <DatePickerField value={date} onChange={handleDateChange} />
            </div>
            <div className="space-y-1.5">
              <Label>첫 세션 시작</Label>
              <TimeSelectField value={startTime} onChange={handleStartTimeChange} />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium text-foreground">변경 후 시간</p>
            <p className="mt-0.5 text-muted-foreground">
              {date ? `${formatDate(date)} · ` : ''}{startTime} ~ {endTime}
            </p>
          </div>

          {date && conflictingIds.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">같은 시간에 확정 또는 조율 중인 면접이 있는 면접관이 있습니다.</p>
              <p className="mt-0.5 text-xs">
                {conflictingIds.map((id) => interviewerNames[id] ?? id).join(', ')}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>변경 가능한 회의실</Label>
              {date && !isLoading && conflictingIds.length === 0 && (
                <span className="text-xs text-muted-foreground">총 {schedules.length}개 조합</span>
              )}
            </div>

            {!date ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                변경 날짜와 시작 시간을 입력하면 가능한 회의실이 표시됩니다.
              </div>
            ) : conflictingIds.length > 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                면접관 일정 충돌을 해소한 뒤 다시 확인해주세요.
              </div>
            ) : isLoading ? (
              <div className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
                회의실 예약을 불러오는 중입니다.
              </div>
            ) : schedules.length === 0 ? (
              <div className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
                <XCircle size={22} className="mx-auto mb-2 opacity-40" />
                변경 가능한 회의실이 없습니다.
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {schedules.map((schedule) => {
                  const key = scheduleKey(schedule)
                  const selected = selectedKey === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={cn(
                        'w-full rounded-lg border-2 px-4 py-3 text-left text-sm transition-all',
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">{formatDate(schedule.date)}</span>
                        {selected && <CheckCircle2 size={16} className="shrink-0 text-primary" />}
                      </div>
                      <div className="mt-1 flex flex-col gap-0.5">
                        {schedule.slots.map((slot, index) => (
                          <div key={`${slot.reservationId}-${slot.startTime}`} className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock size={12} className="shrink-0" />
                            <span>{interview.sessions.length > 1 ? `${interview.sessions[index].rounds.join('+')} · ` : ''}{slot.startTime} ~ {slot.endTime}</span>
                            <span>· {slot.roomName}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            onClick={handleConfirm}
            disabled={changeSchedule.isPending || selectedSchedule === null || conflictingIds.length > 0}
          >
            {changeSchedule.isPending ? '변경 중...' : '변경 확정'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
