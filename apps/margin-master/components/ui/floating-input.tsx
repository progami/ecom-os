"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon?: LucideIcon
  error?: string
  helperText?: string
  currency?: boolean
  formatValue?: (value: string) => string
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ 
    className, 
    label, 
    icon: Icon, 
    error, 
    helperText, 
    id, 
    value, 
    onChange,
    onFocus,
    onBlur,
    currency = false,
    formatValue,
    type = "text",
    required,
    ...props 
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(false)
    const generatedId = React.useId()
    const inputId = id || generatedId
    
    React.useEffect(() => {
      setHasValue(!!value && value !== "")
    }, [value])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      
      // Handle currency formatting
      if (currency && type === "number") {
        const numericValue = inputValue.replace(/[^0-9.]/g, "")
        const parts = numericValue.split(".")
        if (parts.length > 2) {
          e.target.value = parts[0] + "." + parts.slice(1).join("")
        } else if (parts[1] && parts[1].length > 2) {
          e.target.value = parts[0] + "." + parts[1].slice(0, 2)
        } else {
          e.target.value = numericValue
        }
      }
      
      onChange?.(e)
    }

    const isFloating = isFocused || hasValue

    return (
      <div className="relative">
        <div className="relative">
          {Icon && (
            <div 
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-200",
                isFloating ? "opacity-70" : "opacity-50",
                error && "text-destructive"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          {currency && (
            <div 
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium transition-all duration-200",
                Icon && "left-9",
                isFloating ? "opacity-70" : "opacity-50",
                error && "text-destructive"
              )}
            >
              $
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              "peer flex h-12 w-full rounded-md border bg-background text-sm transition-all duration-200",
              "placeholder-transparent",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              "disabled:cursor-not-allowed disabled:opacity-50",
              // Padding adjustments
              Icon && !currency && "pl-10 pr-3",
              !Icon && currency && "pl-8 pr-3",
              Icon && currency && "pl-14 pr-3",
              !Icon && !currency && "px-3",
              // Border and ring colors
              error 
                ? "border-destructive focus:border-destructive focus:ring-destructive/20" 
                : "border-input hover:border-primary/50 focus:border-primary focus:ring-primary/20",
              // Padding top for floating label
              "pt-6 pb-2",
              className
            )}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={label}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          <label
            htmlFor={inputId}
            className={cn(
              "absolute left-3 transition-all duration-200 pointer-events-none",
              "text-muted-foreground",
              // Position adjustments
              Icon && !currency && "left-10",
              !Icon && currency && "left-8",
              Icon && currency && "left-14",
              // Floating state
              isFloating 
                ? "top-2 text-xs font-medium" 
                : "top-1/2 -translate-y-1/2 text-sm",
              // Focus state
              isFocused && !error && "text-primary",
              // Error state
              error && "text-destructive",
              // Required indicator
              required && "after:content-['*'] after:ml-0.5 after:text-destructive"
            )}
          >
            {label}
          </label>
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-destructive flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

FloatingInput.displayName = "FloatingInput"

export { FloatingInput }