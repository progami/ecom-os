import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        success: "border-transparent bg-success-100 text-success-800",
        warning: "border-transparent bg-warning-100 text-warning-800",
        error: "border-transparent bg-danger-100 text-danger-800",
        info: "border-transparent bg-brand-navy-100 text-brand-navy-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// Helper to get variant from status string
type BadgeVariant = "success" | "warning" | "error" | "info" | "default"

function getStatusVariant(status: unknown): BadgeVariant {
  if (typeof status !== "string") return "default"

  const s = status.trim().toLowerCase()
  if (!s) return "default"

  if (/(active|published|approved|completed|acknowledged|done)\b/.test(s)) return "success"
  if (/(pending|review|in[_ -]?progress|awaiting|overdue)\b/.test(s)) return "warning"
  if (/(rejected|dismissed|denied|error|failed|cancelled|canceled)\b/.test(s)) return "error"
  if (/(archived|inactive|suspended|closed)\b/.test(s)) return "default"

  return "info"
}

// Convenience component for status badges
interface StatusBadgeProps {
  status: unknown
  className?: string
}

function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const label = typeof status === "string" && status.trim() ? status : "—"

  return (
    <Badge variant={getStatusVariant(status)} className={className}>
      {label}
    </Badge>
  )
}

export { Badge, badgeVariants, getStatusVariant, StatusBadge }
