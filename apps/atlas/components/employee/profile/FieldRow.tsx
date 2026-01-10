'use client'

export function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

