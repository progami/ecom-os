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
        <div className="mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-600 text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
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
        <div className="flex flex-col items-center justify-center">
          {icon && (
            <div className="mb-3 text-gray-400">
              {icon}
            </div>
          )}
          <p className={`text-sm text-gray-600 ${description ? 'mb-1' : 'mb-2'}`}>{title}</p>
          {description && (
            <p className="text-sm text-gray-500 text-center max-w-sm mb-2">{description}</p>
          )}
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
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
