'use client'

import { StarFilledIcon, StarIcon } from '@/components/ui/Icons'
import { cn } from '@/lib/utils'

const DEFAULT_SCALE_MAX = 10

function ratingScale(max: number) {
  return Array.from({ length: max }, (_, idx) => idx + 1)
}

export function RatingInputRow({
  label,
  description,
  value,
  onChange,
  disabled = false,
  error,
  max = DEFAULT_SCALE_MAX,
}: {
  label: string
  description?: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  error?: string
  max?: number
}) {
  const scale = ratingScale(max)

  return (
    <div className="group relative flex items-center justify-between py-4 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30 -mx-4 px-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
        {error ? <p className="text-xs text-destructive mt-1">{error}</p> : null}
      </div>
      <div className="flex items-center gap-1 ml-4">
        {scale.map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => {
              if (disabled) return
              onChange(star)
            }}
            disabled={disabled}
            className={cn(
              'p-1 rounded-full transition-all duration-150',
              disabled
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:scale-110 hover:bg-warning/10 active:scale-95'
            )}
            aria-label={`Set ${label} to ${star} out of ${max}`}
          >
            {star <= value ? (
              <StarFilledIcon className="h-4 w-4 text-warning" />
            ) : (
              <StarIcon
                className={cn(
                  'h-4 w-4 transition-colors',
                  disabled ? 'text-muted' : 'text-muted-foreground/30 group-hover:text-warning/50'
                )}
              />
            )}
          </button>
        ))}
        <span
          className={cn(
            'ml-3 text-sm font-semibold min-w-[3.5rem] text-right tabular-nums',
            value >= 8 ? 'text-success' : value >= 6 ? 'text-foreground' : 'text-warning'
          )}
        >
          {value}/{max}
        </span>
      </div>
    </div>
  )
}

export function RatingDisplayRow({
  label,
  value,
  max = DEFAULT_SCALE_MAX,
}: {
  label: string
  value: number | null | undefined
  max?: number
}) {
  const scale = ratingScale(max)
  const hasRating = value != null && value > 0

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {hasRating ? (
        <div className="flex items-center gap-1">
          {scale.map((star) => (
            <StarFilledIcon
              key={star}
              className={cn('h-3.5 w-3.5', star <= (value ?? 0) ? 'text-warning' : 'text-muted')}
            />
          ))}
          <span
            className={cn(
              'ml-2 text-sm font-semibold tabular-nums',
              (value ?? 0) >= 8 ? 'text-success' : (value ?? 0) >= 6 ? 'text-foreground' : 'text-warning'
            )}
          >
            {value}/{max}
          </span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground italic">Not rated</span>
      )}
    </div>
  )
}

