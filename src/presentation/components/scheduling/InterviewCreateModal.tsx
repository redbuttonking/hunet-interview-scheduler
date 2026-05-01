'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import { usePositions } from '@/application/usecase/position/usePositions'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { useCreateInterview } from '@/application/usecase/interview/useInterviews'
import { Round } from '@/domain/model/Position'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function InterviewCreateModal({ open, onOpenChange }: Props) {
  const { data: positions = [] } = usePositions()
  const { data: interviewers = [] } = useInterviewers()
  const createInterview = useCreateInterview()

  const [candidateName, setCandidateName] = useState('')
  const [positionId, setPositionId] = useState('')
  const [selectedTypeIdx, setSelectedTypeIdx] = useState<number | null>(null)
  const [interviewerIds, setInterviewerIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const selectedPosition = positions.find((p) => p.id === positionId) ?? null
  const selectedType = selectedTypeIdx !== null ? selectedPosition?.interviewTypes[selectedTypeIdx] ?? null : null

  // 포지션 변경 시 초기화
  useEffect(() => {
    setSelectedTypeIdx(null)
    setInterviewerIds([])
  }, [positionId])

  // 면접 유형 변경 시 면접관 자동 세팅
  useEffect(() => {
    if (!selectedType || !selectedPosition) return
    const allRounds = [...new Set(selectedType.sessions.flatMap((s) => s.rounds))] as Round[]
    const ids = [...new Set(allRounds.flatMap((r) => selectedPosition.interviewersByRound[r] ?? []))]
    setInterviewerIds(ids)
  }, [selectedTypeIdx, selectedPosition, selectedType])

  function toggleInterviewer(id: string) {
    setInterviewerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  function reset() {
    setCandidateName('')
    setPositionId('')
    setSelectedTypeIdx(null)
    setInterviewerIds([])
    setStartDate('')
    setEndDate('')
  }

  async function handleSubmit() {
    if (!candidateName.trim()) return toast.error('후보자명을 입력해주세요.')
    if (!positionId) return toast.error('포지션을 선택해주세요.')
    if (selectedTypeIdx === null || !selectedType) return toast.error('인터뷰 유형을 선택해주세요.')
    if (interviewerIds.length === 0) return toast.error('면접관을 1명 이상 선택해주세요.')
    if (!startDate || !endDate) return toast.error('가용 일정 요청 기간을 입력해주세요.')
    if (startDate > endDate) return toast.error('종료일이 시작일보다 빠릅니다.')

    try {
      await createInterview.mutateAsync({
        candidateName: candidateName.trim(),
        positionId,
        positionName: selectedPosition!.name,
        typeLabel: selectedType.label,
        sessions: selectedType.sessions,
        interviewerIds,
        interviewersByRound: selectedPosition!.interviewersByRound,
        availabilityPeriod: { startDate, endDate },
      })
      toast.success('인터뷰 조율 건이 생성되었습니다.')
      reset()
      onOpenChange(false)
    } catch {
      toast.error('생성 중 오류가 발생했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>새 인터뷰 만들기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 후보자명 */}
          <div className="space-y-1.5">
            <Label>후보자명</Label>
            <Input
              placeholder="홍길동"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
            />
          </div>

          {/* 포지션 */}
          <div className="space-y-1.5">
            <Label>포지션</Label>
            <Select value={positionId} onValueChange={(v) => v && setPositionId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="포지션 선택" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id} label={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    onClick={() => setSelectedTypeIdx(idx)}
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
            </div>
          )}

          {/* 가용 일정 요청 기간 */}
          <div className="space-y-1.5">
            <Label>가용 일정 요청 기간</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1" />
              <span className="text-muted-foreground text-sm">~</span>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>취소</Button>
          <Button onClick={handleSubmit} disabled={createInterview.isPending}>
            {createInterview.isPending ? '생성 중...' : '생성'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
