// 인터뷰 확정 Slack 안내 메시지를 생성하는 유틸리티
import type { Interview } from '@/domain/model/Interview'

export const CONFIRM_FOOTER = '일정 조정이 필요하시다면 담당자에게 문의 주시기 바랍니다.'

function formatDateKo(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}(${days[date.getDay()]})`
}

function formatSessionLabel(interview: Interview, slotIdx: number): string {
  const rounds = interview.sessions[slotIdx]?.rounds ?? []
  return rounds.length > 0 ? `${rounds.join('+')} 인터뷰` : `${slotIdx + 1}번째 인터뷰`
}

export function formatScheduleLines(interview: Interview, onlyInterviewerId?: string): string[] {
  const slot = interview.confirmedSlot
  if (!slot) return []

  return slot.slots
    .map((s, idx) => ({
      line: `- ${formatDateKo(slot.date)} ${s.startTime} ~ ${s.endTime} · ${s.roomName} · ${formatSessionLabel(interview, idx)}`,
      interviewerIds: interview.sessions[idx]?.rounds.flatMap((round) => interview.interviewersByRound[round] ?? []) ?? [],
    }))
    .filter((item) => !onlyInterviewerId || item.interviewerIds.includes(onlyInterviewerId))
    .map((item) => item.line)
}

export function buildChannelConfirmMessage(interview: Interview): string {
  return `[인터뷰 확정 안내]
${interview.candidateName}님(${interview.positionName}) ${interview.typeLabel} 일정이 확정되었습니다.

일정:
${formatScheduleLines(interview).join('\n')}

${CONFIRM_FOOTER}`
}

export function buildDmConfirmMessage(interview: Interview, interviewerId: string): string {
  const myLines = formatScheduleLines(interview, interviewerId)
  const mySchedule = myLines.length > 0 ? myLines.join('\n') : '- 배정된 세션을 확인하지 못했습니다.'

  return `[인터뷰 확정 안내]
${interview.candidateName}님(${interview.positionName}) ${interview.typeLabel} 일정이 확정되었습니다.

내 담당 일정:
${mySchedule}

전체 일정:
${formatScheduleLines(interview).join('\n')}

${CONFIRM_FOOTER}`
}
