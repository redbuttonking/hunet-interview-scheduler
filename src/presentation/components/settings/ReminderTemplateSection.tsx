'use client'

// 리마인드 메시지 템플릿 편집 섹션
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  useReminderTemplate,
  useSaveReminderTemplate,
  DEFAULT_REMINDER_MESSAGE,
} from '@/application/usecase/settings/useReminderTemplate'

export default function ReminderTemplateSection() {
  const { data: template, isLoading } = useReminderTemplate()
  const save = useSaveReminderTemplate()

  const [message, setMessage] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (template) {
      setMessage(template.message)
      setIsDirty(false)
    }
  }, [template])

  function handleChange(value: string) {
    setMessage(value)
    setIsDirty(value !== (template?.message ?? DEFAULT_REMINDER_MESSAGE))
  }

  async function handleSave() {
    try {
      await save.mutateAsync(message.trim())
      toast.success('리마인드 메시지가 저장되었습니다.')
      setIsDirty(false)
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Bell size={15} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">리마인드 메시지 템플릿</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              미제출 면접관에게 자동 발송되는 리마인드 메시지입니다. 슬랙 채널에 @멘션과 함께 발송됩니다.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">메시지</Label>
              <p className="text-xs text-muted-foreground">
                <code className="bg-muted px-1 rounded">{'{후보자명}'}</code>,{' '}
                <code className="bg-muted px-1 rounded">{'{포지션명}'}</code>은 발송 시 자동으로 치환됩니다.
              </p>
              <textarea
                value={message}
                onChange={(e) => handleChange(e.target.value)}
                rows={3}
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

            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!isDirty || save.isPending}
                onClick={handleSave}
              >
                {save.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
