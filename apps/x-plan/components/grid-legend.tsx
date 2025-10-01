interface GridLegendProps {
  className?: string
}

const LEGEND_ITEMS = [
  {
    id: 'input',
    label: 'Editable input',
    description: 'Type to update the plan',
    swatchClass: 'bg-[#00C2B9]',
  },
  {
    id: 'calculated',
    label: 'Calculated output',
    description: 'Updates from workbook logic',
    swatchClass: 'bg-[#6F7B8B]',
  },
  {
    id: 'active',
    label: 'Linked row',
    description: 'Feeds the detail drawer',
    swatchClass: 'bg-[#00C2B9]',
  },
] as const

export function GridLegend({ className }: GridLegendProps) {
  const baseClass =
    'flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-200/80'

  return (
    <div className={className ? `${baseClass} ${className}` : baseClass} aria-label="Grid legend">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${item.swatchClass}`} />
          <span className="font-medium text-slate-200">{item.label}</span>
          {item.description ? (
            <>
              <span className="sr-only"> — {item.description}</span>
              <span aria-hidden className="hidden text-slate-400 sm:inline">
                · {item.description}
              </span>
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}
