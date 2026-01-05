import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    padding?: "none" | "sm" | "md" | "lg"
    hover?: boolean
    variant?: "default" | "muted" | "accent"
  }
>(({ className, padding = "md", hover = false, variant = "default", ...props }, ref) => {
  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  }

  const variantStyles = {
    default: "bg-card border-border/60",
    muted: "bg-muted/30 border-border/40",
    accent: "bg-gradient-to-br from-[hsl(var(--accent))]/5 to-transparent border-[hsl(var(--accent))]/20",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border text-card-foreground shadow-[var(--shadow)]",
        variantStyles[variant],
        paddingStyles[padding],
        hover && "card-hover cursor-pointer",
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string
    description?: string
    action?: React.ReactNode
  }
>(({ className, title, description, action, children, ...props }, ref) => {
  if (title) {
    return (
      <div
        ref={ref}
        className={cn("flex items-start justify-between mb-5", className)}
        {...props}
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-5", className)}
      {...props}
    >
      {children}
    </div>
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-base font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

function CardDivider() {
  return <div className="border-t border-border/60 my-5" />
}

// Enhanced Stat card for dashboard
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: string
    positive: boolean
  }
  variant?: "default" | "primary" | "accent" | "warning" | "success"
  className?: string
}

function StatCard({ title, value, subtitle, icon, trend, variant = "default", className = "" }: StatCardProps) {
  const variantStyles: Record<string, { bg: string; iconBg: string; iconColor: string; text?: string; muted?: string }> = {
    default: {
      bg: "bg-card",
      iconBg: "bg-muted",
      iconColor: "text-foreground",
    },
    primary: {
      bg: "bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(207,100%,20%)]",
      iconBg: "bg-white/10",
      iconColor: "text-white",
      text: "text-white",
      muted: "text-white/70",
    },
    accent: {
      bg: "bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(176,100%,24%)]",
      iconBg: "bg-white/10",
      iconColor: "text-white",
      text: "text-white",
      muted: "text-white/70",
    },
    warning: {
      bg: "bg-gradient-to-br from-amber-500 to-amber-600",
      iconBg: "bg-white/10",
      iconColor: "text-white",
      text: "text-white",
      muted: "text-white/70",
    },
    success: {
      bg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
      iconBg: "bg-white/10",
      iconColor: "text-white",
      text: "text-white",
      muted: "text-white/70",
    },
  }

  const styles = variantStyles[variant]
  const isColored = variant !== "default"

  return (
    <div
      className={cn(
        "rounded-xl p-5 shadow-[var(--shadow-md)] transition-all duration-200 hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5",
        styles.bg,
        isColored ? "border-0" : "border border-border/60",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-medium uppercase tracking-wider",
            isColored ? styles.muted : "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className={cn(
            "text-2xl font-bold mt-2 tracking-tight",
            isColored ? styles.text : "text-foreground"
          )}>
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              "text-xs mt-1",
              isColored ? styles.muted : "text-muted-foreground"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium mt-2 flex items-center gap-1",
                trend.positive
                  ? isColored ? "text-white" : "text-emerald-600"
                  : isColored ? "text-white" : "text-red-600"
              )}
            >
              <span className={cn(
                "inline-block w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent",
                trend.positive
                  ? "border-b-[5px] border-b-current"
                  : "border-t-[5px] border-t-current"
              )} />
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            "p-2.5 rounded-lg shrink-0",
            styles.iconBg
          )}>
            <div className={styles.iconColor}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardDivider,
  StatCard,
}
