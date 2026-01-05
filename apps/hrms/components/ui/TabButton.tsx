import { cn } from '@/lib/utils'

type TabButtonProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
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
        'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200',
        active
          ? 'bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary))]/20'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', active && 'text-white/90')} />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className={cn(
          'px-1.5 py-0.5 text-xs font-semibold rounded-full',
          active
            ? 'bg-white/20 text-white'
            : 'bg-[hsl(var(--warning))] text-white'
        )}>
          {badge}
        </span>
      )}
    </button>
  )
}
