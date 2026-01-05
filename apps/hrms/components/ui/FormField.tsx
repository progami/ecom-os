import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { Textarea } from './textarea'
import { Label } from './label'
import { Checkbox } from './checkbox'

type FormFieldProps = {
  label: React.ReactNode
  name?: string
  type?: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  error?: string
  hint?: string
  disabled?: boolean
  children?: React.ReactNode
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  function FormField(
    {
      label,
      name,
      type = 'text',
      required = false,
      placeholder,
      defaultValue,
      value,
      onChange,
      onBlur,
      error,
      hint,
      disabled = false,
      children,
    },
    ref
  ) {
    const inputId = name || React.useId()

    return (
      <div className="space-y-2">
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {children || (
          <Input
            ref={ref}
            id={inputId}
            name={name}
            type={type}
            required={required}
            placeholder={placeholder}
            defaultValue={defaultValue}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            className={cn(error && 'border-destructive focus-visible:ring-destructive')}
          />
        )}
        {hint && !error && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    )
  }
)

// Select field
type SelectFieldProps = {
  label: React.ReactNode
  name?: string
  required?: boolean
  defaultValue?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void
  error?: string
  disabled?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    {
      label,
      name,
      required = false,
      defaultValue,
      value,
      onChange,
      onBlur,
      error,
      disabled = false,
      options,
      placeholder,
    },
    ref
  ) {
    const selectId = name || React.useId()

    return (
      <div className="space-y-2">
        <Label htmlFor={selectId}>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <select
          ref={ref}
          id={selectId}
          name={name}
          required={required}
          defaultValue={defaultValue}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus:ring-destructive'
          )}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    )
  }
)

// Textarea field
type TextareaFieldProps = {
  label: string
  name?: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  error?: string
  hint?: string
  disabled?: boolean
  rows?: number
  monospace?: boolean
  resizable?: boolean
}

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    {
      label,
      name,
      required = false,
      placeholder,
      defaultValue,
      value,
      onChange,
      onBlur,
      error,
      hint,
      disabled = false,
      rows = 4,
      monospace = false,
      resizable = true,
    },
    ref
  ) {
    const textareaId = name || React.useId()

    return (
      <div className="space-y-2">
        <Label htmlFor={textareaId}>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Textarea
          ref={ref}
          id={textareaId}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          rows={rows}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive',
            monospace && 'font-mono',
            !resizable && 'resize-none'
          )}
        />
        {hint && !error && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    )
  }
)

// Form section with title
type FormSectionProps = {
  title: React.ReactNode
  description?: string
  children: React.ReactNode
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// Form actions footer
type FormActionsProps = {
  children: React.ReactNode
}

export function FormActions({ children }: FormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
      {children}
    </div>
  )
}

// Checkbox group for multi-select
type CheckboxGroupFieldProps = {
  label: React.ReactNode
  name: string
  required?: boolean
  options: { value: string; label: string }[]
  value: string[]
  onChange: (values: string[]) => void
  error?: string
  hint?: string
}

export function CheckboxGroupField({
  label,
  name,
  required = false,
  options,
  value,
  onChange,
  error,
  hint,
}: CheckboxGroupFieldProps) {
  const handleChange = (optValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optValue])
    } else {
      onChange(value.filter((v) => v !== optValue))
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted transition-colors"
          >
            <Checkbox
              id={`${name}-${opt.value}`}
              name={name}
              value={opt.value}
              checked={value.includes(opt.value)}
              onCheckedChange={(checked) => handleChange(opt.value, checked === true)}
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
