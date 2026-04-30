'use client'

interface HeaderProps {
  userName?: string
}

export default function Header({ userName = '박현수' }: HeaderProps) {
  return (
    <header className="h-13 border-b border-border bg-background flex items-center justify-end px-6 shrink-0">
      <span className="text-sm text-muted-foreground">{userName}</span>
    </header>
  )
}
