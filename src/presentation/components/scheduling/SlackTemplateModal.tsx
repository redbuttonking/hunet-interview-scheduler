'use client'

// 슬랙 메시지 템플릿 편집 모달

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useSlackTemplate, useSaveSlackTemplate, DEFAULT_TEMPLATE } from '@/application/usecase/settings/useSlackTemplate'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SlackTemplateModal({ open, onOpenChange }: Props) {
  const { data: template } = useSlackTemplate()
  const saveTemplate = useSaveSlackTemplate()

  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')

  useEffect(() => {
    if (open && template) {
      setHeader(template.header)
      setFooter(template.footer)
    }
  }, [open, template])

  async function handleSave() {
    try {
      await saveTemplate.mutateAsync({ header, footer })
      toast.success('템플릿이 저장되었습니다.')
      onOpenChange(false)
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  function handleReset() {
    setHeader(DEFAULT_TEMPLATE.header)
    setFooter(DEFAULT_TEMPLATE.footer)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>슬랙 메시지 템플릿</DialogTitle>
          <DialogDescription>
            슬랙 발송 시 기본으로 사용할 메시지 템플릿을 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
            <code className="bg-background px-1 rounded">{'{후보자명}'}</code>,{' '}
            <code className="bg-background px-1 rounded">{'{포지션}'}</code>,{' '}
            <code className="bg-background px-1 rounded">{'{유형}'}</code>은
            발송 시 실제 정보로 자동 치환됩니다.
          </p>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">상단 텍스트</Label>
            <textarea
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="rounded-md bg-muted/50 border border-dashed border-border px-3 py-2 text-xs text-muted-foreground text-center">
            날짜 목록 (발송 시 자동 삽입)
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">하단 텍스트</Label>
            <textarea
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
            기본값으로 초기화
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saveTemplate.isPending}>
              {saveTemplate.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
