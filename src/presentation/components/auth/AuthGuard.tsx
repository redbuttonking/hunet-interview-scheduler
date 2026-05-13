'use client'

// 미인증 접근 차단 및 관리자 전용 페이지 보호
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthContext } from './AuthProvider'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    const isAdminOnly = pathname.startsWith('/admin') || pathname.startsWith('/settings')
    if (user.role !== 'admin' && isAdminOnly) {
      router.replace('/dashboard')
    }
  }, [user, loading, router, pathname])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const isAdminOnly = pathname.startsWith('/admin') || pathname.startsWith('/settings')
  if (!user) return null
  if (user.role !== 'admin' && isAdminOnly) return null

  return <>{children}</>
}
