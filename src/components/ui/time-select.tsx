'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** 09:00~18:00 사이 30분 단위 슬롯 */
const TIME_SLOTS: string[] = Array.from({ length: 19 }, (_, i) => {
  const totalMins = 9 * 60 + i * 30
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0')
  const m = (totalMins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
})

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

export function TimeSelectField({ value, onChange, className, placeholder = '시간 선택' }: Props) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className={cn('w-full h-9', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {TIME_SLOTS.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
