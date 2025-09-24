interface GridLegendProps {
  className?: string
}

const LEGEND_ITEMS = [
  {
    id: 'input',
    label: 'Editable input',
    description: 'Type to update the plan',
    swatchClass: 'bg-[#00C2B9] dark:bg-teal-400',
  },
  {
    id: 'calculated',
    label: 'Calculated output',
    description: 'Updates from workbook logic',
    swatchClass: 'bg-slate-300 dark:bg-slate-500',
  },
  {
    id: 'active',
    label: 'Linked row',
    description: 'Feeds the detail drawer',
    swatchClass: 'bg-teal-600 dark:bg-teal-400',
  },
] as const

export function GridLegend({ className }: GridLegendProps) {
  const baseClass =
    'flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400'

  return (
    <div className={className ? `${baseClass} ${className}` : baseClass} aria-label="Grid legend">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${item.swatchClass}`} />
          <span className="font-medium text-slate-600 dark:text-slate-200">{item.label}</span>
          {item.description ? (
            <>
              <span className="sr-only"> — {item.description}</span>
              <span aria-hidden className="hidden text-slate-400 dark:text-slate-500 sm:inline">
                · {item.description}
              </span>
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}
