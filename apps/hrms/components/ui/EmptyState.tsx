import Link from 'next/link'
import { PlusIcon } from './Icons'

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    href: string
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <div className="text-muted-foreground">{icon}</div>
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 text-[hsl(var(--accent))] hover:text-[hsl(var(--accent))]/80 text-sm font-medium transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Table empty state content (for use inside DataTable)
type TableEmptyContentProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    href: string
  }
}

export function TableEmptyContent({ icon, title, description, action }: TableEmptyContentProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {icon && (
        <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <div className="text-muted-foreground">{icon}</div>
        </div>
      )}
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-3">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 text-[hsl(var(--accent))] hover:text-[hsl(var(--accent))]/80 text-sm font-medium transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Table empty state (for use inside manual table body - includes tr/td wrapper)
type TableEmptyStateProps = {
  colSpan: number
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    href: string
  }
}

export function TableEmptyState({ colSpan, icon, title, description, action }: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16">
        <TableEmptyContent icon={icon} title={title} description={description} action={action} />
      </td>
    </tr>
  )
}
