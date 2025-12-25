type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-200 text-gray-800',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// Helper to get variant from status string
export function getStatusVariant(status: unknown): BadgeVariant {
  if (typeof status !== 'string') return 'default';

  const s = status.trim().toLowerCase();
  if (!s) return 'default';

  if (/(active|published|approved|completed|acknowledged|done)\b/.test(s)) return 'success';
  if (/(pending|review|in[_ -]?progress|awaiting|overdue)\b/.test(s)) return 'warning';
  if (/(rejected|dismissed|denied|error|failed|cancelled|canceled)\b/.test(s)) return 'error';
  if (/(archived|inactive|suspended|closed)\b/.test(s)) return 'default';

  return 'info';
}

// Convenience component for status badges
type StatusBadgeProps = {
  status: unknown;
  className?: string;
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const label = typeof status === 'string' && status.trim() ? status : '—';

  return (
    <Badge variant={getStatusVariant(status)} className={className}>
      {label}
    </Badge>
  );
}
