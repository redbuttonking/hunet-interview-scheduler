import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/presentation/components/Sidebar'
import Providers from '@/presentation/components/Providers'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '휴넷 채용 면접 시스템',
  description: '면접 일정 조율 자동화 시스템',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full flex flex-col">
        <Providers>
          <div className="flex h-full">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <main className="flex-1 overflow-auto bg-muted/30 p-6">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
