'use client'

// 리마인드 메시지 템플릿 편집 모달

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  useReminderTemplate,
  useSaveReminderTemplate,
  DEFAULT_REMINDER_MESSAGE,
} from '@/application/usecase/settings/useReminderTemplate'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ReminderTemplateModal({ open, onOpenChange }: Props) {
  const { data: template } = useReminderTemplate()
  const save = useSaveReminderTemplate()

  const [message, setMessage] = useState('')

  useEffect(() => {
    if (open && template) {
      setMessage(template.message)
    }
  }, [open, template])

  async function handleSave() {
    try {
      await save.mutateAsync(message.trim())
      toast.success('리마인드 메시지가 저장되었습니다.')
      onOpenChange(false)
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  function handleReset() {
    setMessage(DEFAULT_REMINDER_MESSAGE)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>리마인드 메시지 템플릿</DialogTitle>
          <DialogDescription>
            미제출 면접관에게 슬랙 채널에서 @멘션으로 발송되는 리마인드 메시지입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
            <code className="bg-background px-1 rounded">{'{후보자명}'}</code>,{' '}
            <code className="bg-background px-1 rounded">{'{포지션명}'}</code>은
            발송 시 실제 정보로 자동 치환됩니다.
          </p>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">메시지</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="rounded-md bg-muted/40 border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            <p className="text-xs font-medium mb-1">발송 예시</p>
            <p className="whitespace-pre-wrap">
              {'@면접관A @면접관B\n'}
              {message
                .replace('{후보자명}', '홍길동')
                .replace('{포지션명}', '백엔드 개발')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
            기본값으로 초기화
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
