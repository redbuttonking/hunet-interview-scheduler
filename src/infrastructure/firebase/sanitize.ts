// Firestore 저장 전에 undefined 필드를 제거하는 도우미
export function removeUndefinedFields<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}
