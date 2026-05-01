'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, Search, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Position, Round, InterviewType, ALL_ROUNDS } from '@/domain/model/Position'
import { Interviewer } from '@/domain/model/Interviewer'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { useCreatePosition, useUpdatePosition } from '@/application/usecase/position/usePositions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: Position | null
}

function InterviewerSearch({
  round,
  allInterviewers,
  addedIds,
  onAdd,
  onRemove,
}: {
  round: Round
  allInterviewers: Interviewer[]
  addedIds: string[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const addedInterviewers = allInterviewers.filter((iv) => addedIds.includes(iv.id))
  const filtered = allInterviewers.filter((iv) => {
    if (addedIds.includes(iv.id)) return false
    if (!query) return true
    const q = query.toLowerCase()
    return iv.name.includes(q) || iv.slackId.toLowerCase().includes(q)
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
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold text-muted-foreground">{round} 면접관</span>
      {addedInterviewers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {addedInterviewers.map((iv) => (
            <span key={iv.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {iv.name}
              <button type="button" onClick={() => onRemove(iv.id)} className="hover:text-primary/60">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="이름 또는 슬랙 ID 검색"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {focused && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                {query ? '검색 결과가 없습니다' : '추가할 면접관이 없습니다'}
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto">
                {filtered.map((iv) => (
                  <button
                    key={iv.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onAdd(iv.id); setQuery('') }}
                    className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="text-sm font-medium">{iv.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">@{iv.slackId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ROUND_COLORS: Record<Round, string> = {
  '1차': 'bg-blue-50 text-blue-700 border-blue-200',
  '2차': 'bg-violet-50 text-violet-700 border-violet-200',
  '3차': 'bg-orange-50 text-orange-700 border-orange-200',
}

export default function PositionModal({ open, onOpenChange, position }: Props) {
  const isEdit = position !== null
  const { data: interviewers = [] } = useInterviewers()
  const create = useCreatePosition()
  const update = useUpdatePosition()
  const isPending = create.isPending || update.isPending

  const [name, setName] = useState('')
  const [interviewTypes, setInterviewTypes] = useState<InterviewType[]>([])
  const [ivByRound, setIvByRound] = useState<Partial<Record<Round, string[]>>>({})

  useEffect(() => {
    if (!open) return
    if (position) {
      setName(position.name)
      setInterviewTypes(position.interviewTypes.map((t) => ({
        label: t.label,
        sessions: t.sessions.map((s) => ({ rounds: [...s.rounds] })),
      })))
      setIvByRound({ ...position.interviewersByRound })
    } else {
      setName('')
      setInterviewTypes([])
      setIvByRound({})
    }
  }, [open, position])

  // 모든 유형에서 사용된 차수 집합
  const usedRounds = ALL_ROUNDS.filter((r) =>
    interviewTypes.some((t) => t.sessions.some((s) => s.rounds.includes(r))),
  )

  function addType() {
    setInterviewTypes((prev) => [...prev, { label: '', sessions: [{ rounds: [] }] }])
  }

  function removeType(ti: number) {
    setInterviewTypes((prev) => prev.filter((_, i) => i !== ti))
  }

  function updateTypeLabel(ti: number, label: string) {
    setInterviewTypes((prev) => prev.map((t, i) => i === ti ? { ...t, label } : t))
  }

  function addSession(ti: number) {
    setInterviewTypes((prev) =>
      prev.map((t, i) => i === ti ? { ...t, sessions: [...t.sessions, { rounds: [] }] } : t),
    )
  }

  function removeSession(ti: number, si: number) {
    setInterviewTypes((prev) =>
      prev.map((t, i) => i === ti ? { ...t, sessions: t.sessions.filter((_, j) => j !== si) } : t),
    )
  }

  function toggleRound(ti: number, si: number, round: Round) {
    setInterviewTypes((prev) =>
      prev.map((t, i) => {
        if (i !== ti) return t
        return {
          ...t,
          sessions: t.sessions.map((s, j) => {
            if (j !== si) return s
            const next = s.rounds.includes(round)
              ? s.rounds.filter((r) => r !== round)
              : [...s.rounds, round]
            return { rounds: ALL_ROUNDS.filter((r) => next.includes(r)) }
          }),
        }
      }),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('포지션명을 입력해주세요.')
    if (interviewTypes.length === 0) return toast.error('인터뷰 유형을 1개 이상 추가해주세요.')
    if (interviewTypes.some((t) => !t.label.trim())) return toast.error('모든 인터뷰 유형에 이름을 입력해주세요.')
    if (interviewTypes.some((t) => t.sessions.some((s) => s.rounds.length === 0)))
      return toast.error('모든 세션에 차수를 1개 이상 선택해주세요.')

    const payload = { name: name.trim(), interviewTypes, interviewersByRound: ivByRound }

    try {
      if (isEdit) {
        await update.mutateAsync({ id: position.id, input: payload })
        toast.success('포지션이 수정되었습니다.')
      } else {
        await create.mutateAsync(payload)
        toast.success('포지션이 추가되었습니다.')
      }
      onOpenChange(false)
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '포지션 편집' : '포지션 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
          {/* 포지션명 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="posName">포지션명</Label>
            <Input
              id="posName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 프론트엔드 개발자"
              required
            />
          </div>

          {/* 인터뷰 유형 */}
          <div className="flex flex-col gap-2">
            <Label>인터뷰 유형</Label>
            <div className="flex flex-col gap-3">
              {interviewTypes.map((type, ti) => (
                <div key={ti} className="rounded-lg border border-border p-3 flex flex-col gap-2.5">
                  {/* 유형명 + 삭제 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={type.label}
                      onChange={(e) => updateTypeLabel(ti, e.target.value)}
                      placeholder="유형명 (예: 1차 면접, 원데이 1차→2차)"
                      className="flex-1 px-2.5 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => removeType(ti)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* 세션 목록 */}
                  {type.sessions.map((session, si) => (
                    <div key={si} className="flex items-center gap-2 pl-1">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">
                        {type.sessions.length > 1 ? `세션 ${si + 1}` : '세션'}
                      </span>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {ALL_ROUNDS.map((round) => {
                          const active = session.rounds.includes(round)
                          return (
                            <button
                              key={round}
                              type="button"
                              onClick={() => toggleRound(ti, si, round)}
                              className={cn(
                                'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                                active ? ROUND_COLORS[round] : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                              )}
                            >
                              {round}
                            </button>
                          )
                        })}
                      </div>
                      {type.sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSession(ti, si)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSession(ti)}
                    className="text-xs text-primary hover:underline text-left pl-1"
                  >
                    + 세션 추가
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addType}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
            >
              <Plus size={14} />
              인터뷰 유형 추가
            </button>
          </div>

          {/* 차수별 면접관 배치 */}
          {usedRounds.length > 0 && (
            <div className="flex flex-col gap-3">
              <Label>면접관 배치</Label>
              {usedRounds.map((round) => (
                <InterviewerSearch
                  key={round}
                  round={round}
                  allInterviewers={interviewers}
                  addedIds={ivByRound[round] ?? []}
                  onAdd={(id) =>
                    setIvByRound((prev) => ({ ...prev, [round]: [...(prev[round] ?? []), id] }))
                  }
                  onRemove={(id) =>
                    setIvByRound((prev) => ({
                      ...prev,
                      [round]: (prev[round] ?? []).filter((i) => i !== id),
                    }))
                  }
                />
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || interviewTypes.length === 0}>
              {isPending ? '저장 중...' : isEdit ? '저장' : '추가'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
