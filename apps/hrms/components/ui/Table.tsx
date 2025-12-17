type TableProps = {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {children}
        </table>
      </div>
    </div>
  )
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50">
        {children}
      </tr>
    </thead>
  )
}

type TableHeadProps = {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function TableHead({ children, className = '', align = 'left' }: TableHeadProps) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align]

  return (
    <th className={`px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider ${alignClass} ${className}`}>
      {children}
    </th>
  )
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return (
    <tbody className="divide-y divide-gray-100">
      {children}
    </tbody>
  )
}

type TableRowProps = {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  hoverable?: boolean
}

export function TableRow({ children, onClick, className = '', hoverable = true }: TableRowProps) {
  const hoverClass = hoverable ? 'hover:bg-gray-50' : ''
  const cursorClass = onClick ? 'cursor-pointer' : ''

  return (
    <tr
      onClick={onClick}
      className={`${hoverClass} ${cursorClass} ${className}`}
    >
      {children}
    </tr>
  )
}

type TableCellProps = {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function TableCell({ children, className = '', align = 'left' }: TableCellProps) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align]

  return (
    <td className={`px-6 py-4 text-sm ${alignClass} ${className}`}>
      {children}
    </td>
  )
}

// Loading skeleton for table rows
type TableSkeletonProps = {
  rows?: number
  columns: number
}

export function TableSkeleton({ rows = 5, columns }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-6 py-4">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// Results count display
type ResultsCountProps = {
  count: number
  singular: string
  plural: string
  loading?: boolean
}

export function ResultsCount({ count, singular, plural, loading = false }: ResultsCountProps) {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading...</p>
  }

  return (
    <p className="text-sm text-gray-600">
      {count} {count === 1 ? singular : plural}
    </p>
  )
}
