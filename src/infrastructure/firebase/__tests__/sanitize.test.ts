// Firestore 저장 데이터 정리 규칙을 검증하는 테스트
import { describe, expect, it } from 'vitest'
import { removeUndefinedFields } from '../sanitize'

describe('removeUndefinedFields', () => {
  it('undefined 값인 필드만 제거한다.', () => {
    expect(removeUndefinedFields({
      name: '홍길동',
      slackId: '',
      email: undefined,
      memo: null,
    })).toEqual({
      name: '홍길동',
      slackId: '',
      memo: null,
    })
  })
})
