type CardProps = {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingStyles = {
  none: '',
  sm: 'p-5',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  className = '',
  padding = 'md',
  hover = false,
}: CardProps) {
  const hoverClass = hover ? 'hover:shadow-md hover:border-gray-300 transition-all duration-200' : ''

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${paddingStyles[padding]} ${hoverClass} ${className}`}>
      {children}
    </div>
  )
}

// Section divider within cards
export function CardDivider() {
  return <div className="border-t border-gray-200 my-6" />
}

// Card header with title and optional description
type CardHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// Stat card for dashboard
type StatCardProps = {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: string
    positive: boolean
  }
  className?: string
}

export function StatCard({ title, value, icon, trend, className = '' }: StatCardProps) {
  return (
    <Card padding="md" hover className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-2 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '+' : ''}{trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-lg bg-blue-50">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
