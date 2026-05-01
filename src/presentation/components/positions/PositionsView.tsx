'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Position, Round, ALL_ROUNDS } from '@/domain/model/Position'
import { usePositions, useDeletePosition } from '@/application/usecase/position/usePositions'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import PositionModal from './PositionModal'

const ROUND_COLORS: Record<Round, string> = {
  '1차': 'bg-blue-50 text-blue-700 border-blue-200',
  '2차': 'bg-violet-50 text-violet-700 border-violet-200',
  '3차': 'bg-orange-50 text-orange-700 border-orange-200',
}

const ROUND_TEXT_COLORS: Record<Round, string> = {
  '1차': 'text-blue-600',
  '2차': 'text-violet-600',
  '3차': 'text-orange-600',
}

export default function PositionsView() {
  const { data: positions = [], isLoading } = usePositions()
  const { data: interviewers = [] } = useInterviewers()
  const deletePosition = useDeletePosition()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Position | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null)

  function getInterviewerName(id: string) {
    return interviewers.find((iv) => iv.id === id)?.name ?? '알 수 없음'
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    try {
      await deletePosition.mutateAsync(deleteTarget.id)
      toast.success(`${deleteTarget.name} 포지션이 삭제되었습니다.`)
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">포지션 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">채용 절차와 면접관을 포지션별로 설정합니다.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true) }} className="gap-2">
          <Plus size={15} />
          포지션 추가
        </Button>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">불러오는 중...</span>
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && positions.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Briefcase size={22} className="opacity-40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">등록된 포지션이 없습니다</p>
            <p className="text-xs mt-1">포지션 추가 버튼을 눌러 등록해주세요.</p>
          </div>
        </div>
      )}

      {/* 카드 그리드 */}
      {!isLoading && positions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {positions.map((pos) => {
            const usedRounds = ALL_ROUNDS.filter((r) =>
              pos.interviewTypes.some((t) => t.sessions.some((s) => s.rounds.includes(r))),
            )
            const hasInterviewers = usedRounds.some((r) => (pos.interviewersByRound[r] ?? []).length > 0)

            return (
              <div
                key={pos.id}
                className="group bg-card rounded-xl border border-border shadow-sm p-5 flex flex-col gap-4 h-64"
              >
                {/* 포지션명 + 액션 */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-foreground leading-snug">{pos.name}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => { setEditing(pos); setModalOpen(true) }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(pos)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* 인터뷰 유형 목록 */}
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">인터뷰 유형</p>
                  <div className="flex flex-col gap-2 overflow-y-auto">
                    {pos.interviewTypes.map((type, ti) => (
                      <div key={ti} className="flex items-center gap-1.5 flex-wrap">
                        {/* 세션 배지 먼저 */}
                        {type.sessions.map((session, si) => (
                          <span key={si} className="flex items-center gap-1 shrink-0">
                            {si > 0 && <span className="text-muted-foreground text-xs">→</span>}
                            {session.rounds.map((r) => (
                              <span
                                key={r}
                                className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border',
                                  ROUND_COLORS[r],
                                )}
                              >
                                {r}
                              </span>
                            ))}
                          </span>
                        ))}
                        {/* 유형명 */}
                        <span className="text-muted-foreground text-xs">—</span>
                        <span className="text-xs text-foreground font-medium">{type.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 면접관 */}
                {hasInterviewers && (
                  <div className="pt-3 border-t border-border flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">면접관</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {usedRounds.map((round) => {
                        const names = (pos.interviewersByRound[round] ?? []).map(getInterviewerName)
                        if (names.length === 0) return null
                        return (
                          <div key={round} className="flex items-center gap-1.5 text-xs">
                            <span className={cn('font-semibold shrink-0', ROUND_TEXT_COLORS[round])}>{round}</span>
                            <span className="text-muted-foreground">{names.join(', ')}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <PositionModal open={modalOpen} onOpenChange={setModalOpen} position={editing} />

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>포지션 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> 포지션을
              삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deletePosition.isPending}>
              {deletePosition.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
