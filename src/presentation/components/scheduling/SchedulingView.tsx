'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, CalendarDays, CheckCircle2, Circle, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Interview, InterviewStatus } from '@/domain/model/Interview'
import { Interviewer } from '@/domain/model/Interviewer'
import { useInterviews, useDeleteInterview, useSendSlack } from '@/application/usecase/interview/useInterviews'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import InterviewCreateModal from './InterviewCreateModal'
import AvailabilityInputModal from './AvailabilityInputModal'
import ScheduleRecommendModal from './ScheduleRecommendModal'

const STATUS_CONFIG: Record<InterviewStatus, { label: string; className: string }> = {
  pending_slack: { label: '슬랙 발송 전', className: 'bg-muted text-muted-foreground' },
  collecting: { label: '수집 중', className: 'bg-blue-50 text-blue-700' },
  ready_to_schedule: { label: '일정 추천 가능', className: 'bg-emerald-50 text-emerald-700' },
  confirmed: { label: '확정', className: 'bg-primary/10 text-primary' },
}

const SCHEDULE_LABEL: Record<string, string> = {
  '1차': '1차',
  '2차': '2차',
  '3차': '3차',
  oneday: '원데이',
}


interface AvailabilityModalState {
  interview: Interview
  interviewer: Interviewer
}

interface RecommendModalState {
  interview: Interview
}

export default function SchedulingView() {
  const { data: interviews = [], isLoading } = useInterviews()
  const { data: interviewers = [] } = useInterviewers()
  const deleteInterview = useDeleteInterview()
  const sendSlack = useSendSlack()

  const [createOpen, setCreateOpen] = useState(false)
  const [availModal, setAvailModal] = useState<AvailabilityModalState | null>(null)
  const [recommendModal, setRecommendModal] = useState<RecommendModalState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Interview | null>(null)

  function getInterviewer(id: string) {
    return interviewers.find((iv) => iv.id === id)
  }

  async function handleSendSlack(interview: Interview) {
    try {
      await sendSlack.mutateAsync(interview.id)
      toast.success('수집 상태로 전환되었습니다.')
    } catch {
      toast.error('오류가 발생했습니다.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteInterview.mutateAsync(deleteTarget.id)
      toast.success('삭제되었습니다.')
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="max-w-3xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">일정 조율</h1>
          <p className="text-sm text-muted-foreground mt-1">후보자별 면접 일정을 생성하고 조율합니다.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus size={15} />
          새 면접 만들기
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
      {!isLoading && interviews.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <CalendarDays size={22} className="opacity-40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">진행 중인 면접 조율이 없습니다</p>
            <p className="text-xs mt-1">새 면접 만들기 버튼을 눌러 시작해주세요.</p>
          </div>
        </div>
      )}

      {/* 카드 목록 */}
      {!isLoading && interviews.length > 0 && (
        <div className="space-y-3">
          {interviews.map((interview) => {
            const cfg = STATUS_CONFIG[interview.status]
            const submittedIds = new Set(interview.availabilities.map((a) => a.interviewerId))
            const period = interview.availabilityPeriod

            return (
              <div key={interview.id} className="bg-card rounded-xl border border-border shadow-sm p-5">
                {/* 카드 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.className)}>
                      {cfg.label}
                    </span>
                    <span className="text-base font-bold text-foreground">{interview.candidateName}</span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="text-sm text-muted-foreground">{interview.positionName}</span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="text-sm text-muted-foreground">{SCHEDULE_LABEL[interview.scheduleType]}</span>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(interview)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* 기간 */}
                {period && (
                  <p className="text-xs text-muted-foreground mt-2">
                    요청 기간: {period.startDate} ~ {period.endDate}
                  </p>
                )}

                {/* pending_slack: 슬랙 발송 버튼 */}
                {interview.status === 'pending_slack' && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleSendSlack(interview)}
                      disabled={sendSlack.isPending}
                    >
                      <Send size={13} />
                      슬랙 발송
                    </Button>
                  </div>
                )}

                {/* collecting: 면접관별 입력 현황 */}
                {(interview.status === 'collecting' || interview.status === 'ready_to_schedule') && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      면접관 가용 일정 ({submittedIds.size}/{interview.interviewerIds.length}명 입력)
                    </p>
                    {interview.interviewerIds.map((id) => {
                      const iv = getInterviewer(id)
                      const submitted = submittedIds.has(id)
                      return (
                        <div key={id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            {submitted ? (
                              <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : (
                              <Circle size={14} className="text-muted-foreground/40" />
                            )}
                            <span className={submitted ? 'text-foreground' : 'text-muted-foreground'}>
                              {iv?.name ?? id}
                            </span>
                          </div>
                          {!submitted && iv && (
                            <button
                              onClick={() => setAvailModal({ interview, interviewer: iv })}
                              className="text-xs text-primary hover:underline"
                            >
                              일정 입력
                            </button>
                          )}
                          {submitted && iv && (
                            <button
                              onClick={() => setAvailModal({ interview, interviewer: iv })}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              수정
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ready_to_schedule: 추천 버튼 */}
                {interview.status === 'ready_to_schedule' && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setRecommendModal({ interview })}
                    >
                      <CalendarDays size={13} />
                      일정 추천
                    </Button>
                  </div>
                )}

                {/* confirmed: 확정 정보 */}
                {interview.status === 'confirmed' && interview.confirmedSlot && (
                  <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <p className="font-semibold text-primary">확정 완료</p>
                    <p className="text-foreground mt-1">
                      {interview.confirmedSlot.date}&nbsp;
                      {interview.confirmedSlot.startTime} ~ {interview.confirmedSlot.endTime}
                      &nbsp;·&nbsp;{interview.confirmedSlot.roomName}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 모달 */}
      <InterviewCreateModal open={createOpen} onOpenChange={setCreateOpen} />

      {availModal && (
        <AvailabilityInputModal
          open={!!availModal}
          onOpenChange={(o) => !o && setAvailModal(null)}
          interview={availModal.interview}
          interviewer={availModal.interviewer}
        />
      )}

      {recommendModal && (
        <ScheduleRecommendModal
          open={!!recommendModal}
          onOpenChange={(o) => !o && setRecommendModal(null)}
          interview={recommendModal.interview}
        />
      )}

      {/* 삭제 확인 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>면접 조율 건 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.candidateName}</span>님의
              면접 조율 건을 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteInterview.isPending}
            >
              {deleteInterview.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
