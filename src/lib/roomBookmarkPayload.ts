// 다우오피스 북마크 예약 데이터의 형식을 검증하는 도우미
import { RoomBookmarkPayload } from '@/domain/model/RoomBookmark'

/** 알 수 없는 값을 객체 형태인지 확인한다 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** YYYY-MM-DD 형식의 날짜인지 확인한다 */
function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** HH:MM 형식의 시간인지 확인한다 */
function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** 숫자 또는 숫자 문자열을 안전한 외부 예약 ID로 변환한다 */
function toExternalId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/** 북마크 예약 데이터가 저장 가능한 형식인지 확인해 반환한다 */
export function parseRoomBookmarkPayload(value: unknown): RoomBookmarkPayload | null {
  if (!isRecord(value)) return null
  const { action, externalId, roomName, date, startTime, endTime } = value
  const normalizedExternalId = toExternalId(externalId)
  if (!['create', 'update', 'cancel'].includes(action as string)) return null
  if (!normalizedExternalId) return null
  if (typeof roomName !== 'string' || !roomName.trim()) return null
  if (action === 'cancel') return { action, externalId: normalizedExternalId, roomName: roomName.trim() } as RoomBookmarkPayload
  if (!isDate(date) || !isTime(startTime) || !isTime(endTime) || startTime >= endTime) return null
  return { action, externalId: normalizedExternalId, roomName: roomName.trim(), date, startTime, endTime } as RoomBookmarkPayload
}

/** 동일한 예약의 최신 동작을 식별할 수 있는 키를 반환한다 */
export function getRoomBookmarkPayloadKey(payload: RoomBookmarkPayload): string {
  return [payload.action, payload.externalId, payload.roomName, payload.date, payload.startTime, payload.endTime].join('|')
}

/** 새 예약을 대기열에 추가하거나 같은 외부 예약의 최신 정보로 교체한다 */
export function appendRoomBookmarkPayload(
  payloads: RoomBookmarkPayload[],
  incoming: RoomBookmarkPayload,
): RoomBookmarkPayload[] {
  const index = payloads.findIndex((payload) => payload.externalId === incoming.externalId)
  if (index < 0) return [...payloads, incoming]
  return payloads.map((payload, currentIndex) => currentIndex === index ? incoming : payload)
}
