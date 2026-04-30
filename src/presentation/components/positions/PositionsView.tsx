'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Position, Round } from '@/domain/model/Position'
import { usePositions, useDeletePosition } from '@/application/usecase/position/usePositions'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import PositionModal from './PositionModal'

const ROUND_COLORS: Record<Round, string> = {
  '1차': 'bg-blue-50 text-blue-700 border-blue-200',
  '2차': 'bg-violet-50 text-violet-700 border-violet-200',
  '3차': 'bg-orange-50 text-orange-700 border-orange-200',
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

  function handleAddClick() {
    setEditing(null)
    setModalOpen(true)
  }

  function handleEditClick(position: Position) {
    setEditing(position)
    setModalOpen(true)
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
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">포지션 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">채용 절차와 면접관을 포지션별로 설정합니다.</p>
        </div>
        <Button onClick={handleAddClick} className="gap-2">
          <Plus size={15} />
          포지션 추가
        </Button>
      </div>

      {/* 카드 컨테이너 */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[1.5fr_1fr_auto_auto] px-5 py-3 border-b border-border bg-muted/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">포지션명</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">채용 절차</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28 text-center">원데이 인터뷰</span>
          <span className="w-16" />
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

        {/* 목록 */}
        {!isLoading && positions.length > 0 && (
          <div className="divide-y divide-border">
            {positions.map((pos) => {
              // 차수별 면접관 이름 목록
              const roundInterviewers = pos.rounds.reduce<Record<Round, string[]>>(
                (acc, round) => {
                  acc[round] = (pos.interviewersByRound[round] ?? []).map(getInterviewerName)
                  return acc
                },
                {} as Record<Round, string[]>,
              )

              return (
                <div key={pos.id} className="group hover:bg-muted/30 transition-colors">
                  <div className="grid grid-cols-[1.5fr_1fr_auto_auto] items-start px-5 py-4">
                    {/* 포지션명 */}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{pos.name}</p>
                    </div>

                    {/* 채용 절차 태그 */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {pos.rounds.map((round) => (
                        <span
                          key={round}
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                            ROUND_COLORS[round],
                          )}
                        >
                          {round}
                        </span>
                      ))}
                    </div>

                    {/* 원데이 인터뷰 */}
                    <div className="flex justify-center w-28 pt-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          pos.oneDayInterview
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {pos.oneDayInterview ? 'ON' : 'OFF'}
                      </span>
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-16 justify-end">
                      <button
                        onClick={() => handleEditClick(pos)}
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

                  {/* 차수별 면접관 표시 */}
                  {pos.rounds.some((r) => (pos.interviewersByRound[r] ?? []).length > 0) && (
                    <div className="px-5 pb-3 flex flex-wrap gap-x-6 gap-y-1">
                      {pos.rounds.map((round) => {
                        const names = roundInterviewers[round]
                        if (!names || names.length === 0) return null
                        return (
                          <div key={round} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={cn(
                              'font-semibold',
                              round === '1차' ? 'text-blue-600' :
                              round === '2차' ? 'text-violet-600' : 'text-orange-600'
                            )}>
                              {round}
                            </span>
                            <span>{names.join(', ')}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 총 건수 */}
        {!isLoading && positions.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">총 {positions.length}개</span>
          </div>
        )}
      </div>

      {/* 모달 */}
      <PositionModal open={modalOpen} onOpenChange={setModalOpen} position={editing} />

      {/* 삭제 확인 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>포지션 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> 포지션을
              삭제하시겠습니까? 관련된 면접 배치 설정도 함께 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletePosition.isPending}
            >
              {deletePosition.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
