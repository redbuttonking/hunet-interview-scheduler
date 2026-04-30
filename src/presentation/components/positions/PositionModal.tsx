'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Position, Round } from '@/domain/model/Position'
import { Interviewer } from '@/domain/model/Interviewer'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { useCreatePosition, useUpdatePosition } from '@/application/usecase/position/usePositions'

const ALL_ROUNDS: Round[] = ['1차', '2차', '3차']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: Position | null
}

/** 차수별 면접관 검색 인풋 컴포넌트 */
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

  // 검색어로 필터링 (추가되지 않은 면접관만)
  const filtered = allInterviewers.filter((iv) => {
    if (addedIds.includes(iv.id)) return false
    if (!query) return true
    const q = query.toLowerCase()
    return iv.name.includes(q) || iv.slackId.toLowerCase().includes(q)
  })

  // 외부 클릭 시 드롭다운 닫기
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

  function handleSelect(id: string) {
    onAdd(id)
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold text-muted-foreground">{round} 면접관</span>

      {/* 선택된 면접관 태그 */}
      {addedInterviewers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {addedInterviewers.map((iv) => (
            <span
              key={iv.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {iv.name}
              <button
                type="button"
                onClick={() => onRemove(iv.id)}
                className="hover:text-primary/60 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 검색 인풋 */}
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

        {/* 검색 결과 드롭다운 */}
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
                    onMouseDown={(e) => {
                      e.preventDefault() // blur 방지
                      handleSelect(iv.id)
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted transition-colors"
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

export default function PositionModal({ open, onOpenChange, position }: Props) {
  const isEdit = position !== null
  const { data: interviewers = [] } = useInterviewers()

  const [name, setName] = useState('')
  const [selectedRounds, setSelectedRounds] = useState<Round[]>([])
  const [oneDayInterview, setOneDayInterview] = useState(false)
  const [ivByRound, setIvByRound] = useState<Partial<Record<Round, string[]>>>({})

  const create = useCreatePosition()
  const update = useUpdatePosition()
  const isPending = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (position) {
      setName(position.name)
      setSelectedRounds([...position.rounds])
      setOneDayInterview(position.oneDayInterview)
      setIvByRound({ ...position.interviewersByRound })
    } else {
      setName('')
      setSelectedRounds([])
      setOneDayInterview(false)
      setIvByRound({})
    }
  }, [open, position])

  function toggleRound(round: Round) {
    setSelectedRounds((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round],
    )
    if (round === '1차' || round === '2차') setOneDayInterview(false)
  }

  const canOneDay = selectedRounds.includes('1차') && selectedRounds.includes('2차')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || selectedRounds.length === 0) return

    const payload = {
      name: name.trim(),
      rounds: selectedRounds,
      oneDayInterview: canOneDay ? oneDayInterview : false,
      interviewersByRound: ivByRound,
    }

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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* 채용 절차 */}
          <div className="flex flex-col gap-2">
            <Label>채용 절차</Label>
            <div className="flex gap-2">
              {ALL_ROUNDS.map((round) => {
                const active = selectedRounds.includes(round)
                return (
                  <button
                    key={round}
                    type="button"
                    onClick={() => toggleRound(round)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50',
                    )}
                  >
                    {round}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 원데이 인터뷰 */}
          {canOneDay && (
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <p className="text-sm font-medium">원데이 인터뷰</p>
              <button
                type="button"
                onClick={() => setOneDayInterview((v) => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  oneDayInterview ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                    oneDayInterview ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
            </div>
          )}

          {/* 차수별 면접관 배치 */}
          {selectedRounds.length > 0 && (
            <div className="flex flex-col gap-3">
              <Label>면접관 배치</Label>
              {ALL_ROUNDS.filter((r) => selectedRounds.includes(r)).map((round) => (
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
            <Button type="submit" disabled={isPending || !name.trim() || selectedRounds.length === 0}>
              {isPending ? '저장 중...' : isEdit ? '저장' : '추가'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
