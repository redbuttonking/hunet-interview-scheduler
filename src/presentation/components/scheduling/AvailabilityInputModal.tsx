'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Interview, AvailabilitySlot } from '@/domain/model/Interview'
import { Interviewer } from '@/domain/model/Interviewer'
import { useSubmitAvailability } from '@/application/usecase/interview/useInterviews'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
  interviewer: Interviewer
}

function makeEmptySlot(startDate: string): AvailabilitySlot {
  return { date: startDate, startTime: '09:00', endTime: '18:00' }
}

export default function AvailabilityInputModal({ open, onOpenChange, interview, interviewer }: Props) {
  const submit = useSubmitAvailability()

  const existing = interview.availabilities.find((a) => a.interviewerId === interviewer.id)
  const [allAvailable, setAllAvailable] = useState(existing?.allAvailable ?? false)
  const [slots, setSlots] = useState<AvailabilitySlot[]>(
    existing?.slots.length ? existing.slots : [makeEmptySlot(interview.availabilityPeriod?.startDate ?? '')],
  )

  function addSlot() {
    setSlots((prev) => [...prev, makeEmptySlot(interview.availabilityPeriod?.startDate ?? '')])
  }

  function removeSlot(i: number) {
    setSlots((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateSlot(i: number, field: keyof AvailabilitySlot, value: string) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)))
  }

  async function handleSubmit() {
    if (!allAvailable && slots.length === 0) {
      return toast.error('가능한 일정을 1개 이상 입력해주세요.')
    }

    const invalidSlot = slots.find((s) => !s.date || s.startTime >= s.endTime)
    if (!allAvailable && invalidSlot) {
      return toast.error('날짜와 시간을 올바르게 입력해주세요. (종료 시간이 시작 시간보다 늦어야 합니다)')
    }

    try {
      await submit.mutateAsync({
        interviewId: interview.id,
        interviewerIds: interview.interviewerIds,
        availability: { interviewerId: interviewer.id, allAvailable, slots: allAvailable ? [] : slots },
      })
      toast.success(`${interviewer.name}님의 가용 일정이 저장되었습니다.`)
      onOpenChange(false)
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  const period = interview.availabilityPeriod
  const minDate = period?.startDate ?? ''
  const maxDate = period?.endDate ?? ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{interviewer.name}님 가용 일정 입력</DialogTitle>
          <DialogDescription>
            {interview.candidateName} · {interview.positionName} · {interview.scheduleType}
            {period && (
              <span className="ml-2 text-xs">({period.startDate} ~ {period.endDate})</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 전체 가능 토글 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="all-available"
              checked={allAvailable}
              onCheckedChange={(v) => setAllAvailable(!!v)}
            />
            <Label htmlFor="all-available" className="cursor-pointer">
              요청 기간 전체 가능
            </Label>
          </div>

          {/* 슬롯 입력 */}
          {!allAvailable && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">가능한 날짜/시간대</Label>
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={slot.date}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => updateSlot(i, 'date', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(i, 'startTime', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground text-sm">~</span>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(i, 'endTime', e.target.value)}
                    className="w-28"
                  />
                  <button
                    onClick={() => removeSlot(i)}
                    disabled={slots.length === 1}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSlot} className="gap-1.5 mt-1">
                <Plus size={13} />
                시간대 추가
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
