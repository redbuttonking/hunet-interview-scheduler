'use client'

// 이메일+비밀번호 로그인 페이지 UI
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuthContext } from '@/presentation/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** 로그인 후 이동할 내부 경로를 반환한다 */
function getReturnPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

export default function LoginPage({ returnTo }: { returnTo: string | null }) {
  const { user, loading, signIn } = useAuthContext()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace(getReturnPath(returnTo))
  }, [user, loading, router, returnTo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await signIn(email, password)
    } catch {
      toast.error('이메일 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setPending(false)
    }
  }

  if (loading || user) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xl font-bold text-foreground">휴넷</p>
          <p className="text-sm text-muted-foreground mt-1">채용 인터뷰 시스템</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
          <h1 className="text-base font-semibold mb-6">로그인</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 mt-2" disabled={pending}>
              {pending ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
