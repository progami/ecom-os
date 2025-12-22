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
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
          {badge}
        </span>
      )}
    </button>
  )
}
