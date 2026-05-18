'use client'

// 슬랙 알림 수신 담당자 관리 섹션 — 관리자 전용
import { useState } from 'react'
import { toast } from 'sonner'
import { Bell, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  useNotificationRecipients,
  useCreateNotificationRecipient,
  useDeleteNotificationRecipient,
} from '@/application/usecase/settings/useNotificationRecipients'

export default function NotificationRecipientsSection() {
  const { data: recipients = [], isLoading } = useNotificationRecipients()
  const createRecipient = useCreateNotificationRecipient()
  const deleteRecipient = useDeleteNotificationRecipient()

  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [slackId, setSlackId] = useState('')

  function openAdd() {
    setName('')
    setSlackId('')
    setAddOpen(true)
  }

  async function handleAdd() {
    const trimmedName = name.trim()
    const trimmedSlackId = slackId.trim()
    if (!trimmedName || !trimmedSlackId) return

    const duplicate = recipients.some((r) => r.slackId === trimmedSlackId)
    if (duplicate) {
      toast.error('이미 등록된 슬랙 ID입니다.')
      return
    }

    try {
      await createRecipient.mutateAsync({ name: trimmedName, slackId: trimmedSlackId })
      toast.success('담당자가 등록되었습니다.')
      setAddOpen(false)
    } catch {
      toast.error('등록에 실패했습니다.')
    }
  }

  async function handleDelete(id: string, recipientName: string) {
    try {
      await deleteRecipient.mutateAsync(id)
      toast.success(`${recipientName} 담당자가 삭제되었습니다.`)
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bell size={15} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">슬랙 알림 수신 담당자</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                면접관 전원이 가용 일정을 제출하면 아래 담당자에게 슬랙 DM이 발송됩니다.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openAdd} className="gap-1.5 shrink-0">
            <Plus size={14} />
            담당자 추가
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : recipients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">등록된 담당자가 없습니다.</p>
            <p className="text-xs text-muted-foreground mt-1">담당자를 추가하면 일정 수집 완료 시 자동으로 알림이 발송됩니다.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recipients.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-background"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.slackId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={deleteRecipient.isPending}
                  onClick={() => handleDelete(r.id, r.name)}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>담당자 추가</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recipient-name">이름</Label>
              <Input
                id="recipient-name"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recipient-slack-id">슬랙 ID</Label>
              <Input
                id="recipient-slack-id"
                placeholder="U12345678"
                value={slackId}
                onChange={(e) => setSlackId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <p className="text-xs text-muted-foreground">
                슬랙 프로필 → 더보기 → 멤버 ID 복사
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)}>취소</Button>
              <Button
                disabled={!name.trim() || !slackId.trim() || createRecipient.isPending}
                onClick={handleAdd}
              >
                추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
