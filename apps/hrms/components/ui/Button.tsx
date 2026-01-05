import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 shadow-md shadow-[hsl(var(--primary))]/20",
        primary: "bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 shadow-md shadow-[hsl(var(--primary))]/20",
        destructive: "bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive))]/90 shadow-md shadow-[hsl(var(--destructive))]/20",
        danger: "bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive))]/90 shadow-md shadow-[hsl(var(--destructive))]/20",
        outline: "border border-border bg-card hover:bg-muted text-foreground",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
        link: "text-[hsl(var(--accent))] underline-offset-4 hover:underline",
        accent: "bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90 shadow-md shadow-[hsl(var(--accent))]/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        md: "h-10 px-4 py-2",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  href?: string
  loading?: boolean
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, href, loading, icon, children, disabled, type = "button", ...props }, ref) => {
    const content = (
      <>
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : icon ? (
          icon
        ) : null}
        {children}
      </>
    )

    if (href && !disabled) {
      return (
        <Link href={href} className={cn(buttonVariants({ variant, size, className }))}>
          {content}
        </Link>
      )
    }

    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        type={type}
        {...props}
      >
        {content}
      </Comp>
    )
  }
)
Button.displayName = "Button"

// Icon button for actions like back, edit, delete
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  href?: string
  label: string
  variant?: "default" | "ghost"
  size?: "sm" | "md"
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, href, label, variant = "default", size = "md", className, ...props }, ref) => {
    const sizeClasses = size === "sm" ? "h-9 w-9" : "h-11 w-11"
    const variantClasses =
      variant === "ghost"
        ? "hover:bg-muted text-muted-foreground hover:text-foreground"
        : "border border-input hover:bg-muted text-muted-foreground"

    const baseClasses = cn(
      "flex items-center justify-center rounded-lg transition-colors",
      sizeClasses,
      variantClasses,
      className
    )

    if (href) {
      return (
        <Link href={href} className={baseClasses} aria-label={label}>
          {icon}
        </Link>
      )
    }

    return (
      <button ref={ref} className={baseClasses} aria-label={label} {...props}>
        {icon}
      </button>
    )
  }
)
IconButton.displayName = "IconButton"

export { Button, IconButton, buttonVariants }
