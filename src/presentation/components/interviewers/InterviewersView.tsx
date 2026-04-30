'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Interviewer } from '@/domain/model/Interviewer'
import { useInterviewers, useDeleteInterviewer } from '@/application/usecase/interviewer/useInterviewers'
import { usePositions } from '@/application/usecase/position/usePositions'
import InterviewerModal from './InterviewerModal'

export default function InterviewersView() {
  const { data: interviewers = [], isLoading } = useInterviewers()
  const { data: positions = [] } = usePositions()
  const deleteInterviewer = useDeleteInterviewer()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Interviewer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Interviewer | null>(null)

  function getPositionNames(interviewerId: string): string[] {
    return positions
      .filter((p) =>
        Object.values(p.interviewersByRound).some((ids) => ids.includes(interviewerId)),
      )
      .map((p) => p.name)
  }

  function handleAddClick() {
    setEditing(null)
    setModalOpen(true)
  }

  function handleEditClick(interviewer: Interviewer) {
    setEditing(interviewer)
    setModalOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    try {
      await deleteInterviewer.mutateAsync(deleteTarget.id)
      toast.success(`${deleteTarget.name} 면접관이 삭제되었습니다.`)
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
          <h1 className="text-2xl font-bold text-foreground">면접관 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">면접관을 등록하고 슬랙 ID를 관리합니다.</p>
        </div>
        <Button onClick={handleAddClick} className="gap-2">
          <Plus size={15} />
          면접관 추가
        </Button>
      </div>

      {/* 카드 컨테이너 */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] px-5 py-3 border-b border-border bg-muted/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">이름</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">슬랙 ID</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">소속 포지션</span>
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
        {!isLoading && interviewers.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Users size={22} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">등록된 면접관이 없습니다</p>
              <p className="text-xs mt-1">면접관 추가 버튼을 눌러 등록해주세요.</p>
            </div>
          </div>
        )}

        {/* 목록 */}
        {!isLoading && interviewers.length > 0 && (
          <div className="divide-y divide-border">
            {interviewers.map((iv) => {
              const positionNames = getPositionNames(iv.id)
              return (
                <div
                  key={iv.id}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] items-center px-5 py-4 hover:bg-muted/30 transition-colors group"
                >
                  {/* 이름 */}
                  <span className="text-sm font-medium text-foreground">{iv.name}</span>

                  {/* 슬랙 ID */}
                  <span className="text-sm text-muted-foreground font-mono">@{iv.slackId}</span>

                  {/* 소속 포지션 */}
                  <div className="flex flex-wrap gap-1">
                    {positionNames.length > 0 ? (
                      positionNames.map((name) => (
                        <Badge
                          key={name}
                          variant="secondary"
                          className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-0"
                        >
                          {name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">미배치</span>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-16 justify-end">
                    <button
                      onClick={() => handleEditClick(iv)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(iv)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 총 인원 표시 */}
        {!isLoading && interviewers.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">총 {interviewers.length}명</span>
          </div>
        )}
      </div>

      {/* 모달 */}
      <InterviewerModal open={modalOpen} onOpenChange={setModalOpen} interviewer={editing} />

      {/* 삭제 확인 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>면접관 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> 면접관을
              삭제하시겠습니까? 포지션 배치에서도 함께 제거됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteInterviewer.isPending}
            >
              {deleteInterviewer.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
