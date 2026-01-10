import { PlusIcon } from './Icons'
import { Button } from './button'

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
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button variant="ghost" href={action.href} icon={<PlusIcon className="h-4 w-4" />}>
          {action.label}
        </Button>
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
        <div className="mb-3 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className={`text-sm text-muted-foreground ${description ? 'mb-1' : 'mb-2'}`}>{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground/80 text-center max-w-sm mb-2">{description}</p>
      )}
      {action && (
        <Button variant="ghost" size="sm" href={action.href} icon={<PlusIcon className="h-4 w-4" />}>
          {action.label}
        </Button>
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
