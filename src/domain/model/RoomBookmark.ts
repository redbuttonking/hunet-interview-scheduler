/** 다우오피스 북마크에서 전달하는 회의실 예약 동작 */
export type RoomBookmarkAction = 'create' | 'update' | 'cancel'

/** 다우오피스에서 감지한 회의실 예약 정보 */
export interface RoomBookmarkPayload {
  action: RoomBookmarkAction
  externalId: number
  roomName: string
  date?: string
  startTime?: string
  endTime?: string
}
