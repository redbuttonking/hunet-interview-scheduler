// 북마크에서 전달한 회의실 예약을 인증된 API로 저장하는 유스케이스 훅
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getIdToken } from 'firebase/auth'
import { RoomBookmarkPayload } from '@/domain/model/RoomBookmark'
import { auth } from '@/infrastructure/firebase/config'

/** 현재 로그인 사용자의 서버 요청용 인증 토큰을 반환한다 */
async function getBearerToken(): Promise<string> {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.')
  return getIdToken(auth.currentUser)
}

/** 북마크 예약을 서버에서 검증하고 저장한다 */
async function importBookmarkReservation(payload: RoomBookmarkPayload): Promise<void> {
  const token = await getBearerToken()
  const res = await fetch('/api/rooms/bookmark-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (res.ok) return
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(data.error ?? '회의실 예약 등록에 실패했습니다.')
}

/** 북마크 회의실 예약 저장 상태를 관리한다 */
export function useBookmarkRoomImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importBookmarkReservation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  })
}
