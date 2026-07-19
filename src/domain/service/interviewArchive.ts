// 확정 인터뷰의 보관 이력을 구성하는 도메인 함수
export interface ArchiveSourceInterview {
  candidateName: string
  positionName: string
  typeLabel: string
  sessions: { rounds: string[] }[]
  confirmedSlot: {
    date: string
    slots: { roomName: string }[]
  } | null
}

export interface InterviewArchiveSummary {
  interviewDate: string
  candidateName: string
  positionName: string
  typeLabel: string
  sessionCount: number
  roomNames: string[]
}

/** 인터뷰일로부터 7일이 지난 다음 날부터 보관 처리한다. */
export function isInterviewArchiveDue(interviewDate: string, today: string): boolean {
  const retentionEnd = new Date(`${interviewDate}T00:00:00.000Z`)
  retentionEnd.setUTCDate(retentionEnd.getUTCDate() + 8)
  const archiveStartDate = retentionEnd.toISOString().slice(0, 10)
  return today >= archiveStartDate
}

/** 후보자명과 운영 이력만 남기고 면접관과 Slack 정보는 제외한다. */
export function createInterviewArchiveSummary(source: ArchiveSourceInterview): InterviewArchiveSummary {
  if (!source.confirmedSlot) throw new Error('확정 일정이 없는 인터뷰는 보관할 수 없습니다.')

  return {
    interviewDate: source.confirmedSlot.date,
    candidateName: source.candidateName,
    positionName: source.positionName,
    typeLabel: source.typeLabel,
    sessionCount: source.sessions.length,
    roomNames: [...new Set(source.confirmedSlot.slots.map((slot) => slot.roomName))],
  }
}
