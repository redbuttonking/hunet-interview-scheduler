'use client'

// 데이터 초기화 섹션 — 관리자 전용, 컬렉션별 선택 삭제
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useResetData, type ResetCollectionKey } from '@/application/usecase/admin/useDataReset'

const COLLECTIONS: { key: ResetCollectionKey; label: string; description: string }[] = [
  { key: 'interviews',       label: '인터뷰 조율 건',  description: '면접 조율 건 및 확정 일정 데이터' },
  { key: 'interviewers',     label: '면접관',          description: '면접관 명부' },
  { key: 'positions',        label: '포지션',          description: '채용 포지션 목록' },
  { key: 'roomReservations', label: '회의실 예약',      description: '회의실 예약 현황' },
  { key: 'rooms',            label: '회의실',          description: '회의실 목록' },
]

export default function DataResetSection() {
  const [selected, setSelected] = useState<Set<ResetCollectionKey>>(new Set())
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [confirmText, setConfirmText] = useState('')
  const resetData = useResetData()

  function toggleCollection(key: ResetCollectionKey) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(COLLECTIONS.map((c) => c.key)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  function openStep1() {
    if (selected.size === 0) return
    setStep(1)
  }

  function closeAll() {
    setStep(0)
    setConfirmText('')
  }

  async function handleReset() {
    if (confirmText !== '초기화') return
    closeAll()
    const keys = [...selected]
    setSelected(new Set())
    try {
      const result = await resetData.mutateAsync(keys)
      const total = Object.values(result.results).reduce((a, b) => a + b, 0)
      toast.success(`초기화 완료 — 총 ${total}건의 데이터가 삭제되었습니다.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '초기화에 실패했습니다.')
    }
  }

  const selectedLabels = COLLECTIONS.filter((c) => selected.has(c.key)).map((c) => c.label)

  return (
    <section className="bg-card rounded-xl border border-destructive/30 shadow-sm p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
          <Trash2 size={15} className="text-destructive" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">데이터 초기화</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            선택한 데이터를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
      </div>

      {/* 컬렉션 목록 */}
      <div className="flex flex-col gap-2 mb-4">
        {COLLECTIONS.map((col) => (
          <label
            key={col.key}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors select-none',
              selected.has(col.key)
                ? 'bg-destructive/5 border-destructive/40'
                : 'bg-background border-border hover:border-destructive/30',
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(col.key)}
              onChange={() => toggleCollection(col.key)}
              className="w-4 h-4 accent-destructive"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{col.label}</p>
              <p className="text-xs text-muted-foreground">{col.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* 전체 선택/해제 + 초기화 버튼 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            전체 선택
          </button>
          <span className="text-xs text-muted-foreground">·</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            전체 해제
          </button>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={selected.size === 0 || resetData.isPending}
          onClick={openStep1}
          className="gap-1.5"
        >
          <Trash2 size={13} />
          선택 항목 초기화 ({selected.size})
        </Button>
      </div>

      {/* 1단계 확인 다이얼로그 */}
      <Dialog open={step === 1} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} />
              데이터 삭제 경고
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              아래 데이터를 영구적으로 삭제합니다. <strong>복구가 불가능합니다.</strong>
            </div>
            <ul className="flex flex-col gap-1.5">
              {selectedLabels.map((label) => (
                <li key={label} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              정말로 삭제하시겠습니까? 다음 단계에서 최종 확인이 필요합니다.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeAll}>
                취소
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                계속
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2단계 최종 확인 다이얼로그 */}
      <Dialog open={step === 2} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} />
              최종 확인
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-sm text-muted-foreground">
              아래에 <span className="font-bold text-foreground">초기화</span>를 입력하면 선택한 데이터가 즉시 삭제됩니다.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-input">확인 문구 입력</Label>
              <Input
                id="confirm-input"
                placeholder="초기화"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeAll}>
                취소
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== '초기화'}
                onClick={handleReset}
              >
                초기화 실행
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
