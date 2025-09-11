"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface FormFieldProps {
  children: React.ReactNode
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  tooltip?: string
  className?: string
  labelClassName?: string
  id?: string
}

export function FormField({
  children,
  label,
  error,
  helperText,
  required,
  tooltip,
  className,
  labelClassName,
  id,
}: FormFieldProps) {
  const fieldId = id || React.useId()

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-2">
          <label
            htmlFor={fieldId}
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              error && "text-destructive",
              required && "after:content-['*'] after:ml-0.5 after:text-destructive",
              labelClassName
            )}
          >
            {label}
          </label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      
      {React.cloneElement(children as React.ReactElement, { id: fieldId })}
      
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1 animate-in fade-in-0 slide-in-from-top-1">
          <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p className="text-xs text-muted-foreground animate-in fade-in-0 slide-in-from-top-1">
          {helperText}
        </p>
      )}
    </div>
  )
}

// Additional component for inline form fields (useful for compact forms)
export interface InlineFormFieldProps extends FormFieldProps {
  labelWidth?: string
}

export function InlineFormField({
  children,
  label,
  error,
  helperText,
  required,
  tooltip,
  className,
  labelClassName,
  labelWidth = "120px",
  id,
}: InlineFormFieldProps) {
  const fieldId = id || React.useId()

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-4">
        {label && (
          <div 
            className="flex items-center gap-2 pt-2"
            style={{ minWidth: labelWidth, maxWidth: labelWidth }}
          >
            <label
              htmlFor={fieldId}
              className={cn(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                error && "text-destructive",
                required && "after:content-['*'] after:ml-0.5 after:text-destructive",
                labelClassName
              )}
            >
              {label}
            </label>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
        
        <div className="flex-1">
          {React.cloneElement(children as React.ReactElement, { id: fieldId })}
        </div>
      </div>
      
      {(error || helperText) && (
        <div className="flex gap-4">
          <div style={{ minWidth: labelWidth, maxWidth: labelWidth }} />
          <div className="flex-1">
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1 animate-in fade-in-0 slide-in-from-top-1">
                <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                {error}
              </p>
            )}
            {helperText && !error && (
              <p className="text-xs text-muted-foreground animate-in fade-in-0 slide-in-from-top-1">
                {helperText}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Form section component for grouping related fields
export interface FormSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-base font-semibold leading-none tracking-tight">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}