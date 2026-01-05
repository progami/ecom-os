import { cn } from '@/lib/utils'

type TabButtonProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  badge?: number
}

export function TabButton({
  active,
  onClick,
  children,
  icon: Icon,
  badge,
}: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
        active
          ? 'bg-accent/10 text-accent'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground rounded-full">
          {badge}
        </span>
      )}
    </button>
  )
}
