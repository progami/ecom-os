import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "bg-brand-teal-500 text-white hover:bg-brand-teal-600",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        md: "h-10 px-4 py-2",
        lg: "h-11 rounded-md px-8",
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
