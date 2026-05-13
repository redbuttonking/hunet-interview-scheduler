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

const COLLECTION_LIST: { key: ResetCollectionKey; label: string; description: string }[] = [
  { key: 'interviews',       label: '인터뷰 조율 건',  description: '면접 조율 건 및 확정 일정 데이터' },
  { key: 'interviewers',     label: '면접관',          description: '면접관 명부' },
  { key: 'positions',        label: '포지션',          description: '채용 포지션 목록' },
  { key: 'roomReservations', label: '회의실 예약',      description: '회의실 예약 현황' },
  { key: 'rooms',            label: '회의실',          description: '회의실 목록' },
]

const CONFIRM_PHRASE = '선택한 항목을 초기화 합니다'

/** 면접관만 삭제하고 인터뷰 조율 건을 삭제하지 않을 경우 경고 */
function hasDependencyWarning(selected: Set<ResetCollectionKey>): boolean {
  return selected.has('interviewers') && !selected.has('interviews')
}

export default function DataResetSection() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<ResetCollectionKey>>(new Set())
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [confirmText, setConfirmText] = useState('')
  const resetData = useResetData()

  function openModal() {
    setSelected(new Set())
    setStep(1)
    setConfirmText('')
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    setStep(1)
    setConfirmText('')
  }

  function toggleCollection(key: ResetCollectionKey) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleReset() {
    if (confirmText !== CONFIRM_PHRASE) return
    const keys = [...selected]
    closeModal()
    try {
      const result = await resetData.mutateAsync(keys)
      const total = Object.values(result.results).reduce((a, b) => a + b, 0)
      toast.success(`초기화 완료 — 총 ${total}건의 데이터가 삭제되었습니다.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '초기화에 실패했습니다.')
    }
  }

  const selectedItems = COLLECTION_LIST.filter((c) => selected.has(c.key))
  const showDependencyWarning = hasDependencyWarning(selected)

  return (
    <section className="bg-card rounded-xl border border-destructive/30 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={15} className="text-destructive" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">데이터 초기화</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              데이터베이스에 저장된 데이터를 선택하여 영구 삭제합니다.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={openModal}
          disabled={resetData.isPending}
        >
          <Trash2 size={13} />
          데이터 초기화
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">

          {/* Step 1: 항목 선택 */}
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>데이터 초기화</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-1">
                <p className="text-sm text-muted-foreground">
                  삭제할 데이터를 선택하세요. 삭제 후에는 복구할 수 없습니다.
                </p>

                <div className="flex flex-col gap-2">
                  {COLLECTION_LIST.map((col) => (
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

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(COLLECTION_LIST.map((c) => c.key)))}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      전체 선택
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      전체 해제
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={closeModal}>취소</Button>
                    <Button
                      variant="destructive"
                      disabled={selected.size === 0}
                      onClick={() => setStep(2)}
                    >
                      초기화 ({selected.size})
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 2: 1차 경고 */}
          {step === 2 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle size={18} />
                  삭제 경고
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 pt-1">
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  아래 데이터가 <strong>영구 삭제</strong>됩니다. 복구할 수 없습니다.
                </div>

                <ul className="flex flex-col gap-1.5">
                  {selectedItems.map((col) => (
                    <li key={col.key} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                      <span className="font-medium">{col.label}</span>
                      <span className="text-muted-foreground text-xs">— {col.description}</span>
                    </li>
                  ))}
                </ul>

                {/* 면접관만 삭제 시 의존성 경고 */}
                {showDependencyWarning && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <p className="font-semibold mb-1">⚠️ 주의: 데이터 불일치 가능성</p>
                    <p>면접관을 삭제하면 기존 인터뷰 조율 건에 저장된 면접관 정보가 유효하지 않게 됩니다. <strong>인터뷰 조율 건도 함께 삭제</strong>하는 것을 권장합니다.</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(1)}>뒤로</Button>
                  <Button variant="destructive" onClick={() => setStep(3)}>계속</Button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: 최종 텍스트 확인 */}
          {step === 3 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle size={18} />
                  최종 확인
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 pt-1">
                <p className="text-sm text-muted-foreground">
                  아래에{' '}
                  <span className="font-bold text-foreground">{CONFIRM_PHRASE}</span>
                  {' '}를 정확히 입력하면 즉시 삭제됩니다.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-input">확인 문구 입력</Label>
                  <Input
                    id="confirm-input"
                    placeholder={CONFIRM_PHRASE}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(2)}>뒤로</Button>
                  <Button
                    variant="destructive"
                    disabled={confirmText !== CONFIRM_PHRASE}
                    onClick={handleReset}
                  >
                    초기화 실행
                  </Button>
                </div>
              </div>
            </>
          )}

        </DialogContent>
      </Dialog>
    </section>
  )
}
