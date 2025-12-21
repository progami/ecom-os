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
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
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
          className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200
            ${error
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }
            ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-offset-0
          `}
        />
      )}
      {hint && !error && (
        <p className="text-xs text-gray-500 mt-2">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
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
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200 bg-white
          ${error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          }
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}
          focus:outline-none focus:ring-2 focus:ring-offset-0
        `}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
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
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
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
        className={`w-full px-4 py-3 border rounded-lg text-sm transition-all duration-200
          ${error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          }
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
          ${monospace ? 'font-mono' : ''}
          ${resizable ? 'resize-y' : 'resize-none'}
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-offset-0
        `}
      />
      {hint && !error && (
        <p className="text-xs text-gray-500 mt-2">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
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
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
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
    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
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
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <input
              type="checkbox"
              name={name}
              value={opt.value}
              checked={value.includes(opt.value)}
              onChange={(e) => handleChange(opt.value, e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-500 mt-2">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}
