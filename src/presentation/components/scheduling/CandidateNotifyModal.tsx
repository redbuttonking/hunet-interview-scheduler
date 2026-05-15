'use client'

// 확정된 인터뷰 일정을 후보자에게 안내하기 위한 메시지 생성 모달
import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Interview } from '@/domain/model/Interview'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
}

function formatConfirmedMessage(interview: Interview): string {
  const slot = interview.confirmedSlot
  if (!slot) return ''

  const roomLines = slot.slots
    .map((s) => `  • ${s.startTime}~${s.endTime} | ${s.roomName}`)
    .join('\n')

  return `[인터뷰 일정 확정 안내]

안녕하세요, ${interview.candidateName}님.

${interview.positionName} 포지션 인터뷰 일정이 아래와 같이 확정되었습니다.

■ 일시: ${slot.date} ${slot.startTime} ~ ${slot.endTime}
■ 유형: ${interview.typeLabel}
■ 장소:
${roomLines}

궁금하신 점이 있으시면 언제든지 연락 주시기 바랍니다.
감사합니다.`
}

export default function CandidateNotifyModal({ open, onOpenChange, interview }: Props) {
  const defaultMessage = useMemo(() => formatConfirmedMessage(interview), [interview])
  const [message, setMessage] = useState(defaultMessage)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast.success('클립보드에 복사되었습니다.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했습니다. 직접 선택 후 복사해주세요.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>후보자 안내 메시지</DialogTitle>
          <DialogDescription>
            아래 메시지를 복사하여 후보자에게 이메일·메신저 등으로 전달해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* 확정 요약 */}
          {interview.confirmedSlot && (
            <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-0.5">
              <p className="font-semibold">{interview.candidateName} · {interview.positionName}</p>
              <p>{interview.confirmedSlot.date} {interview.confirmedSlot.startTime} ~ {interview.confirmedSlot.endTime}</p>
            </div>
          )}

          {/* 메시지 편집 */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">내용을 직접 수정할 수 있습니다.</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={14}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
          <Button onClick={handleCopy} className="gap-1.5">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '복사됨' : '클립보드에 복사'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
