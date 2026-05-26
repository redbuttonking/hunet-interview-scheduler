'use client'

// 이미 확정된 인터뷰를 시스템에 바로 등록하는 모달
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerField } from '@/components/ui/date-picker'
import { usePositions } from '@/application/usecase/position/usePositions'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { useRooms } from '@/application/usecase/room/useRooms'
import { useCreateInterview } from '@/application/usecase/interview/useInterviews'
import { useCreateReservation } from '@/application/usecase/room/useRoomReservations'
import { Round } from '@/domain/model/Position'

// 09:00 ~ 17:30 (30분 단위)
const TIME_OPTIONS: string[] = []
for (let h = 9; h <= 17; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 18) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}
TIME_OPTIONS.push('18:00')

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ErrorKeys = 'candidateName' | 'position' | 'type' | 'interviewers' | 'date' | 'time'

export default function DirectConfirmModal({ open, onOpenChange }: Props) {
  const { data: positions = [] } = usePositions()
  const { data: interviewers = [] } = useInterviewers()
  const { data: rooms = [] } = useRooms()
  const createInterview = useCreateInterview()
  const createReservation = useCreateReservation()

  const [candidateName, setCandidateName] = useState('')
  const [positionId, setPositionId] = useState('')
  const [selectedTypeIdx, setSelectedTypeIdx] = useState<number | null>(null)
  const [interviewerIds, setInterviewerIds] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:00')
  const [roomId, setRoomId] = useState('')
  const [errors, setErrors] = useState<Partial<Record<ErrorKeys, string>>>({})

  const selectedPosition = positions.find((p) => p.id === positionId) ?? null
  const selectedType = selectedTypeIdx !== null ? selectedPosition?.interviewTypes[selectedTypeIdx] ?? null : null

  useEffect(() => {
    setSelectedTypeIdx(null)
    setInterviewerIds([])
    setErrors((p) => ({ ...p, position: undefined, type: undefined, interviewers: undefined }))
  }, [positionId])

  useEffect(() => {
    if (!selectedType || !selectedPosition) return
    const allRounds = [...new Set(selectedType.sessions.flatMap((s) => s.rounds))] as Round[]
    const ids = [...new Set(allRounds.flatMap((r) => selectedPosition.interviewersByRound[r] ?? []))]
    setInterviewerIds(ids)
    setErrors((p) => ({ ...p, type: undefined, interviewers: undefined }))
  }, [selectedTypeIdx, selectedPosition, selectedType])

  function clearError(key: ErrorKeys) {
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function toggleInterviewer(id: string) {
    setInterviewerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
    clearError('interviewers')
  }

  function reset() {
    setCandidateName('')
    setPositionId('')
    setSelectedTypeIdx(null)
    setInterviewerIds([])
    setDate('')
    setStartTime('10:00')
    setEndTime('11:00')
    setRoomId('')
    setErrors({})
  }

  async function handleSubmit() {
    const newErrors: Partial<Record<ErrorKeys, string>> = {}
    if (!candidateName.trim()) newErrors.candidateName = '후보자명을 입력해주세요.'
    if (!positionId) newErrors.position = '포지션을 선택해주세요.'
    if (selectedTypeIdx === null || !selectedType) newErrors.type = '인터뷰 유형을 선택해주세요.'
    if (interviewerIds.length === 0) newErrors.interviewers = '면접관을 1명 이상 선택해주세요.'
    if (!date) newErrors.date = '날짜를 선택해주세요.'
    if (startTime >= endTime) newErrors.time = '종료 시간이 시작 시간보다 빨라야 합니다.'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    const selectedRoom = rooms.find((r) => r.id === roomId)
    const confirmedSlot = {
      date,
      startTime,
      endTime,
      slots: selectedRoom
        ? [{ startTime, endTime, roomId: selectedRoom.id, roomName: selectedRoom.name }]
        : [],
    }

    try {
      const interview = await createInterview.mutateAsync({
        candidateName: candidateName.trim(),
        positionId,
        positionName: selectedPosition!.name,
        typeLabel: selectedType!.label,
        sessions: selectedType!.sessions,
        interviewerIds,
        interviewersByRound: selectedPosition!.interviewersByRound,
        availabilityPeriod: null,
        status: 'confirmed',
        confirmedSlot,
      })

      if (selectedRoom) {
        await createReservation.mutateAsync({
          roomId: selectedRoom.id,
          roomName: selectedRoom.name,
          date,
          startTime,
          endTime,
          status: 'confirmed',
          interviewId: interview.id,
        })
      }

      toast.success('확정 인터뷰가 등록되었습니다.')
      reset()
      onOpenChange(false)
    } catch {
      toast.error('등록 중 오류가 발생했습니다.')
    }
  }

  const isPending = createInterview.isPending || createReservation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>확정 인터뷰 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 후보자명 */}
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

          {/* 포지션 */}
          <div className="space-y-1.5">
            <Label>포지션</Label>
            <Select value={positionId} onValueChange={(v) => { if (v) { setPositionId(v); clearError('position') } }}>
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

          {/* 인터뷰 유형 */}
          {selectedPosition && selectedPosition.interviewTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>인터뷰 유형</Label>
              <div className="flex flex-wrap gap-2">
                {selectedPosition.interviewTypes.map((type, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setSelectedTypeIdx(idx); clearError('type') }}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selectedTypeIdx === idx
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
            </div>
          )}

          {/* 면접관 */}
          {selectedType && (
            <div className="space-y-1.5">
              <Label>면접관</Label>
              <div className="flex flex-wrap gap-1.5">
                {interviewers.map((iv) => {
                  const selected = interviewerIds.includes(iv.id)
                  return (
                    <button
                      key={iv.id}
                      type="button"
                      onClick={() => toggleInterviewer(iv.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {iv.name}
                      {selected && <X size={10} />}
                    </button>
                  )
                })}
              </div>
              {errors.interviewers && <p className="text-xs text-destructive">{errors.interviewers}</p>}
            </div>
          )}

          {/* 날짜 */}
          <div className="space-y-1.5">
            <Label>날짜</Label>
            <DatePickerField
              value={date}
              onChange={(v) => { setDate(v); clearError('date') }}
              placeholder="면접 날짜 선택"
              className={errors.date ? 'border-destructive' : ''}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>

          {/* 시간 */}
          <div className="space-y-1.5">
            <Label>시간</Label>
            <div className="flex items-center gap-2">
              <Select value={startTime} onValueChange={(v) => { if (v) { setStartTime(v); clearError('time') } }}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.filter((t) => t < '18:00').map((t) => (
                    <SelectItem key={t} value={t} label={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-sm shrink-0">~</span>
              <Select value={endTime} onValueChange={(v) => { if (v) { setEndTime(v); clearError('time') } }}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.filter((t) => t > startTime).map((t) => (
                    <SelectItem key={t} value={t} label={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
          </div>

          {/* 회의실 (선택) */}
          <div className="space-y-1.5">
            <Label>회의실 <span className="text-muted-foreground font-normal text-xs">(선택)</span></Label>
            <Select value={roomId} onValueChange={(v) => setRoomId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="회의실 선택 안 함" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id} label={r.name}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? '등록 중...' : '확정 등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
