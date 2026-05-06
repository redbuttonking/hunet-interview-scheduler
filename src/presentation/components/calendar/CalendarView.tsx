'use client'

import { useMemo, useState } from 'react'
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
import { useInterviews, useUpdateConfirmedReservation } from '@/application/usecase/interview/useInterviews'
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
  const { data: interviews = [] } = useInterviews()

  // interviewId → 후보자명 맵 (확정 예약 블록에 후보자명 표시용)
  const interviewMap = useMemo(
    () => Object.fromEntries(interviews.map((iv) => [iv.id, iv.candidateName])),
    [interviews],
  )

  const createRes = useCreateReservation(startDate, endDate)
  const updateRes = useUpdateReservation(startDate, endDate)
  const deleteRes = useDeleteReservation(startDate, endDate)
  const updateConfirmedRes = useUpdateConfirmedReservation()

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

  function isConfirmedInterview(res: RoomReservation) {
    return res.status === 'confirmed' && res.interviewId !== null
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
        if (isConfirmedInterview(editingReservation)) {
          // 확정 인터뷰: 예약 + confirmedSlot 동시 업데이트
          await updateConfirmedRes.mutateAsync({ old: editingReservation, input: data })
        } else {
          await updateRes.mutateAsync({ id: editingReservation.id, input: data })
        }
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
    if (isConfirmedInterview(editingReservation)) {
      toast.error('확정된 인터뷰 예약은 삭제할 수 없습니다. 일정 조율에서 확정을 취소해 주세요.')
      return
    }
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
            interviewMap={interviewMap}
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
            interviewMap={interviewMap}
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
          candidateName={
            editingReservation?.interviewId
              ? interviewMap[editingReservation.interviewId]
              : undefined
          }
          onSave={handleSave}
          onDelete={handleDelete}
          isSaving={createRes.isPending || updateRes.isPending || updateConfirmedRes.isPending}
          isDeleting={deleteRes.isPending}
        />
      </div>
    </div>
  )
}
