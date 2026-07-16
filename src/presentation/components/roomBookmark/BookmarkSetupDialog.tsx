'use client'

// 다우오피스 예약 감지 북마크를 생성하는 설정 대화상자
import { useState } from 'react'
import { Bookmark, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createRoomBookmarkletHref } from '@/lib/roomBookmarklet'

/** 다우오피스 예약 동기화 북마크 설정 대화상자를 표시한다 */
export default function BookmarkSetupDialog() {
  const [open, setOpen] = useState(false)
  const [bookmarkletHref] = useState(() =>
    typeof window === 'undefined' ? '' : createRoomBookmarkletHref(window.location.origin),
  )

  /** 북마크 코드를 클립보드에 복사한다 */
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookmarkletHref)
      toast.success('북마크 코드가 복사되었습니다.')
    } catch {
      toast.error('복사하지 못했습니다.')
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bookmark size={15} />
        북마크 설정
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>다우오피스 회의실 동기화</DialogTitle>
            <DialogDescription>아래 링크를 즐겨찾기 막대로 끌어 놓으세요.</DialogDescription>
          </DialogHeader>
          <a
            href={bookmarkletHref || undefined}
            draggable
            onClick={(event) => event.preventDefault()}
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <Bookmark size={16} />
            회의실 예약 동기화
          </a>
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span>다우오피스에서 예약 전에 북마크를 클릭합니다.</span>
            <Button variant="ghost" size="icon-sm" onClick={handleCopy} disabled={!bookmarkletHref} title="북마크 코드 복사">
              <Copy size={15} />
              <span className="sr-only">북마크 코드 복사</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
