import { cn } from '@/lib/utils'

type FormFieldProps = {
  label: React.ReactNode
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  hint?: string
  disabled?: boolean
  children?: React.ReactNode
}

export function FormField({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
  value,
  onChange,
  error,
  hint,
  disabled = false,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-foreground mb-2">
        {label}
        {required && <span className="text-[hsl(var(--destructive))] ml-0.5">*</span>}
      </label>
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-3 border rounded-xl text-sm transition-all duration-200 shadow-[var(--shadow-sm)]',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'placeholder:text-muted-foreground',
            error
              ? 'border-[hsl(var(--destructive))] focus:ring-[hsl(var(--destructive))] focus:border-[hsl(var(--destructive))]'
              : 'border-border/60 focus:ring-[hsl(var(--accent))] focus:border-[hsl(var(--accent))]',
            disabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-card'
          )}
        />
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground mt-2">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[hsl(var(--destructive))] mt-2">{error}</p>
      )}
    </div>
  )
}

// Select field
type SelectFieldProps = {
  label: React.ReactNode
  name: string
  required?: boolean
  defaultValue?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  error?: string
  disabled?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
}

export function SelectField({
  label,
  name,
  required = false,
  defaultValue,
  value,
  onChange,
  error,
  disabled = false,
  options,
  placeholder,
}: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-foreground mb-2">
        {label}
        {required && <span className="text-[hsl(var(--destructive))] ml-0.5">*</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-3 border rounded-xl text-sm transition-all duration-200 bg-card shadow-[var(--shadow-sm)]',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-[hsl(var(--destructive))] focus:ring-[hsl(var(--destructive))] focus:border-[hsl(var(--destructive))]'
            : 'border-border/60 focus:ring-[hsl(var(--accent))] focus:border-[hsl(var(--accent))]',
          disabled && 'bg-muted text-muted-foreground cursor-not-allowed'
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
        <p className="text-xs text-[hsl(var(--destructive))] mt-2">{error}</p>
      )}
    </div>
  )
}

// Textarea field
type TextareaFieldProps = {
  label: string
  name: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  error?: string
  hint?: string
  disabled?: boolean
  rows?: number
  monospace?: boolean
  resizable?: boolean
}

export function TextareaField({
  label,
  name,
  required = false,
  placeholder,
  defaultValue,
  value,
  onChange,
  error,
  hint,
  disabled = false,
  rows = 4,
  monospace = false,
  resizable = true,
}: TextareaFieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-foreground mb-2">
        {label}
        {required && <span className="text-[hsl(var(--destructive))] ml-0.5">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={rows}
        className={cn(
          'w-full px-4 py-3 border rounded-xl text-sm transition-all duration-200 shadow-[var(--shadow-sm)]',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'placeholder:text-muted-foreground',
          error
            ? 'border-[hsl(var(--destructive))] focus:ring-[hsl(var(--destructive))] focus:border-[hsl(var(--destructive))]'
            : 'border-border/60 focus:ring-[hsl(var(--accent))] focus:border-[hsl(var(--accent))]',
          disabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-card',
          monospace && 'font-mono',
          resizable ? 'resize-y' : 'resize-none'
        )}
      />
      {hint && !error && (
        <p className="text-xs text-muted-foreground mt-2">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[hsl(var(--destructive))] mt-2">{error}</p>
      )}
    </div>
  )
}

// Form section with title
type FormSectionProps = {
  title: React.ReactNode
  description?: string
  children: React.ReactNode
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="space-y-6">
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
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <input
              type="checkbox"
              name={name}
              value={opt.value}
              checked={value.includes(opt.value)}
              onChange={(e) => handleChange(opt.value, e.target.checked)}
              className="h-4 w-4 text-accent border-input rounded focus:ring-ring"
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
      {hint && !error && (
        <p className="text-xs text-muted-foreground mt-2">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}
