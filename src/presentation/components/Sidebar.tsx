'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, Users, CalendarClock, Calendar, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',    label: '대시보드',   icon: LayoutDashboard },
  { href: '/positions',    label: '포지션 관리', icon: Briefcase },
  { href: '/interviewers', label: '면접관 관리', icon: Users },
  { href: '/scheduling',   label: '일정 조율',   icon: CalendarClock },
  { href: '/calendar',     label: '캘린더',      icon: Calendar },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* 브랜드 */}
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <p className="text-base font-bold text-sidebar-foreground leading-tight">휴넷</p>
        <p className="text-xs text-muted-foreground mt-0.5">채용 인터뷰 시스템</p>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent',
              )}
            >
              <Icon size={16} className={isActive ? 'opacity-90' : 'opacity-60'} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 하단 유저 + 로그아웃 */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 flex flex-col gap-0.5">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-sidebar-primary-foreground">박</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground leading-tight truncate">박현수</p>
            <p className="text-xs text-muted-foreground leading-tight">채용 담당자</p>
          </div>
        </div>
        <button className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-destructive hover:bg-sidebar-accent transition-colors">
          <LogOut size={15} className="opacity-70" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
