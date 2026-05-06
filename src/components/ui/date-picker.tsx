'use client'

import { useState, useMemo } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isWeekend,
  parseISO,
  isAfter,
  isBefore,
  startOfDay,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  className?: string
  required?: boolean
  placeholder?: string
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function DatePickerField({ value, onChange, min, max, className, placeholder = '날짜 선택' }: Props) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) return parseISO(value)
    if (min) return parseISO(min)
    return new Date()
  })

  const selected = value ? parseISO(value) : null

  const { allDays, startPad } = useMemo(() => {
    const start = startOfMonth(viewDate)
    return {
      allDays: eachDayOfInterval({ start, end: endOfMonth(viewDate) }),
      startPad: getDay(start),
    }
  }, [viewDate])

  function isDisabled(day: Date): boolean {
    if (isWeekend(day)) return true
    if (min && isBefore(startOfDay(day), startOfDay(parseISO(min)))) return true
    if (max && isAfter(startOfDay(day), startOfDay(parseISO(max)))) return true
    return false
  }

  function handleSelect(day: Date) {
    if (isDisabled(day)) return
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-expanded:ring-1 aria-expanded:ring-ring',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <CalendarIcon size={14} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">
          {value ? format(parseISO(value), 'yyyy년 M월 d일 (eee)', { locale: ko }) : placeholder}
        </span>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setViewDate((d) => subMonths(d, 1))}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-medium">
            {format(viewDate, 'yyyy년 M월')}
          </span>
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={cn(
                'text-center text-xs py-1 font-medium',
                i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-muted-foreground',
              )}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
          {allDays.map((day) => {
            const disabled = isDisabled(day)
            const isSelected = !!selected && isSameDay(day, selected)
            const dow = getDay(day)
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(day)}
                className={cn(
                  'h-8 w-full rounded-md text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : disabled
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : dow === 0
                    ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                    : dow === 6
                    ? 'text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/20'
                    : 'hover:bg-muted',
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          토·일요일은 선택할 수 없습니다
        </p>
      </PopoverContent>
    </Popover>
  )
}
