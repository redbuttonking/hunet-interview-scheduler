'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Room } from '@/domain/model/Room'
import { useCreateRoom, useDeleteRoom, useUpdateRoomOrders } from '@/application/usecase/room/useRooms'

const ITEM_HEIGHT = 48 // 아이템 높이 + gap (px)

interface DragInfo {
  index: number       // 현재 드래그 중인 아이템 인덱스
  startY: number      // 드래그 시작 마우스 Y
  currentY: number    // 현재 마우스 Y
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rooms: Room[]
}

export default function RoomManageModal({ open, onOpenChange, rooms }: Props) {
  const [localRooms, setLocalRooms] = useState<Room[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [newName, setNewName] = useState('')
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null)

  const createRoom = useCreateRoom()
  const deleteRoom = useDeleteRoom()
  const updateOrders = useUpdateRoomOrders()

  useEffect(() => {
    if (open) {
      setLocalRooms([...rooms])
      setIsDirty(false)
      setNewName('')
      setDragInfo(null)
    }
  }, [open, rooms])

  // 드래그 중 아이템별 translateY 계산
  function getItemStyle(index: number): React.CSSProperties {
    if (!dragInfo) return { position: 'relative' }

    const from = dragInfo.index
    const rawOffset = dragInfo.currentY - dragInfo.startY
    const to = Math.max(0, Math.min(Math.round(from + rawOffset / ITEM_HEIGHT), localRooms.length - 1))

    if (index === from) {
      // 드래그 중인 아이템은 커서를 따라감 (transition 없이 즉각 반응)
      return {
        position: 'relative',
        transform: `translateY(${rawOffset}px)`,
        transition: 'none',
        zIndex: 20,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }
    }

    // 나머지 아이템은 자리를 양보하기 위해 부드럽게 이동
    let shift = 0
    if (from < to && index > from && index <= to) shift = -ITEM_HEIGHT
    if (from > to && index >= to && index < from) shift = ITEM_HEIGHT

    return {
      position: 'relative',
      transform: `translateY(${shift}px)`,
      transition: 'transform 180ms cubic-bezier(0.2, 0, 0, 1)',
      zIndex: 0,
    }
  }

  const handleGripMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault()
    setDragInfo({ index, startY: e.clientY, currentY: e.clientY })
  }, [])

  useEffect(() => {
    if (!dragInfo) return

    function onMouseMove(e: MouseEvent) {
      setDragInfo((prev) => prev ? { ...prev, currentY: e.clientY } : null)
    }

    function onMouseUp() {
      setDragInfo((prev) => {
        if (!prev) return null
        const offset = prev.currentY - prev.startY
        const newIndex = Math.max(
          0,
          Math.min(Math.round(prev.index + offset / ITEM_HEIGHT), localRooms.length - 1),
        )
        if (newIndex !== prev.index) {
          setLocalRooms((rooms) => {
            const next = [...rooms]
            const [item] = next.splice(prev.index, 1)
            next.splice(newIndex, 0, item)
            return next
          })
          setIsDirty(true)
        }
        return null
      })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragInfo, localRooms.length])

  async function handleConfirm() {
    const updates = localRooms.map((r, i) => ({ id: r.id, order: i }))
    try {
      await updateOrders.mutateAsync(updates)
      toast.success('회의실 순서가 저장되었습니다.')
      setIsDirty(false)
      onOpenChange(false)
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (localRooms.some((r) => r.name === name)) {
      toast.error('이미 존재하는 회의실 이름입니다.')
      return
    }
    try {
      await createRoom.mutateAsync(name)
      toast.success(`${name} 회의실이 추가되었습니다.`)
      setNewName('')
    } catch {
      toast.error('추가 중 오류가 발생했습니다.')
    }
  }

  async function handleDelete(room: Room) {
    try {
      await deleteRoom.mutateAsync(room.id)
      toast.success(`${room.name} 회의실이 삭제되었습니다.`)
      setLocalRooms((prev) => prev.filter((r) => r.id !== room.id))
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  const isDragging = dragInfo !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { setNewName(''); setIsDirty(false); setDragInfo(null) }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>회의실 관리</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <p className="text-xs text-muted-foreground -mb-2">
            왼쪽 핸들을 잡아 드래그하면 순서를 변경할 수 있습니다.
          </p>

          {/* 드래그 목록 */}
          <div
            className="flex flex-col gap-1"
            style={{ userSelect: 'none' }}
          >
            {localRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                등록된 회의실이 없습니다.
              </p>
            ) : (
              localRooms.map((room, index) => {
                const isBeingDragged = dragInfo?.index === index
                return (
                  <div
                    key={room.id}
                    style={getItemStyle(index)}
                    className={cn(
                      'flex items-center gap-2 px-2 rounded-lg border bg-card',
                      isBeingDragged
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:bg-muted/20',
                    )}
                  >
                    {/* 드래그 핸들 */}
                    <div
                      onMouseDown={(e) => handleGripMouseDown(e, index)}
                      className={cn(
                        'py-2.5 pr-1 cursor-grab active:cursor-grabbing',
                        isDragging && !isBeingDragged && 'cursor-default',
                      )}
                    >
                      <GripVertical size={15} className="text-muted-foreground/40" />
                    </div>

                    <span className="text-sm font-medium flex-1 py-2.5">{room.name}</span>

                    <button
                      type="button"
                      onClick={() => !isDragging && handleDelete(room)}
                      disabled={deleteRoom.isPending || isDragging}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* 새 회의실 추가 */}
          <form onSubmit={handleAdd} className="flex gap-2 border-t border-border pt-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 회의실 이름"
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newName.trim() || createRoom.isPending}
              className="gap-1.5 shrink-0"
            >
              <Plus size={14} />
              추가
            </Button>
          </form>

          {/* 하단 버튼 */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => { setIsDirty(false); setDragInfo(null); onOpenChange(false) }}
              disabled={updateOrders.isPending}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isDirty || updateOrders.isPending}
            >
              {updateOrders.isPending ? '저장 중...' : '확인'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
