// 확정 인터뷰의 개인정보 없는 보관 이력을 구성하는 도메인 함수
export interface ArchiveSourceInterview {
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

/** 후보자, 면접관, Slack 정보를 제외한 운영 이력만 남긴다. */
export function createInterviewArchiveSummary(source: ArchiveSourceInterview): InterviewArchiveSummary {
  if (!source.confirmedSlot) throw new Error('확정 일정이 없는 인터뷰는 보관할 수 없습니다.')

  return {
    interviewDate: source.confirmedSlot.date,
    positionName: source.positionName,
    typeLabel: source.typeLabel,
    sessionCount: source.sessions.length,
    roomNames: [...new Set(source.confirmedSlot.slots.map((slot) => slot.roomName))],
  }
}
