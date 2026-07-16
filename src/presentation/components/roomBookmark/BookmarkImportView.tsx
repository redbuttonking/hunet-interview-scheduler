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
import { parseRoomBookmarkPayload } from '@/lib/roomBookmarkPayload'

const DAOU_ORIGIN = 'https://hug.hunet.co.kr'
const MESSAGE_SOURCE = 'HUNET_ROOM_BOOKMARK'
const STORAGE_KEY = 'hunet-room-bookmark-payload'

/** 브라우저 저장소에 남은 북마크 예약 정보를 불러온다 */
function readStoredPayload(): RoomBookmarkPayload | null {
  try {
    return parseRoomBookmarkPayload(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return null
  }
}

/** 다우오피스 북마크 메시지에서 예약 정보를 추출한다 */
function getIncomingPayload(event: MessageEvent<unknown>): RoomBookmarkPayload | null {
  if (event.origin !== DAOU_ORIGIN || typeof event.data !== 'object' || event.data === null) return null
  const message = event.data as { source?: string; type?: string; payload?: unknown }
  if (message.source !== MESSAGE_SOURCE || message.type !== 'RESERVATION') return null
  return parseRoomBookmarkPayload(message.payload)
}

/** 북마크 동작에 맞는 확인 제목을 반환한다 */
function getActionTitle(action: RoomBookmarkPayload['action']): string {
  return action === 'create' ? '회의실 예약 등록' : action === 'update' ? '회의실 예약 변경' : '회의실 예약 취소'
}

/** 북마크 예약 가져오기 화면을 표시한다 */
export default function BookmarkImportView() {
  const router = useRouter()
  const { user, loading } = useAuthContext()
  const importReservation = useBookmarkRoomImport()
  const [payload, setPayload] = useState<RoomBookmarkPayload | null>(() =>
    typeof window === 'undefined' ? null : readStoredPayload(),
  )
  const [completed, setCompleted] = useState(false)

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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(incoming))
      setCompleted(false)
      setPayload(incoming)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  /** 예약 정보를 받은 비로그인 사용자를 로그인 화면으로 이동한다 */
  useEffect(() => {
    if (!loading && !user && payload) router.replace('/login?returnTo=%2Fbookmark-import')
  }, [loading, user, payload, router])

  /** 확인한 북마크 예약을 시스템에 저장한다 */
  async function handleConfirm() {
    if (!payload) return
    try {
      await importReservation.mutateAsync(payload)
      sessionStorage.removeItem(STORAGE_KEY)
      setCompleted(true)
    } catch {
      // API의 구체적인 오류는 mutation.error로 화면에 표시한다.
    }
  }

  /** 북마크 팝업 창을 닫는다 */
  function handleClose() {
    window.close()
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-muted/30" />
  }

  if (!payload) {
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

  if (completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-lg font-semibold">회의실 예약이 반영되었습니다.</h1>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>닫기</Button>
            <Button render={<Link href="/calendar" />}>캘린더 확인</Button>
          </div>
        </div>
      </main>
    )
  }

  const isCancel = payload.action === 'cancel'
  const errorMessage = importReservation.error instanceof Error ? importReservation.error.message : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{getActionTitle(payload.action)}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isCancel ? '우리 시스템에서도 이 회의실 예약을 삭제할까요?' : '우리 시스템에 이 회의실 예약을 반영할까요?'}
        </p>
        <dl className="mt-5 space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-2"><DoorOpen size={16} className="text-muted-foreground" /><dt className="sr-only">회의실</dt><dd>{payload.roomName}</dd></div>
          {!isCancel && <div className="flex items-center gap-2"><CalendarDays size={16} className="text-muted-foreground" /><dt className="sr-only">날짜</dt><dd>{payload.date}</dd></div>}
          {!isCancel && <div className="flex items-center gap-2"><Clock3 size={16} className="text-muted-foreground" /><dt className="sr-only">시간</dt><dd>{payload.startTime} ~ {payload.endTime}</dd></div>}
        </dl>
        {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={importReservation.isPending}>취소</Button>
          <Button onClick={handleConfirm} disabled={importReservation.isPending}>
            {importReservation.isPending ? '반영 중...' : isCancel ? '예약 삭제' : '예약 반영'}
          </Button>
        </div>
      </section>
    </main>
  )
}
