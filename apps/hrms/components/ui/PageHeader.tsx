'use client'

import { ArrowLeftIcon } from './Icons'
import { useNavigationHistory } from '@/lib/navigation-history'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  showBack?: boolean
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  showBack = false,
}: PageHeaderProps) {
  const { goBack, canGoBack } = useNavigationHistory()

  const showBackButton = showBack && canGoBack

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={goBack}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-input bg-background hover:bg-muted transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          {icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
              {icon}
            </div>
          )}
          <div>
            {description && (
              <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-0.5">
                {description}
              </p>
            )}
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          </div>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}

// Simpler header variant for list pages
type ListPageHeaderProps = {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function ListPageHeader({
  title,
  description,
  icon,
  action,
}: ListPageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2.5 rounded-xl bg-primary shadow-md">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  )
}
