'use client'

// 후보자가 선택한 옵션을 입력하고 최종 확정하는 모달
import { useState } from 'react'
import { toast } from 'sonner'
import { Clock, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Interview, CandidateOption } from '@/domain/model/Interview'
import { Round } from '@/domain/model/Position'
import { useConfirmCandidateChoice } from '@/application/usecase/interview/useInterviews'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
}

const ROUND_COLORS: Record<Round, string> = {
  '1차': 'text-blue-600',
  '2차': 'text-violet-600',
  '3차': 'text-orange-600',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

export default function CandidateChoiceModal({ open, onOpenChange, interview }: Props) {
  const confirmChoice = useConfirmCandidateChoice()
  const [chosen, setChosen] = useState<CandidateOption | null>(null)

  const options = interview.candidateOptions ?? []
  const isSingleSession = interview.sessions.length === 1

  async function handleConfirm() {
    if (!chosen) return toast.error('후보자가 선택한 옵션을 골라주세요.')
    try {
      await confirmChoice.mutateAsync({ interview, chosenOption: chosen })
      toast.success('인터뷰 일정이 최종 확정되었습니다.')
      onOpenChange(false)
    } catch {
      toast.error('확정 중 오류가 발생했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>후보자 확정</DialogTitle>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-foreground text-background">
              {interview.candidateName}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              {interview.positionName}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              {interview.typeLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground pt-0.5">후보자가 선택한 옵션을 골라주세요.</p>
        </DialogHeader>

        <div className="pt-1 space-y-2">
          {options.map((option, i) => {
            const isChosen = chosen === option
            return (
              <button
                key={i}
                type="button"
                onClick={() => setChosen(option)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                  isChosen
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('font-semibold', isChosen ? 'text-foreground' :'text-foreground')}>
                    옵션 {i + 1} · {formatDate(option.date)}
                  </span>
                  {isChosen && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  {option.slots.map((slot, si) => {
                    const rounds = interview.sessions[si]?.rounds ?? []
                    return (
                      <div key={si} className="flex items-center gap-1.5">
                        <Clock size={12} className={cn('shrink-0', isChosen ? 'text-foreground/70' : 'text-muted-foreground')} />
                        {!isSingleSession && rounds.length > 0 && (
                          <span className={cn('font-semibold text-xs shrink-0', isChosen ? 'text-foreground' :(ROUND_COLORS[rounds[0] as Round] ?? 'text-muted-foreground'))}>
                            {rounds.join('+')}
                          </span>
                        )}
                        <span className={cn('text-sm', isChosen ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                          {slot.startTime} ~ {slot.endTime}
                        </span>
                        <span className={cn('text-sm font-medium', isChosen ? 'text-foreground/70' : 'text-foreground/70')}>
                          · {slot.roomName}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmChoice.isPending || !chosen}
          >
            {confirmChoice.isPending ? '확정 중...' : '최종 확정'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
