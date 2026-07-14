'use client'

// 면접관 가능 시간을 직접 입력해 조율 중 또는 확정 인터뷰를 등록하는 모달
import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, CheckCircle2, Clock, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerField } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { usePositions } from '@/application/usecase/position/usePositions'
import {
  useCreateInterview,
  useDeleteInterview,
  useProposeCandidateOptions,
  useConfirmSchedule,
} from '@/application/usecase/interview/useInterviews'
import { useRoomReservations } from '@/application/usecase/room/useRoomReservations'
import { RecommendedSchedule, recommendSchedules } from '@/application/usecase/interview/useScheduleRecommendation'
import { InterviewerAvailability, ManualInterviewer } from '@/domain/model/Interview'
import { Round } from '@/domain/model/Position'

const TIME_OPTIONS: string[] = []
for (let h = 9; h <= 17; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}
TIME_OPTIONS.push('18:00')

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ManualRow {
  id: string
  name: string
  round: Round | ''
  date: string
  startTime: string
  endTime: string
}

interface ManualScheduleData {
  interviewers: ManualInterviewer[]
  availabilities: InterviewerAvailability[]
  startDate: string
  endDate: string
  ids: string[]
  interviewersByRound: Partial<Record<Round, string[]>>
}

type ErrorKeys = 'candidateName' | 'position' | 'type' | 'manualRows' | 'schedule'
type RegisterMode = 'coordinating' | 'confirmed'

function createRow(): ManualRow {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    round: '',
    date: '',
    startTime: '10:00',
    endTime: '11:00',
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

function buildManualData(rows: ManualRow[], allowedRounds: Round[]): ManualScheduleData | null {
  if (rows.length === 0) return null
  if (rows.some((row) =>
    !row.name.trim() ||
    !row.round ||
    !allowedRounds.includes(row.round) ||
    !row.date ||
    row.startTime >= row.endTime,
  )) return null

  const byName = new Map<string, ManualInterviewer>()
  const interviewersByRound: Partial<Record<Round, string[]>> = {}
  rows.forEach((row) => {
    const round = row.round as Round
    const name = row.name.trim()
    if (!byName.has(name)) {
      byName.set(name, { id: `manual-${byName.size + 1}`, name, slots: [] })
    }
    const interviewer = byName.get(name)!
    interviewer.slots.push({
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
    })
    if (!interviewersByRound[round]) interviewersByRound[round] = []
    if (!interviewersByRound[round]!.includes(interviewer.id)) {
      interviewersByRound[round]!.push(interviewer.id)
    }
  })

  const interviewers = [...byName.values()]
  const dates = rows.map((row) => row.date).sort()
  const availabilities = interviewers.map((interviewer) => ({
    interviewerId: interviewer.id,
    allAvailable: false,
    slots: interviewer.slots,
  }))

  return {
    interviewers,
    availabilities,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    ids: interviewers.map((interviewer) => interviewer.id),
    interviewersByRound,
  }
}

function buildSessionSpecs(
  sessions: { rounds: Round[] }[],
  interviewersByRound: Partial<Record<Round, string[]>>,
): { interviewerIds: string[] }[] {
  return sessions.map((session) => ({
    interviewerIds: [...new Set(session.rounds.flatMap((round) => interviewersByRound[round] ?? []))],
  }))
}

function toOption(schedule: RecommendedSchedule) {
  return {
    date: schedule.date,
    slots: schedule.slots.map((slot) => ({
      reservationId: slot.reservationId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomId: slot.roomId,
      roomName: slot.roomName,
    })),
  }
}

export default function DirectConfirmModal({ open, onOpenChange }: Props) {
  const { data: positions = [] } = usePositions()
  const createInterview = useCreateInterview()
  const deleteInterview = useDeleteInterview()
  const proposeOptions = useProposeCandidateOptions()
  const confirmSchedule = useConfirmSchedule()

  const [candidateName, setCandidateName] = useState('')
  const [positionId, setPositionId] = useState('')
  const [selectedTypeIdx, setSelectedTypeIdx] = useState<number | null>(null)
  const [manualRows, setManualRows] = useState<ManualRow[]>(() => [createRow()])
  const [selectedScheduleIdx, setSelectedScheduleIdx] = useState<number | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ErrorKeys, string>>>({})

  const selectedPosition = positions.find((p) => p.id === positionId) ?? null
  const selectedType = selectedTypeIdx !== null ? selectedPosition?.interviewTypes[selectedTypeIdx] ?? null : null
  const usedRounds = selectedType
    ? ([...new Set(selectedType.sessions.flatMap((session) => session.rounds))] as Round[])
    : []
  const manualData = buildManualData(manualRows, usedRounds)

  const { data: reservations = [], isLoading: isLoadingReservations } = useRoomReservations(
    manualData?.startDate ?? '',
    manualData?.endDate ?? '',
  )

  const schedules = selectedType && manualData
    ? recommendSchedules(
      buildSessionSpecs(selectedType.sessions, manualData.interviewersByRound),
      manualData.availabilities,
      reservations,
    ).sort((a, b) => (a.date + a.slots[0].startTime).localeCompare(b.date + b.slots[0].startTime))
    : []

  function clearError(key: ErrorKeys) {
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function reset() {
    setCandidateName('')
    setPositionId('')
    setSelectedTypeIdx(null)
    setManualRows([createRow()])
    setSelectedScheduleIdx(null)
    setErrors({})
  }

  function updateRow(id: string, patch: Partial<ManualRow>) {
    setManualRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    setSelectedScheduleIdx(null)
    clearError('manualRows')
    clearError('schedule')
  }

  function addRow() {
    setManualRows((prev) => [...prev, createRow()])
    setSelectedScheduleIdx(null)
    clearError('manualRows')
  }

  function removeRow(id: string) {
    setManualRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)))
    setSelectedScheduleIdx(null)
    clearError('manualRows')
  }

  function validate(): ManualScheduleData | null {
    const newErrors: Partial<Record<ErrorKeys, string>> = {}
    if (!candidateName.trim()) newErrors.candidateName = '후보자명을 입력해주세요.'
    if (!positionId || !selectedPosition) newErrors.position = '포지션을 선택해주세요.'
    if (selectedTypeIdx === null || !selectedType) newErrors.type = '인터뷰 유형을 선택해주세요.'
    if (!manualData) newErrors.manualRows = '담당 차수, 면접관명, 날짜, 시작/종료 시간을 모두 올바르게 입력해주세요.'
    if (selectedType && manualData) {
      const emptyRounds = usedRounds.filter((round) => (manualData.interviewersByRound[round] ?? []).length === 0)
      if (emptyRounds.length > 0) {
        newErrors.manualRows = `담당 면접관이 없는 차수가 있습니다: ${emptyRounds.join(', ')}`
      }
    }
    if (selectedScheduleIdx === null) newErrors.schedule = '추천 일정 중 하나를 선택해주세요.'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return null
    }
    return manualData
  }

  async function handleRegister(mode: RegisterMode) {
    const data = validate()
    if (!data || !selectedPosition || !selectedType || selectedScheduleIdx === null) return

    const selectedSchedule = schedules[selectedScheduleIdx]
    if (!selectedSchedule) {
      setErrors((p) => ({ ...p, schedule: '추천 일정 중 하나를 선택해주세요.' }))
      return
    }

    try {
      const interview = await createInterview.mutateAsync({
        candidateName: candidateName.trim(),
        positionId,
        positionName: selectedPosition.name,
        typeLabel: selectedType.label,
        sessions: selectedType.sessions,
        interviewerIds: data.ids,
        manualInterviewers: data.interviewers,
        interviewersByRound: data.interviewersByRound,
        availabilityPeriod: { startDate: data.startDate, endDate: data.endDate },
        availabilities: data.availabilities,
        status: 'ready_to_schedule',
      })

      try {
        if (mode === 'coordinating') {
          await proposeOptions.mutateAsync({
            interviewId: interview.id,
            options: [toOption(selectedSchedule)],
          })
          toast.success('수동 인터뷰를 조율 중으로 등록했습니다.')
        } else {
          await confirmSchedule.mutateAsync({ interviewId: interview.id, schedule: selectedSchedule })
          toast.success('수동 인터뷰를 확정 등록했습니다.')
        }
      } catch (error) {
        await deleteInterview.mutateAsync(interview).catch(() => undefined)
        throw error
      }

      reset()
      onOpenChange(false)
    } catch {
      toast.error('수동 일정 등록 중 오류가 발생했습니다.')
    }
  }

  const selectedSchedule = selectedScheduleIdx !== null ? schedules[selectedScheduleIdx] : null
  const isPending =
    createInterview.isPending ||
    proposeOptions.isPending ||
    confirmSchedule.isPending ||
    deleteInterview.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>수동 일정 등록</DialogTitle>
          <DialogDescription>
            면접관 가능 시간을 직접 입력하고, 예약 가능한 회의실을 선택해 조율 중 또는 확정 상태로 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 pt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>후보자명</Label>
              <Input
                placeholder="홍길동"
                value={candidateName}
                onChange={(e) => { setCandidateName(e.target.value); clearError('candidateName') }}
                className={errors.candidateName ? 'border-destructive' : ''}
              />
              {errors.candidateName && <p className="text-xs text-destructive">{errors.candidateName}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>포지션</Label>
              <Select
                value={positionId}
                onValueChange={(v) => {
                  if (!v) return
                  setPositionId(v)
                  setSelectedTypeIdx(null)
                  setSelectedScheduleIdx(null)
                  setErrors((p) => ({ ...p, position: undefined, type: undefined, schedule: undefined }))
                }}
              >
                <SelectTrigger className={`w-full ${errors.position ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="포지션 선택">
                    {positions.find((p) => p.id === positionId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id} label={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.position && <p className="text-xs text-destructive">{errors.position}</p>}
            </div>
          </div>

          {selectedPosition && selectedPosition.interviewTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>인터뷰 유형</Label>
              <div className="flex flex-wrap gap-2">
                {selectedPosition.interviewTypes.map((type, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedTypeIdx(idx)
                      setSelectedScheduleIdx(null)
                      clearError('type')
                      clearError('schedule')
                    }}
                    className={cn(
                      'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                      selectedTypeIdx === idx
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-primary/50',
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>면접관 가능 시간</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
                <Plus size={13} />
                추가
              </Button>
            </div>
            <div className="space-y-3">
              {manualRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 lg:grid-cols-[0.8fr_1fr_1fr_1.45fr_auto] gap-2 lg:gap-3 items-end rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">담당 차수</Label>
                    <Select
                      value={row.round}
                      onValueChange={(v) => v && updateRow(row.id, { round: v as Round })}
                      disabled={usedRounds.length === 0}
                    >
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder="차수" />
                      </SelectTrigger>
                      <SelectContent>
                        {usedRounds.map((round) => (
                          <SelectItem key={round} value={round} label={round}>{round}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">면접관</Label>
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      placeholder="면접관명"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">가능 날짜</Label>
                    <DatePickerField
                      value={row.date}
                      onChange={(v) => updateRow(row.id, { date: v })}
                      placeholder="날짜 선택"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">가능 시간</Label>
                    <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                      <Select value={row.startTime} onValueChange={(v) => v && updateRow(row.id, { startTime: v })}>
                        <SelectTrigger className="border-0 rounded-none shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.filter((time) => time < '18:00').map((time) => (
                            <SelectItem key={time} value={time} label={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="px-2 text-sm text-muted-foreground bg-muted/60 self-stretch flex items-center border-x border-border">
                        부터
                      </span>
                      <Select value={row.endTime} onValueChange={(v) => v && updateRow(row.id, { endTime: v })}>
                        <SelectTrigger className="border-0 rounded-none shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.filter((time) => time > row.startTime).map((time) => (
                            <SelectItem key={time} value={time} label={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="px-2 text-sm text-muted-foreground bg-muted/60 self-stretch flex items-center border-l border-border">
                        까지
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    disabled={manualRows.length === 1}
                    className="justify-self-end lg:justify-self-auto"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              원데이 인터뷰는 세션 순서에 맞춰 각 차수 면접관의 가능 시간이 연속되는 일정만 추천됩니다.
            </p>
            {errors.manualRows && <p className="text-xs text-destructive">{errors.manualRows}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>추천 회의실</Label>
              {manualData && selectedType && (
                <span className="text-xs text-muted-foreground">
                  {isLoadingReservations ? '예약 불러오는 중...' : `총 ${schedules.length}개 추천`}
                </span>
              )}
            </div>

            {!manualData || !selectedType ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                포지션, 인터뷰 유형, 면접관 가능 시간을 입력하면 추천 회의실이 표시됩니다.
              </div>
            ) : isLoadingReservations ? (
              <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground text-center">
                회의실 예약을 불러오는 중입니다.
              </div>
            ) : schedules.length === 0 ? (
              <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground text-center">
                <CalendarCheck size={24} className="mx-auto mb-2 opacity-40" />
                추천 가능한 회의실이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {schedules.map((schedule, idx) => {
                  const selected = selectedScheduleIdx === idx
                  return (
                    <button
                      key={`${schedule.date}-${schedule.slots.map((slot) => `${slot.reservationId}-${slot.startTime}`).join('-')}`}
                      type="button"
                      onClick={() => { setSelectedScheduleIdx(idx); clearError('schedule') }}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{formatDate(schedule.date)}</span>
                        {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {schedule.slots.map((slot, slotIdx) => (
                          <div key={slotIdx} className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock size={12} className="shrink-0" />
                            <span>{slot.startTime} ~ {slot.endTime}</span>
                            <span>· {slot.roomName}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {errors.schedule && <p className="text-xs text-destructive">{errors.schedule}</p>}
          </div>

          {selectedSchedule && (
            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm">
              <p className="font-medium text-foreground">선택한 일정</p>
              <p className="text-muted-foreground mt-1">
                {formatDate(selectedSchedule.date)} · {selectedSchedule.slots[0].startTime} ~{' '}
                {selectedSchedule.slots[selectedSchedule.slots.length - 1].endTime}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>
            취소
          </Button>
          <Button variant="outline" onClick={() => handleRegister('coordinating')} disabled={isPending}>
            {isPending ? '등록 중...' : '조율 중으로 등록'}
          </Button>
          <Button onClick={() => handleRegister('confirmed')} disabled={isPending}>
            {isPending ? '등록 중...' : '확정 등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
