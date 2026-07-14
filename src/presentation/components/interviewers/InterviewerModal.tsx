'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Interviewer } from '@/domain/model/Interviewer'
import { useInterviewers, useCreateInterviewer, useUpdateInterviewer } from '@/application/usecase/interviewer/useInterviewers'
import { useSlackUsers } from '@/application/usecase/slack/useSlackDirectory'
import type { SlackDirectoryUser } from '@/infrastructure/slack/SlackDirectoryService'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 편집 대상 — null이면 추가 모드 */
  interviewer: Interviewer | null
}

function SlackUserSearch({
  users,
  isLoading,
  error,
  onSelect,
}: {
  users: SlackDirectoryUser[]
  isLoading: boolean
  error: Error | null
  onSelect: (user: SlackDirectoryUser) => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = users.filter((user) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      user.realName.toLowerCase().includes(q) ||
      user.displayName.toLowerCase().includes(q) ||
      user.name.toLowerCase().includes(q) ||
      user.id.toLowerCase().includes(q) ||
      (user.email?.toLowerCase().includes(q) ?? false)
    )
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <Label htmlFor="slackUserSearch">Slack에서 검색</Label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="slackUserSearch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={isLoading ? 'Slack 사용자를 불러오는 중입니다.' : '이름, 이메일, Slack ID로 검색'}
          className="pl-9"
          disabled={isLoading}
        />
      </div>

      {focused && !isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
          {error ? (
            <div className="px-3 py-3 text-xs text-destructive text-center">
              {error.message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelect(user)
                    setFocused(false)
                    setQuery('')
                  }}
                  className="flex items-center justify-between w-full gap-3 px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {user.realName || user.displayName || user.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email ?? user.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground font-mono">{user.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Slack에서 선택하면 이름, 멤버 ID, 이메일이 자동 입력됩니다.
      </p>
    </div>
  )
}

export default function InterviewerModal({ open, onOpenChange, interviewer }: Props) {
  const isEdit = interviewer !== null
  const [name, setName] = useState('')
  const [slackId, setSlackId] = useState('')
  const [email, setEmail] = useState('')

  const { data: interviewers = [] } = useInterviewers()
  const slackUsers = useSlackUsers(open)
  const create = useCreateInterviewer()
  const update = useUpdateInterviewer()
  const isPending = create.isPending || update.isPending

  // 편집 모드 진입 시 기존 값으로 초기화
  useEffect(() => {
    if (open) {
      setName(interviewer?.name ?? '')
      setSlackId(interviewer?.slackId ?? '')
      setEmail(interviewer?.email ?? '')
    }
  }, [open, interviewer])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedSlack = slackId.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) return

    const isDuplicate = trimmedSlack
      ? interviewers.some((iv) => iv.slackId === trimmedSlack && iv.id !== interviewer?.id)
      : false
    if (isDuplicate) {
      toast.error('이미 등록된 슬랙 멤버 ID입니다.')
      return
    }

    try {
      if (isEdit) {
        await update.mutateAsync({
          id: interviewer.id,
          input: { name: trimmedName, slackId: trimmedSlack, email: trimmedEmail || undefined },
        })
        toast.success('면접관 정보가 수정되었습니다.')
      } else {
        await create.mutateAsync({ name: trimmedName, slackId: trimmedSlack, email: trimmedEmail || undefined })
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
          <DialogTitle>{isEdit ? '면접관 풀 편집' : 'Slack에서 면접관 추가'}</DialogTitle>
          <DialogDescription>
            Slack 임직원 중 인터뷰에 배치할 사람을 선택합니다. 권한 승인 전에는 직접 입력도 가능합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <SlackUserSearch
            users={slackUsers.data?.users ?? []}
            isLoading={slackUsers.isLoading}
            error={slackUsers.error}
            onSelect={(user) => {
              setName(user.realName || user.displayName || user.name)
              setSlackId(user.id)
              setEmail(user.email ?? '')
            }}
          />

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">직접 입력</span>
            <div className="h-px flex-1 bg-border" />
          </div>

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
            <Label htmlFor="slackId">슬랙 멤버 ID</Label>
            <Input
              id="slackId"
              value={slackId}
              onChange={(e) => setSlackId(e.target.value)}
              placeholder="U0123456789"
            />
            <p className="text-xs text-muted-foreground">
              Slack 프로필 → 더보기(⋯) → <strong>멤버 ID 복사</strong>에서 확인
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">이메일 <span className="text-muted-foreground font-normal">(선택)</span></Label>
            <div className="relative">
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hong@example.com"
                className="pr-8"
              />
              {email && (
                <button
                  type="button"
                  onClick={() => setEmail('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
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
