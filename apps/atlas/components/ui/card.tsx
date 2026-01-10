import * as React from "react"

import { cn } from "@/lib/utils"

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: "none" | "sm" | "md" | "lg"
  hover?: boolean
}

const Card = React.forwardRef<
  HTMLDivElement,
  CardProps
>(({ className, padding = "md", hover = false, ...props }, ref) => {
  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        paddingStyles[padding],
        hover && "hover:shadow-md hover:border-border/80 transition-all duration-200",
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

function CardDivider() {
  return <div className="border-t border-border my-6" />
}

export { Card, CardDivider }
