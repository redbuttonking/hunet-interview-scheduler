// 인증 전 기본 UX 흐름을 검증하는 Playwright 스모크 테스트
import { expect, test } from '@playwright/test'

test('로그인 화면이 표시된다', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByText('휴넷')).toBeVisible()
  await expect(page.getByText('채용 인터뷰 시스템')).toBeVisible()
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await expect(page.getByLabel('이메일')).toBeVisible()
  await expect(page.getByLabel('비밀번호')).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
})

test('인증 없이 대시보드에 접근하면 로그인 화면으로 이동한다', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
})

test('북마크 예약 가져오기 화면이 표시된다', async ({ page }) => {
  await page.goto('/bookmark-import')

  await expect(page.getByRole('heading', { name: '회의실 예약 가져오기' })).toBeVisible()
})
