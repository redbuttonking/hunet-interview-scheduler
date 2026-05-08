'use client'

// 슬랙 메시지 작성 및 발송 모달

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { startOfWeek, addDays, format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import Holidays from 'date-holidays'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerField } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { Interview } from '@/domain/model/Interview'
import { Interviewer } from '@/domain/model/Interviewer'
import { useSendSlack } from '@/application/usecase/interview/useInterviews'

const hd = new Holidays('KR')

const TEMPLATE_KEY = 'slack-message-template'

const DEFAULT_TEMPLATE = {
  header:
    '안녕하세요!\n{포지션} ({후보자명}) {유형} 인터뷰 일정 조율로 연락 드립니다~\n\n아래 날짜 중 가능하신 시간대 말씀해 주시면 감사 드리겠습니다 ^^',
  footer: '감사합니다.\n휴넷 채용팀',
}

function loadTemplate(): { header: string; footer: string } {
  try {
    const saved = localStorage.getItem(TEMPLATE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_TEMPLATE
}

function fillPlaceholders(template: string, interview: Interview): string {
  return template
    .replace(/\{후보자명\}/g, interview.candidateName)
    .replace(/\{포지션\}/g, interview.positionName)
    .replace(/\{유형\}/g, interview.typeLabel)
}

function getWeekDates(dateStr: string): Date[] {
  const monday = startOfWeek(parseISO(dateStr), { weekStartsOn: 1 })
  return [0, 1, 2, 3].map((i) => addDays(monday, i))
}

function isHoliday(date: Date): boolean {
  return hd.isHoliday(date) !== false
}

function formatDate(date: Date): string {
  return format(date, 'yyyy년 M월 d일 (eee)', { locale: ko }) + ' (오전 / 오후)'
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: Interview
  interviewers: Interviewer[]
}

export default function SlackSendModal({ open, onOpenChange, interview, interviewers }: Props) {
  const sendSlack = useSendSlack()

  const [selectedDate, setSelectedDate] = useState('')
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set())
  const [headerTemplate, setHeaderTemplate] = useState('')
  const [footer, setFooter] = useState('')

  useEffect(() => {
    if (open) {
      const tpl = loadTemplate()
      setHeaderTemplate(tpl.header)
      setFooter(tpl.footer)
      setSelectedDate('')
      setExcludedDates(new Set())
    }
  }, [open])

  const weekDates = useMemo(() => (selectedDate ? getWeekDates(selectedDate) : []), [selectedDate])

  const activeDates = useMemo(
    () =>
      weekDates.filter((d) => {
        const key = format(d, 'yyyy-MM-dd')
        return !isHoliday(d) && !excludedDates.has(key)
      }),
    [weekDates, excludedDates],
  )

  const filledHeader = useMemo(
    () => fillPlaceholders(headerTemplate, interview),
    [headerTemplate, interview],
  )

  const preview = useMemo(() => {
    const dateLines =
      activeDates.length > 0
        ? activeDates.map((d) => `• ${formatDate(d)}`).join('\n')
        : '(날짜를 선택해주세요)'
    return `${filledHeader}\n\n${dateLines}\n\n${footer}`
  }, [filledHeader, footer, activeDates])

  const relevantInterviewers = useMemo(
    () => interviewers.filter((iv) => interview.interviewerIds.includes(iv.id)),
    [interviewers, interview.interviewerIds],
  )

  function toggleDate(dateStr: string) {
    setExcludedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  async function handleSend() {
    if (activeDates.length === 0) {
      toast.error('발송할 날짜를 1개 이상 선택해주세요.')
      return
    }

    const slackIds = relevantInterviewers.map((iv) => iv.slackId).filter(Boolean)

    if (slackIds.length === 0) {
      toast.error('슬랙 ID가 등록된 면접관이 없습니다. 면접관 관리 페이지에서 슬랙 ID를 입력해주세요.')
      return
    }

    localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ header: headerTemplate, footer }))

    try {
      await sendSlack.mutateAsync({ interviewId: interview.id, slackIds, message: preview })
      toast.success(`${slackIds.length}명에게 메시지를 발송했습니다.`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '발송 중 오류가 발생했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>슬랙 메시지 발송</DialogTitle>
          <DialogDescription>
            {interview.candidateName} · {interview.positionName} · {interview.typeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* 발송 대상 */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">발송 대상</Label>
            <div className="flex flex-wrap gap-1.5">
              {relevantInterviewers.map((iv) => (
                <span
                  key={iv.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs"
                >
                  <span className="font-medium">{iv.name}</span>
                  {iv.slackId ? (
                    <span className="text-muted-foreground">{iv.slackId}</span>
                  ) : (
                    <span className="text-destructive font-medium">슬랙ID 없음</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* 날짜 선택 */}
          <div>
            <Label className="text-sm font-medium mb-0.5 block">날짜 선택</Label>
            <p className="text-xs text-muted-foreground mb-2">
              선택한 날짜가 속한 주의 월~목요일을 가져옵니다. 공휴일은 자동으로 제외됩니다.
            </p>
            <DatePickerField
              value={selectedDate}
              onChange={(val) => {
                setSelectedDate(val)
                setExcludedDates(new Set())
              }}
              placeholder="날짜를 선택하면 해당 주 월~목이 표시됩니다"
            />
            {weekDates.length > 0 && (
              <div className="mt-2.5 space-y-2">
                {weekDates.map((d) => {
                  const key = format(d, 'yyyy-MM-dd')
                  const holiday = isHoliday(d)
                  const excluded = excludedDates.has(key)
                  const checked = !holiday && !excluded
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`date-${key}`}
                        checked={checked}
                        disabled={holiday}
                        onCheckedChange={() => !holiday && toggleDate(key)}
                      />
                      <label
                        htmlFor={`date-${key}`}
                        className={cn(
                          'text-sm',
                          !holiday && 'cursor-pointer',
                          (holiday || excluded) && 'text-muted-foreground line-through',
                        )}
                      >
                        {formatDate(d)}
                        {holiday && <span className="ml-2 text-xs text-rose-500">공휴일</span>}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 메시지 편집 */}
          <div>
            <Label className="text-sm font-medium mb-0.5 block">메시지 편집</Label>
            <p className="text-xs text-muted-foreground mb-2">
              <code className="bg-muted px-1 rounded">{'{후보자명}'}</code>,{' '}
              <code className="bg-muted px-1 rounded">{'{포지션}'}</code>,{' '}
              <code className="bg-muted px-1 rounded">{'{유형}'}</code>은 발송 시 자동으로 치환됩니다.
            </p>
            <div className="space-y-2">
              <textarea
                value={headerTemplate}
                onChange={(e) => setHeaderTemplate(e.target.value)}
                rows={4}
                placeholder="상단 텍스트"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="rounded-md bg-muted/50 border border-dashed border-border px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {activeDates.length > 0
                  ? activeDates.map((d) => `• ${formatDate(d)}`).join('\n')
                  : '날짜 목록이 여기에 표시됩니다'}
              </div>
              <textarea
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                rows={2}
                placeholder="하단 텍스트"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* 발송 미리보기 */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">발송 미리보기</Label>
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed font-mono">
              {preview}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSend} disabled={sendSlack.isPending} className="gap-1.5">
            <Send size={13} />
            {sendSlack.isPending ? '발송 중...' : '발송'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
