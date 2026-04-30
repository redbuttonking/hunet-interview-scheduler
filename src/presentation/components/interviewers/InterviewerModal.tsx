'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Interviewer } from '@/domain/model/Interviewer'
import { useCreateInterviewer, useUpdateInterviewer } from '@/application/usecase/interviewer/useInterviewers'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 편집 대상 — null이면 추가 모드 */
  interviewer: Interviewer | null
}

export default function InterviewerModal({ open, onOpenChange, interviewer }: Props) {
  const isEdit = interviewer !== null
  const [name, setName] = useState('')
  const [slackId, setSlackId] = useState('')

  const create = useCreateInterviewer()
  const update = useUpdateInterviewer()
  const isPending = create.isPending || update.isPending

  // 편집 모드 진입 시 기존 값으로 초기화
  useEffect(() => {
    if (open) {
      setName(interviewer?.name ?? '')
      setSlackId(interviewer?.slackId ?? '')
    }
  }, [open, interviewer])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedSlack = slackId.trim().replace(/^@/, '') // @ 자동 제거

    if (!trimmedName || !trimmedSlack) return

    try {
      if (isEdit) {
        await update.mutateAsync({ id: interviewer.id, input: { name: trimmedName, slackId: trimmedSlack } })
        toast.success('면접관 정보가 수정되었습니다.')
      } else {
        await create.mutateAsync({ name: trimmedName, slackId: trimmedSlack })
        toast.success('면접관이 추가되었습니다.')
      }
      onOpenChange(false)
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? '면접관 편집' : '면접관 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slackId">슬랙 ID</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">@</span>
              <Input
                id="slackId"
                value={slackId}
                onChange={(e) => setSlackId(e.target.value)}
                placeholder="gildong.hong"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '저장 중...' : isEdit ? '저장' : '추가'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
