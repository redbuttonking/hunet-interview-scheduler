'use client'

import { useCallback, useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const handleClose = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex h-full">
      <Sidebar open={sidebarOpen} onClose={handleClose} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 상단 헤더 */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-sidebar border-b border-sidebar-border shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="메뉴 열기"
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-tight">휴넷</p>
            <p className="text-xs text-muted-foreground leading-tight">채용 인터뷰 시스템</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-muted/30 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
