// 다우오피스 북마크 예약 데이터 검증 테스트
import { describe, expect, it } from 'vitest'
import { appendRoomBookmarkPayload, parseRoomBookmarkPayload } from './roomBookmarkPayload'

describe('parseRoomBookmarkPayload', () => {
  it('예약 생성 정보를 반환한다', () => {
    expect(parseRoomBookmarkPayload({
      action: 'create',
      externalId: 123,
      roomName: '[818호] 행복룸',
      date: '2026-07-16',
      startTime: '10:00',
      endTime: '11:00',
    })).toEqual({
      action: 'create',
      externalId: 123,
      roomName: '[818호] 행복룸',
      date: '2026-07-16',
      startTime: '10:00',
      endTime: '11:00',
    })
  })

  it('예약 취소는 날짜와 시간 없이 반환한다', () => {
    expect(parseRoomBookmarkPayload({
      action: 'cancel',
      externalId: 124,
      roomName: '행복룸',
    })).toEqual({ action: 'cancel', externalId: 124, roomName: '행복룸' })
  })

  it('예약 취소에 포함된 날짜와 시간을 유지한다', () => {
    expect(parseRoomBookmarkPayload({
      action: 'cancel',
      externalId: 124,
      roomName: '행복룸',
      date: '2026-07-16',
      startTime: '10:00',
      endTime: '11:00',
    })).toEqual({
      action: 'cancel',
      externalId: 124,
      roomName: '행복룸',
      date: '2026-07-16',
      startTime: '10:00',
      endTime: '11:00',
    })
  })

  it('숫자 문자열 예약 ID를 숫자로 정규화한다', () => {
    expect(parseRoomBookmarkPayload({
      action: 'cancel',
      externalId: '125',
      roomName: '행복룸',
    })).toEqual({ action: 'cancel', externalId: 125, roomName: '행복룸' })
  })

  it('종료 시간이 시작 시간보다 빠르면 거부한다', () => {
    expect(parseRoomBookmarkPayload({
      action: 'update',
      externalId: 125,
      roomName: '행복룸',
      date: '2026-07-16',
      startTime: '11:00',
      endTime: '10:00',
    })).toBeNull()
  })

  it('같은 외부 예약의 최신 정보만 대기열에 유지한다', () => {
    const created = { action: 'create' as const, externalId: 126, roomName: '행복룸', date: '2026-07-16', startTime: '10:00', endTime: '11:00' }
    const updated = { ...created, action: 'update' as const, startTime: '11:00', endTime: '12:00' }

    expect(appendRoomBookmarkPayload([created], updated)).toEqual([updated])
  })
})
