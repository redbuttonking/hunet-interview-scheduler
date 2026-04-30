'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { startOfWeek, addDays, format } from 'date-fns'
import { RoomReservation } from '@/domain/model/Room'
import { CreateReservationInput } from '@/domain/repository/IRoomReservationRepository'
import { useRooms } from '@/application/usecase/room/useRooms'
import {
  useRoomReservations,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from '@/application/usecase/room/useRoomReservations'
import { hasTimeOverlap } from '@/lib/reservationUtils'
import WeekView from './WeekView'
import DayView from './DayView'
import ReservationModal from './ReservationModal'

type ViewMode = 'week' | 'day'

export default function CalendarView() {
  const [mode, setMode] = useState<ViewMode>('week')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<RoomReservation | null>(null)
  const [modalDraft, setModalDraft] = useState<{
    roomId: string
    date: string
    startTime: string
    endTime: string
  } | null>(null)

  const days = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i))
  const startDate = format(days[0], 'yyyy-MM-dd')
  const endDate = format(days[4], 'yyyy-MM-dd')

  const { data: rooms = [] } = useRooms()
  const { data: reservations = [] } = useRoomReservations(startDate, endDate)

  const createRes = useCreateReservation(startDate, endDate)
  const updateRes = useUpdateReservation(startDate, endDate)
  const deleteRes = useDeleteReservation(startDate, endDate)

  function goToDay(date: Date) {
    setSelectedDate(date)
    setWeekStart(startOfWeek(date, { weekStartsOn: 1 }))
    setMode('day')
  }

  function handleDayDateChange(date: Date) {
    setSelectedDate(date)
    setWeekStart(startOfWeek(date, { weekStartsOn: 1 }))
  }

  function openCreateModal(draft: {
    roomId: string
    date: string
    startTime: string
    endTime: string
  }) {
    setEditingReservation(null)
    setModalDraft(draft)
    setModalOpen(true)
  }

  function openEditModal(reservation: RoomReservation) {
    setEditingReservation(reservation)
    setModalDraft(null)
    setModalOpen(true)
  }

  async function handleSave(data: CreateReservationInput) {
    if (
      hasTimeOverlap(
        reservations,
        data.roomId,
        data.date,
        data.startTime,
        data.endTime,
        editingReservation?.id,
      )
    ) {
      toast.error('해당 회의실의 선택한 시간에 이미 예약이 있습니다.')
      return
    }

    try {
      if (editingReservation) {
        await updateRes.mutateAsync({ id: editingReservation.id, input: data })
        toast.success('예약이 수정되었습니다.')
      } else {
        await createRes.mutateAsync(data)
        toast.success('예약이 추가되었습니다.')
      }
      setModalOpen(false)
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  async function handleDelete() {
    if (!editingReservation) return
    try {
      await deleteRes.mutateAsync(editingReservation.id)
      toast.success('예약이 삭제되었습니다.')
      setModalOpen(false)
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    /* 1000px 이하에서 가로 스크롤, 얇은 스크롤바 적용 */
    <div className="calendar-scroll">
      <div className="flex flex-col gap-4 min-w-[1000px]">
        <div>
          <h1 className="text-2xl font-bold text-foreground">캘린더</h1>
          <p className="text-sm text-muted-foreground mt-1">
            회의실 예약 현황을 확인하고 관리합니다.
          </p>
        </div>

        {mode === 'week' ? (
          <WeekView
            days={days}
            rooms={rooms}
            reservations={reservations}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            onDayClick={goToDay}
            onCreateDraft={openCreateModal}
            onEditReservation={openEditModal}
          />
        ) : (
          <DayView
            date={selectedDate}
            rooms={rooms}
            reservations={reservations}
            onDateChange={handleDayDateChange}
            onWeekView={() => setMode('week')}
            onCreateDraft={openCreateModal}
            onEditReservation={openEditModal}
          />
        )}

        <ReservationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          rooms={rooms}
          reservation={editingReservation}
          draft={modalDraft}
          onSave={handleSave}
          onDelete={handleDelete}
          isSaving={createRes.isPending || updateRes.isPending}
          isDeleting={deleteRes.isPending}
        />
      </div>
    </div>
  )
}
