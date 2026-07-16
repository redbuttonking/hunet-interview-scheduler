import LoginPage from '@/presentation/components/login/LoginPage'

/** 로그인 후 복귀 주소를 로그인 화면에 전달한다 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  return <LoginPage returnTo={returnTo ?? null} />
}
