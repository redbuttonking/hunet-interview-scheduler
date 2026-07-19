'use client'

// 개인정보가 제거된 확정 인터뷰 보관 이력을 표시하는 관리자 전용 섹션
import { Archive, CalendarDays, Clock3, MapPin, UserRound, Users } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useInterviewArchives } from '@/application/usecase/admin/useInterviewArchives'

export default function InterviewArchiveSection() {
  const { data: archives = [], isLoading, error } = useInterviewArchives()

  return (
    <div className="max-w-5xl mx-auto">
      <section className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Archive size={15} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">인터뷰 보관 이력</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              인터뷰일로부터 7일이 지난 확정 건입니다. 인터뷰일 기준 3개월 뒤 완전히 삭제됩니다.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : error ? (
          <p className="text-sm text-destructive">보관 이력을 불러오지 못했습니다.</p>
        ) : archives.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">보관된 인터뷰가 없습니다.</p>
          </div>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {archives.map((archive) => (
              <li key={archive.id} className="px-4 py-3.5 bg-background">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold text-foreground">{archive.positionName}</p>
                  <span className="text-sm text-muted-foreground">·</span>
                  <p className="text-sm text-muted-foreground">{archive.typeLabel}</p>
                  <span className="text-xs text-muted-foreground">{archive.sessionCount}개 세션</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>후보자 {archive.candidateName}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{archive.interviewDate}</span>
                  <span className="inline-flex items-center gap-1"><Users size={13} />면접관 {archive.interviewerNames.join(', ') || '정보 없음'}</span>
                  <span className="inline-flex items-center gap-1"><UserRound size={13} />예약자 {archive.bookedByNames.join(', ') || '정보 없음'}</span>
                  {archive.archivedAt && (
                    <span>보관 {format(new Date(archive.archivedAt), 'yyyy.MM.dd', { locale: ko })}</span>
                  )}
                  <span>삭제 예정 {archive.deleteAfter}</span>
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {archive.scheduledSlots.map((slot, index) => (
                    <li key={`${slot.startTime}-${slot.endTime}-${slot.roomName}-${index}`} className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock3 size={13} />{slot.startTime} ~ {slot.endTime}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={13} />{slot.roomName}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
