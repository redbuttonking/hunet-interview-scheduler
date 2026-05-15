'use client'

// pending_slack 상태 인터뷰 정보를 수정하는 모달 컴포넌트
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerField } from '@/components/ui/date-picker'
import { X } from 'lucide-react'
import { usePositions } from '@/application/usecase/position/usePositions'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { useUpdateInterview } from '@/application/usecase/interview/useInterviews'
import { Interview } from '@/domain/model/Interview'
import { Round } from '@/domain/model/Position'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
}

type ErrorKeys = 'candidateName' | 'position' | 'type' | 'interviewers' | 'period'

export default function InterviewEditModal({ open, onOpenChange, interview }: Props) {
  const { data: positions = [] } = usePositions()
  const { data: interviewers = [] } = useInterviewers()
  const updateInterview = useUpdateInterview()

  const [candidateName, setCandidateName] = useState(interview.candidateName)
  const [positionId, setPositionId] = useState(interview.positionId)
  const [selectedTypeIdx, setSelectedTypeIdx] = useState<number | null>(null)
  const [interviewerIds, setInterviewerIds] = useState<string[]>(interview.interviewerIds)
  const [startDate, setStartDate] = useState(interview.availabilityPeriod?.startDate ?? '')
  const [endDate, setEndDate] = useState(interview.availabilityPeriod?.endDate ?? '')
  const [errors, setErrors] = useState<Partial<Record<ErrorKeys, string>>>({})

  // 초기 포지션·유형 참조 (포지션 변경 시 리셋 판단에 사용)
  const initialPositionId = useRef(interview.positionId)
  const initialTypeLabel = useRef(interview.typeLabel)

  const selectedPosition = positions.find((p) => p.id === positionId) ?? null
  const selectedType = selectedTypeIdx !== null ? selectedPosition?.interviewTypes[selectedTypeIdx] ?? null : null

  // 포지션 데이터가 로드되면 최초 1회 유형 인덱스 복원
  useEffect(() => {
    if (!positions.length || selectedTypeIdx !== null) return
    const pos = positions.find((p) => p.id === initialPositionId.current)
    if (!pos) return
    const idx = pos.interviewTypes.findIndex((t) => t.label === initialTypeLabel.current)
    if (idx !== -1) setSelectedTypeIdx(idx)
  }, [positions, selectedTypeIdx])

  function clearError(key: ErrorKeys) {
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function handlePositionChange(v: string | null) {
    if (!v) return
    setPositionId(v)
    // 포지션이 바뀌면 유형·면접관 리셋
    setSelectedTypeIdx(null)
    setInterviewerIds([])
    clearError('position')
    clearError('type')
    clearError('interviewers')
  }

  // 유형 선택 시 포지션 기본 면접관 자동 세팅
  function handleTypeSelect(idx: number) {
    setSelectedTypeIdx(idx)
    clearError('type')
    if (!selectedPosition) return
    const type = selectedPosition.interviewTypes[idx]
    const allRounds = [...new Set(type.sessions.flatMap((s) => s.rounds))] as Round[]
    const ids = [...new Set(allRounds.flatMap((r) => selectedPosition.interviewersByRound[r] ?? []))]
    setInterviewerIds(ids)
    clearError('interviewers')
  }

  function toggleInterviewer(id: string) {
    setInterviewerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
    clearError('interviewers')
  }

  async function handleSubmit() {
    const newErrors: Partial<Record<ErrorKeys, string>> = {}
    if (!candidateName.trim()) newErrors.candidateName = '후보자명을 입력해주세요.'
    if (!positionId) newErrors.position = '포지션을 선택해주세요.'
    if (selectedTypeIdx === null || !selectedType) newErrors.type = '인터뷰 유형을 선택해주세요.'
    if (interviewerIds.length === 0) newErrors.interviewers = '면접관을 1명 이상 선택해주세요.'
    if (!startDate || !endDate) newErrors.period = '가용 일정 요청 기간을 입력해주세요.'
    else if (startDate > endDate) newErrors.period = '종료일이 시작일보다 빠릅니다.'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    try {
      await updateInterview.mutateAsync({
        id: interview.id,
        input: {
          candidateName: candidateName.trim(),
          positionId,
          positionName: selectedPosition!.name,
          typeLabel: selectedType!.label,
          sessions: selectedType!.sessions,
          interviewerIds,
          interviewersByRound: selectedPosition!.interviewersByRound,
          availabilityPeriod: { startDate, endDate },
        },
      })
      toast.success('인터뷰 정보가 수정되었습니다.')
      onOpenChange(false)
    } catch {
      toast.error('수정 중 오류가 발생했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>인터뷰 수정</DialogTitle>
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
            <Select value={positionId} onValueChange={handlePositionChange}>
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
                    onClick={() => handleTypeSelect(idx)}
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

          {/* 인터뷰 진행 기간 */}
          <div className="space-y-1.5">
            <Label>인터뷰 진행 기간</Label>
            <p className="text-xs text-muted-foreground -mt-0.5">면접관들에게 가능한 날짜를 요청할 범위입니다.</p>
            <div className="flex items-center gap-2">
              <DatePickerField
                value={startDate}
                onChange={(v) => { setStartDate(v); clearError('period') }}
                placeholder="시작일"
                className="flex-1"
              />
              <span className="text-muted-foreground text-sm shrink-0">~</span>
              <DatePickerField
                value={endDate}
                onChange={(v) => { setEndDate(v); clearError('period') }}
                min={startDate}
                placeholder="종료일"
                className="flex-1"
              />
            </div>
            {errors.period && <p className="text-xs text-destructive">{errors.period}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={updateInterview.isPending}>
            {updateInterview.isPending ? '수정 중...' : '수정'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
