interface GridLegendProps {
  className?: string
}

const LEGEND_ITEMS = [
  {
    id: 'input',
    label: 'Editable input',
    description: 'Type to update the plan',
    swatchClass: 'bg-cyan-600]',
  },
  {
    id: 'calculated',
    label: 'Calculated output',
    description: 'Updates from workbook logic',
    swatchClass: 'bg-slate-500]',
  },
  {
    id: 'active',
    label: 'Linked row',
    description: 'Feeds the detail drawer',
    swatchClass: 'bg-cyan-600]',
  },
] as const

export function GridLegend({ className }: GridLegendProps) {
  const baseClass =
    'flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-700'

  return (
    <div className={className ? `${baseClass} ${className}` : baseClass} aria-label="Grid legend">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${item.swatchClass}`} />
          <span className="font-medium text-slate-800">{item.label}</span>
          {item.description ? (
            <>
              <span className="sr-only"> — {item.description}</span>
              <span aria-hidden className="hidden text-slate-600 sm:inline">
                · {item.description}
              </span>
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}
