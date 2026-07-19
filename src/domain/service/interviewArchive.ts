// 확정 인터뷰의 보관 이력을 구성하는 도메인 함수
export interface ArchiveSourceInterview {
  candidateName: string
  positionName: string
  typeLabel: string
  sessions: { rounds: string[] }[]
  interviewerNames: string[]
  bookedByNames: string[]
  confirmedSlot: {
    date: string
    slots: { startTime: string; endTime: string; roomName: string }[]
  } | null
}

export interface InterviewArchiveSummary {
  interviewDate: string
  deleteAfter: string
  candidateName: string
  positionName: string
  typeLabel: string
  sessionCount: number
  scheduledSlots: { startTime: string; endTime: string; roomName: string }[]
  interviewerNames: string[]
  bookedByNames: string[]
}

/** 인터뷰일로부터 7일이 지난 다음 날부터 보관 처리한다. */
export function isInterviewArchiveDue(interviewDate: string, today: string): boolean {
  const retentionEnd = new Date(`${interviewDate}T00:00:00.000Z`)
  retentionEnd.setUTCDate(retentionEnd.getUTCDate() + 8)
  const archiveStartDate = retentionEnd.toISOString().slice(0, 10)
  return today >= archiveStartDate
}

/** 인터뷰일을 기준으로 3개월 뒤의 보관 이력 삭제일을 반환한다. */
export function getInterviewArchiveDeleteDate(interviewDate: string): string {
  const [year, month, day] = interviewDate.split('-').map(Number)
  const targetMonthIndex = month - 1 + 3
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonth = (targetMonthIndex % 12) + 1
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth, 0)).getUTCDate()
  const normalizedDay = Math.min(day, lastDay)
  return `${targetYear}-${String(normalizedMonth).padStart(2, '0')}-${String(normalizedDay).padStart(2, '0')}`
}

/** 후보자명과 운영 이력만 남기고 면접관과 Slack 정보는 제외한다. */
export function createInterviewArchiveSummary(source: ArchiveSourceInterview): InterviewArchiveSummary {
  if (!source.confirmedSlot) throw new Error('확정 일정이 없는 인터뷰는 보관할 수 없습니다.')

  return {
    interviewDate: source.confirmedSlot.date,
    deleteAfter: getInterviewArchiveDeleteDate(source.confirmedSlot.date),
    candidateName: source.candidateName,
    positionName: source.positionName,
    typeLabel: source.typeLabel,
    sessionCount: source.sessions.length,
    scheduledSlots: source.confirmedSlot.slots,
    interviewerNames: [...new Set(source.interviewerNames.filter(Boolean))],
    bookedByNames: [...new Set(source.bookedByNames.filter(Boolean))],
  }
}
