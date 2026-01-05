import { cn } from '@/lib/utils'

type Role = 'SUPER_ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE'

const roleStyles: Record<Role, string> = {
  SUPER_ADMIN: 'bg-accent/10 text-accent border-accent/20',
  HR: 'bg-amber-100 text-amber-800 border-amber-200',
  MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
  EMPLOYEE: 'bg-muted text-muted-foreground border-border',
}

const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR: 'HR',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
}

type RoleBadgeProps = {
  role: Role | string
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const normalizedRole = role.toUpperCase().replace(/ /g, '_') as Role
  const styles = roleStyles[normalizedRole] ?? roleStyles.EMPLOYEE
  const label = roleLabels[normalizedRole] ?? role

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        styles,
        className
      )}
    >
      {label}
    </span>
  )
}
