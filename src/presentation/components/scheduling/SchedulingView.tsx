'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getIdToken } from 'firebase/auth'
import { Plus, CalendarDays, CheckCircle2, Circle, Send, Trash2, RotateCcw, FileText, Users, Zap, Pencil } from 'lucide-react'
import { auth } from '@/infrastructure/firebase/config'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Interview, InterviewStatus } from '@/domain/model/Interview'
import { Interviewer } from '@/domain/model/Interviewer'
import { useInterviews, useDeleteInterview, useRevertConfirmation, useSendCancellationSlack } from '@/application/usecase/interview/useInterviews'
import { useInterviewers } from '@/application/usecase/interviewer/useInterviewers'
import { usePositions } from '@/application/usecase/position/usePositions'
import InterviewCreateModal from './InterviewCreateModal'
import InterviewEditModal from './InterviewEditModal'
import AvailabilityInputModal from './AvailabilityInputModal'
import ScheduleRecommendModal from './ScheduleRecommendModal'
import CandidateOptionsModal from './CandidateOptionsModal'
import CandidateChoiceModal from './CandidateChoiceModal'
import SlackSendModal from './SlackSendModal'
import SlackTemplateModal from './SlackTemplateModal'
import CandidateNotifyModal from './CandidateNotifyModal'

const STATUS_CONFIG: Record<InterviewStatus, { label: string; className: string }> = {
  pending_slack: { label: '슬랙 발송 전', className: 'bg-muted text-muted-foreground' },
  collecting: { label: '수집 중', className: 'bg-blue-50 text-blue-700' },
  ready_to_schedule: { label: '일정 추천 가능', className: 'bg-amber-50 text-amber-700' },
  pending_candidate: { label: '후보자 응답 대기', className: 'bg-emerald-50 text-emerald-700' },
  confirmed: { label: '확정', className: 'bg-blue-50 text-blue-700' },
}

type FilterStatus = 'all' | InterviewStatus

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending_slack', label: '슬랙 발송 전' },
  { value: 'collecting', label: '수집 중' },
  { value: 'ready_to_schedule', label: '일정 추천 가능' },
  { value: 'pending_candidate', label: '후보자 응답 대기' },
  { value: 'confirmed', label: '확정' },
]

const STATUS_ORDER: Record<InterviewStatus, number> = {
  pending_slack: 0,
  collecting: 1,
  ready_to_schedule: 2,
  pending_candidate: 3,
  confirmed: 4,
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
  const { data: positionList = [] } = usePositions()
  const deleteInterview = useDeleteInterview()
  const revertConfirmation = useRevertConfirmation()
  const sendCancellationSlack = useSendCancellationSlack()

  const [createOpen, setCreateOpen] = useState(false)
  const [availModal, setAvailModal] = useState<AvailabilityModalState | null>(null)
  const [recommendModal, setRecommendModal] = useState<RecommendModalState | null>(null)
  const [proposeModal, setProposeModal] = useState<Interview | null>(null)
  const [choiceModal, setChoiceModal] = useState<Interview | null>(null)
  const [slackModal, setSlackModal] = useState<Interview | null>(null)
  const [resendDmIds, setResendDmIds] = useState<string[] | null>(null)
  const [resendConfirm, setResendConfirm] = useState<{ interview: Interview; interviewerId: string } | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editModal, setEditModal] = useState<Interview | null>(null)
  const [notifyModal, setNotifyModal] = useState<Interview | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Interview | null>(null)
  const [revertTarget, setRevertTarget] = useState<Interview | null>(null)

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterPosition, setFilterPosition] = useState<string>('all')

  // 상태별 건수 (포지션 필터와 무관하게 전체 카운트)
  const statusCounts = useMemo(
    () =>
      interviews.reduce(
        (acc, iv) => ({ ...acc, [iv.status]: (acc[iv.status] ?? 0) + 1 }),
        {} as Partial<Record<InterviewStatus, number>>,
      ),
    [interviews],
  )

  // 현재 상태 필터 기준 포지션 목록 — 해당 상태에 없는 포지션은 버튼으로 노출 안 함
  const positions = useMemo(() => {
    const statusFiltered = filterStatus === 'all'
      ? interviews
      : interviews.filter((iv) => iv.status === filterStatus)
    return Array.from(new Set(statusFiltered.map((iv) => iv.positionName))).sort()
  }, [interviews, filterStatus])

  const filteredInterviews = useMemo(
    () =>
      interviews
        .filter((iv) => filterStatus === 'all' || iv.status === filterStatus)
        .filter((iv) => filterPosition === 'all' || iv.positionName === filterPosition)
        .sort((a, b) =>
          filterStatus === 'all' ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status] : 0,
        ),
    [interviews, filterStatus, filterPosition],
  )

  // 상태 필터 변경 시 현재 포지션이 새 목록에 없으면 초기화
  function handleStatusFilter(value: FilterStatus) {
    setFilterStatus(value)
    setFilterPosition('all')
  }

  function getInterviewer(id: string) {
    return interviewers.find((iv) => iv.id === id)
  }

  async function handleResend() {
    if (!resendConfirm) return
    setIsResending(true)
    try {
      if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
      const token = await getIdToken(auth.currentUser)
      const res = await fetch('/api/slack/remind-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          interviewId: resendConfirm.interview.id,
          interviewerId: resendConfirm.interviewerId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? '발송 실패')
      toast.success('리마인드 메시지를 채널에 발송했습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '발송 중 오류가 발생했습니다.')
    } finally {
      setIsResending(false)
      setResendConfirm(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      // 슬랙 발송 이후 상태라면 면접관들에게 취소 DM 발송 (실패해도 삭제는 진행)
      if (deleteTarget.status !== 'pending_slack') {
        const slackIds = deleteTarget.interviewerIds
          .map((id) => getInterviewer(id)?.slackId)
          .filter((id): id is string => !!id)
        if (slackIds.length > 0) {
          const message = `[취소 안내] ${deleteTarget.candidateName}님(${deleteTarget.positionName}) 면접 가용 일정 조율이 취소되었습니다. 수고 많으셨습니다.`
          await sendCancellationSlack.mutateAsync({ slackIds, message }).catch(() => {
            toast.warning('취소 알림 슬랙 발송에 실패했습니다. 면접관에게 직접 알려주세요.')
          })
        }
      }
      await deleteInterview.mutateAsync(deleteTarget)
      toast.success('삭제되었습니다.')
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleRevert() {
    if (!revertTarget) return
    try {
      await revertConfirmation.mutateAsync(revertTarget)
      toast.success('확정이 취소되었습니다. 일정 추천 가능 상태로 돌아갑니다.')
    } catch {
      toast.error('확정 취소 중 오류가 발생했습니다.')
    } finally {
      setRevertTarget(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">일정 조율</h1>
          <p className="text-sm text-muted-foreground mt-1">후보자별 인터뷰 일정을 생성하고 조율합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)} className="gap-1.5">
            <FileText size={14} />
            메시지 템플릿
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus size={15} />
            새 인터뷰 만들기
          </Button>
        </div>
      </div>

      {/* 필터 */}
      {!isLoading && interviews.length > 0 && (
        <div className="flex flex-col gap-3 mb-2">
          {/* 상태 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            {FILTER_OPTIONS.map((opt) => {
              const count = opt.value === 'all' ? interviews.length : (statusCounts[opt.value as InterviewStatus] ?? 0)
              const isActive = filterStatus === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusFilter(opt.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {opt.label}
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                      isActive ? 'bg-white/20' : 'bg-muted',
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 포지션 필터 — 포지션이 많아도 가로 스크롤로 수용 */}
          {positions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium shrink-0">포지션</span>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
                <button
                  onClick={() => setFilterPosition('all')}
                  className={cn(
                    'shrink-0 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                    filterPosition === 'all'
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
                  )}
                >
                  전체
                </button>
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setFilterPosition(pos)}
                    className={cn(
                      'shrink-0 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                      filterPosition === pos
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
                    )}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
            <p className="text-sm font-medium text-foreground">진행 중인 인터뷰 조율이 없습니다</p>
            <p className="text-xs mt-1">새 면접 만들기 버튼을 눌러 시작해주세요.</p>
          </div>
        </div>
      )}

      {/* 필터 결과 없음 */}
      {!isLoading && interviews.length > 0 && filteredInterviews.length === 0 && (
        <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
          <p className="text-sm">해당 조건의 인터뷰 조율 건이 없습니다.</p>
        </div>
      )}

      {/* 카드 목록 */}
      {!isLoading && filteredInterviews.length > 0 && (
        <div className="space-y-3">
          {filteredInterviews.map((interview) => {
            const cfg = STATUS_CONFIG[interview.status]
            const submittedIds = new Set(interview.availabilities.map((a) => a.interviewerId))
            const period = interview.availabilityPeriod

            return (
              <div key={interview.id} className="bg-card rounded-xl border border-border shadow-sm p-5">
                {/* 카드 헤더: 배지 + 삭제 */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={cn('text-sm font-semibold px-3 py-1.5 rounded-full whitespace-nowrap', cfg.className)}>
                    {cfg.label}
                    {(interview.status === 'collecting' || interview.status === 'ready_to_schedule') && (
                      <span className="ml-1 opacity-70">
                        {submittedIds.size}/{interview.interviewerIds.length}명
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {interview.status === 'pending_slack' && (
                      <button
                        onClick={() => setEditModal(interview)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(interview)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {/* 후보자 정보 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-foreground">{interview.candidateName}</span>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="text-sm text-muted-foreground">{interview.positionName}</span>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="text-sm text-muted-foreground">{interview.typeLabel}</span>
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
                      onClick={() => setSlackModal(interview)}
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
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setResendConfirm({ interview, interviewerId: iv.id })}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                재발송
                              </button>
                              <button
                                onClick={() => setAvailModal({ interview, interviewer: iv })}
                                className="text-xs text-primary hover:underline"
                              >
                                일정 입력
                              </button>
                            </div>
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

                {/* ready_to_schedule: 즉시 확정 / 후보자 옵션 발송 */}
                {interview.status === 'ready_to_schedule' && (
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setRecommendModal({ interview })}
                    >
                      <Zap size={13} />
                      즉시 확정
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setProposeModal(interview)}
                    >
                      <Users size={13} />
                      조율 시작
                    </Button>
                  </div>
                )}

                {/* pending_candidate: 발송된 옵션 목록 + 후보자 확정 */}
                {interview.status === 'pending_candidate' && (
                  <div className="mt-3">
                    {interview.candidateOptions && interview.candidateOptions.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">조율 중인 옵션</p>
                        {interview.candidateOptions.map((opt, i) => (
                          <div key={i} className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                            <span className="font-semibold">옵션 {i + 1}</span>
                            {' · '}
                            {opt.date}
                            {' '}
                            {opt.slots[0].startTime}~{opt.slots[opt.slots.length - 1].endTime}
                            {' · '}
                            {opt.slots.map((s) => s.roomName).join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setRevertTarget(interview)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <RotateCcw size={11} />
                        조율 취소
                      </button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setChoiceModal(interview)}
                      >
                        <CheckCircle2 size={13} />
                        후보자 확정
                      </Button>
                    </div>
                  </div>
                )}

                {/* confirmed: 확정 정보 */}
                {interview.status === 'confirmed' && interview.confirmedSlot && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-blue-700">확정 완료</p>
                        <p className="text-foreground mt-1">
                          {interview.confirmedSlot.date}&nbsp;
                          {interview.confirmedSlot.startTime} ~ {interview.confirmedSlot.endTime}
                        </p>
                        {interview.confirmedSlot.slots?.length > 0 && (
                          <div className="flex flex-col gap-0.5 mt-1">
                            {interview.confirmedSlot.slots.map((slot, si) => (
                              <p key={si} className="text-xs text-muted-foreground">
                                {slot.startTime}~{slot.endTime} · {slot.roomName}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => setNotifyModal(interview)}
                        >
                          후보자 안내
                        </Button>
                        <button
                          onClick={() => setRevertTarget(interview)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <RotateCcw size={11} />
                          확정 취소
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 모달 */}
      <InterviewCreateModal open={createOpen} onOpenChange={setCreateOpen} />
      <SlackTemplateModal open={templateOpen} onOpenChange={setTemplateOpen} />

      {editModal && (
        <InterviewEditModal
          open={!!editModal}
          onOpenChange={(o) => !o && setEditModal(null)}
          interview={editModal}
        />
      )}

      {notifyModal && (
        <CandidateNotifyModal
          open={!!notifyModal}
          onOpenChange={(o) => !o && setNotifyModal(null)}
          interview={notifyModal}
        />
      )}

      {slackModal && (
        <SlackSendModal
          open={!!slackModal}
          onOpenChange={(o) => { if (!o) { setSlackModal(null); setResendDmIds(null) } }}
          interview={slackModal}
          interviewers={interviewers}
          slackChannelId={positionList.find((p) => p.name === slackModal.positionName)?.slackChannelId}
          initialDmIds={resendDmIds ?? undefined}
        />
      )}

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

      {proposeModal && (
        <CandidateOptionsModal
          open={!!proposeModal}
          onOpenChange={(o) => !o && setProposeModal(null)}
          interview={proposeModal}
        />
      )}

      {choiceModal && (
        <CandidateChoiceModal
          open={!!choiceModal}
          onOpenChange={(o) => !o && setChoiceModal(null)}
          interview={choiceModal}
        />
      )}

      {/* 재발송 확인 */}
      <Dialog open={resendConfirm !== null} onOpenChange={(o) => !o && setResendConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>리마인드 메시지 재발송</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">
                {getInterviewer(resendConfirm?.interviewerId ?? '')?.name}
              </span>
              님에게 채널에서 리마인드 메시지를 발송하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setResendConfirm(null)} disabled={isResending}>
              취소
            </Button>
            <Button onClick={handleResend} disabled={isResending}>
              {isResending ? '발송 중...' : '발송'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 확정 취소 확인 */}
      <Dialog open={revertTarget !== null} onOpenChange={(o) => !o && setRevertTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {revertTarget?.status === 'pending_candidate' ? '조율 취소' : '확정 취소'}
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{revertTarget?.candidateName}</span>님의{' '}
              {revertTarget?.status === 'pending_candidate' ? '조율 중인 일정을 취소' : '확정된 일정을 취소'}하시겠습니까?
              회의실 예약도 함께 해제되고 &apos;일정 추천 가능&apos; 상태로 돌아갑니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRevertTarget(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={handleRevert}
              disabled={revertConfirmation.isPending}
            >
              {revertConfirmation.isPending
                ? '처리 중...'
                : revertTarget?.status === 'pending_candidate' ? '조율 취소' : '확정 취소'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>인터뷰 조율 건 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.candidateName}</span>님의
              인터뷰 조율 건을 삭제하시겠습니까?
              {deleteTarget && deleteTarget.status !== 'pending_slack' && (
                <span className="block mt-2 text-xs text-amber-600">
                  슬랙 발송 이후 단계이므로 면접관들에게 취소 안내 DM이 자동 발송됩니다.
                </span>
              )}
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
