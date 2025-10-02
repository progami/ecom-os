import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  metadata?: React.ReactNode
}

interface PageContentProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-[#041324]', className)}>
      {children}
    </div>
  )
}

export function PageHeaderSection({ title, description, icon: Icon, actions, metadata }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-soft backdrop-blur-xl dark:border-[#0b3a52] dark:bg-[#041324]/95 dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)] sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 shadow-md dark:bg-[#00c2b9] dark:shadow-[0_12px_24px_rgba(0,194,185,0.25)]">
                <Icon className="h-5 w-5 text-white dark:text-[#002430]" />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {description && (
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70 dark:text-cyan-300/60">
                  {description}
                </span>
              )}
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
        </div>
        {metadata && <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{metadata}</div>}
      </div>
    </header>
  )
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn('flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  )
}
