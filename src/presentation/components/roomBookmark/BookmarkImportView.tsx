'use client'

// 다우오피스 북마크에서 전달된 회의실 예약을 확인하고 저장하는 화면
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock3, DoorOpen, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBookmarkRoomImport } from '@/application/usecase/room/useBookmarkRoomImport'
import { useAuthContext } from '@/presentation/components/auth/AuthProvider'
import { RoomBookmarkPayload } from '@/domain/model/RoomBookmark'
import {
  appendRoomBookmarkPayload,
  getRoomBookmarkPayloadKey,
  parseRoomBookmarkPayload,
} from '@/lib/roomBookmarkPayload'

const DAOU_ORIGIN = 'https://hug.hunet.co.kr'
const MESSAGE_SOURCE = 'HUNET_ROOM_BOOKMARK'
const STORAGE_KEY = 'hunet-room-bookmark-payload'

/** 브라우저 저장소에 남은 북마크 예약 대기열을 불러온다 */
function readStoredPayloads(): RoomBookmarkPayload[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    const values = Array.isArray(stored) ? stored : [stored]
    return values
      .map((value) => parseRoomBookmarkPayload(value))
      .filter((value): value is RoomBookmarkPayload => value !== null)
  } catch {
    return []
  }
}

/** 북마크 예약 대기열을 로그인 이후에도 이어지도록 저장한다 */
function savePendingPayloads(payloads: RoomBookmarkPayload[]): void {
  if (payloads.length === 0) sessionStorage.removeItem(STORAGE_KEY)
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payloads))
}

/** 다우오피스 북마크 메시지에서 예약 정보를 추출한다 */
function getIncomingPayload(event: MessageEvent<unknown>): RoomBookmarkPayload | null {
  if (event.origin !== DAOU_ORIGIN || typeof event.data !== 'object' || event.data === null) return null
  const message = event.data as { source?: string; type?: string; payload?: unknown }
  if (message.source !== MESSAGE_SOURCE || message.type !== 'RESERVATION') return null
  return parseRoomBookmarkPayload(message.payload)
}

/** 북마크 동작에 맞는 목록 표시 이름을 반환한다 */
function getActionLabel(action: RoomBookmarkPayload['action']): string {
  return action === 'create' ? '예약 등록' : action === 'update' ? '예약 변경' : '예약 취소'
}

/** 북마크 동작에 맞는 개별 실행 버튼 이름을 반환한다 */
function getActionButtonLabel(action: RoomBookmarkPayload['action']): string {
  return action === 'cancel' ? '예약 삭제' : '예약 반영'
}

/** 북마크 동작별 상태 색상을 반환한다 */
function getActionColor(action: RoomBookmarkPayload['action']): string {
  if (action === 'create') return 'bg-emerald-500/10 text-emerald-700'
  if (action === 'update') return 'bg-blue-500/10 text-blue-700'
  return 'bg-destructive/10 text-destructive'
}

/** 북마크 예약 가져오기 화면을 표시한다 */
export default function BookmarkImportView() {
  const router = useRouter()
  const { user, loading } = useAuthContext()
  const importReservation = useBookmarkRoomImport()
  const [pendingPayloads, setPendingPayloads] = useState<RoomBookmarkPayload[]>(() =>
    typeof window === 'undefined' ? [] : readStoredPayloads(),
  )
  const [completed, setCompleted] = useState(false)
  const [isBatching, setIsBatching] = useState(false)
  const payload = pendingPayloads[0] ?? null

  /** 다우오피스 창에 예약 정보를 받을 준비가 됐음을 알린다 */
  useEffect(() => {
    const notifyReady = () => window.opener?.postMessage({ source: MESSAGE_SOURCE, type: 'READY' }, DAOU_ORIGIN)
    notifyReady()
    const timer = window.setInterval(notifyReady, 600)
    return () => window.clearInterval(timer)
  }, [])

  /** 전달된 예약 정보를 현재 창과 로그인 이후에도 유지한다 */
  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const incoming = getIncomingPayload(event)
      if (!incoming) return
      setCompleted(false)
      setPendingPayloads((current) => {
        const next = appendRoomBookmarkPayload(current, incoming)
        savePendingPayloads(next)
        return next
      })
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  /** 예약 정보를 받은 비로그인 사용자를 로그인 화면으로 이동한다 */
  useEffect(() => {
    if (!loading && !user && payload) router.replace('/login?returnTo=%2Fbookmark-import')
  }, [loading, user, payload, router])

  /** 확인한 북마크 예약을 시스템에 저장한다 */
  async function handleConfirm(payload: RoomBookmarkPayload) {
    try {
      await importReservation.mutateAsync(payload)
      const payloadKey = getRoomBookmarkPayloadKey(payload)
      removeImportedPayloads(new Set([payloadKey]))
      setCompleted(true)
    } catch {
      // API의 구체적인 오류는 mutation.error로 화면에 표시한다.
    }
  }

  /** 대기열의 예약을 순서대로 저장하고 성공한 항목만 제거한다 */
  async function handleConfirmAll() {
    const queued = [...pendingPayloads]
    const completedKeys = new Set<string>()
    setIsBatching(true)
    try {
      for (const item of queued) {
        await importReservation.mutateAsync(item)
        completedKeys.add(getRoomBookmarkPayloadKey(item))
      }
      setCompleted(true)
    } catch {
      // 실패한 예약과 이후 대기 예약은 사용자가 다시 확인할 수 있도록 남긴다.
    } finally {
      removeImportedPayloads(completedKeys)
      setIsBatching(false)
    }
  }

  /** 저장에 성공한 예약을 대기열과 브라우저 저장소에서 제거한다 */
  function removeImportedPayloads(completedKeys: Set<string>) {
    setPendingPayloads((current) => {
      const next = current.filter((item) => !completedKeys.has(getRoomBookmarkPayloadKey(item)))
      savePendingPayloads(next)
      return next
    })
  }

  /** 북마크 팝업 창을 닫는다 */
  function handleClose() {
    window.opener?.postMessage({ source: MESSAGE_SOURCE, type: 'CLOSED' }, DAOU_ORIGIN)
    window.close()
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-muted/30" />
  }

  if (!payload) {
    if (completed) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
            <h1 className="text-lg font-semibold">회의실 예약이 반영되었습니다.</h1>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>닫기</Button>
              <Button nativeButton={false} render={<Link href="/calendar" target="_blank" rel="noopener noreferrer" />}>캘린더 확인</Button>
            </div>
          </div>
        </main>
      )
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-lg font-semibold">회의실 예약 가져오기</h1>
          <p className="mt-2 text-sm text-muted-foreground">다우오피스에서 북마크를 실행한 뒤 회의실을 예약해 주세요.</p>
        </div>
      </main>
    )
  }

  if (!user) return <main className="flex min-h-screen items-center justify-center bg-muted/30" />

  if (user.role === 'viewer') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
          <XCircle className="mb-3 text-destructive" size={24} />
          <h1 className="text-lg font-semibold">등록 권한이 없습니다.</h1>
          <p className="mt-2 text-sm text-muted-foreground">관리자 또는 채용담당자 계정으로 다시 시도해 주세요.</p>
        </div>
      </main>
    )
  }

  const errorMessage = importReservation.error instanceof Error ? importReservation.error.message : null
  const isSaving = importReservation.isPending || isBatching

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold">회의실 예약 반영</h1>
        <p className="mt-2 text-sm text-muted-foreground">다우오피스에서 감지한 예약 {pendingPayloads.length}건을 확인해 주세요.</p>
        <div className="mt-5 max-h-[360px] overflow-y-auto rounded-md border">
          {pendingPayloads.map((item) => {
            const hasSchedule = Boolean(item.date && item.startTime && item.endTime)
            return (
              <article key={getRoomBookmarkPayloadKey(item)} className="border-b p-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${getActionColor(item.action)}`}>
                    {getActionLabel(item.action)}
                  </span>
                  <Button size="sm" onClick={() => handleConfirm(item)} disabled={isSaving}>
                    {isSaving ? '반영 중...' : getActionButtonLabel(item.action)}
                  </Button>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2"><DoorOpen size={16} className="text-muted-foreground" /><dt className="sr-only">회의실</dt><dd>{item.roomName}</dd></div>
                  {hasSchedule && <div className="flex items-center gap-2"><CalendarDays size={16} className="text-muted-foreground" /><dt className="sr-only">날짜</dt><dd>{item.date}</dd></div>}
                  {hasSchedule && <div className="flex items-center gap-2"><Clock3 size={16} className="text-muted-foreground" /><dt className="sr-only">시간</dt><dd>{item.startTime} ~ {item.endTime}</dd></div>}
                </dl>
              </article>
            )
          })}
        </div>
        {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>취소</Button>
          {pendingPayloads.length > 1 && (
            <Button variant="outline" onClick={handleConfirmAll} disabled={isSaving}>
              {isSaving ? '반영 중...' : `${pendingPayloads.length}건 일괄 반영`}
            </Button>
          )}
        </div>
      </section>
    </main>
  )
}
