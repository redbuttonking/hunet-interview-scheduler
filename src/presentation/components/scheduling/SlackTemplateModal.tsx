'use client'

// 슬랙 메시지 템플릿 편집 모달

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const TEMPLATE_KEY = 'slack-message-template'

const DEFAULT_TEMPLATE = {
  header:
    '안녕하세요!\n{포지션} ({후보자명}) {유형} 인터뷰 일정 조율로 연락 드립니다~\n\n아래 날짜 중 가능하신 시간대 말씀해 주시면 감사 드리겠습니다 ^^',
  footer: '감사합니다.\n휴넷 채용팀',
}

function loadTemplate() {
  try {
    const saved = localStorage.getItem(TEMPLATE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_TEMPLATE
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SlackTemplateModal({ open, onOpenChange }: Props) {
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')

  useEffect(() => {
    if (open) {
      const tpl = loadTemplate()
      setHeader(tpl.header)
      setFooter(tpl.footer)
    }
  }, [open])

  function handleSave() {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ header, footer }))
    toast.success('템플릿이 저장되었습니다.')
    onOpenChange(false)
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
            <Button onClick={handleSave}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
