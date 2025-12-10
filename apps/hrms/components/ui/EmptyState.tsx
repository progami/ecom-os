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
        <div className="mb-4 text-slate-300">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 text-cyan-600 hover:text-cyan-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Table empty state (for use inside table body)
type TableEmptyStateProps = {
  colSpan: number
  icon?: React.ReactNode
  title: string
  action?: {
    label: string
    href: string
  }
}

export function TableEmptyState({ colSpan, icon, title, action }: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16">
        <div className="flex flex-col items-center justify-center">
          {icon && (
            <div className="mb-3 text-slate-300">
              {icon}
            </div>
          )}
          <p className="text-sm text-slate-500 mb-2">{title}</p>
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1.5 text-cyan-600 hover:text-cyan-700 text-sm font-medium"
            >
              <PlusIcon className="h-4 w-4" />
              {action.label}
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}
