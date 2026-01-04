import { SearchIcon } from './Icons'

type SearchFormProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  className?: string
}

export function SearchForm({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
  className = '',
}: SearchFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-3 ${className}`}>
      <div className="relative flex-1">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3 border border-input rounded-lg text-sm bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
        />
      </div>
      <button
        type="submit"
        className="h-11 px-5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Search
      </button>
    </form>
  )
}

// Search with filters variant
type FilterOption = {
  value: string
  label: string
}

type SearchWithFiltersProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  filters?: {
    name: string
    value: string
    onChange: (value: string) => void
    options: FilterOption[]
    placeholder?: string
  }[]
}

export function SearchWithFilters({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
  filters = [],
}: SearchWithFiltersProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-11 pr-4 py-3 border border-input rounded-lg text-sm bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
          />
        </div>
        <button
          type="submit"
          className="h-11 px-5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Search
        </button>
      </div>
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {filters.map((filter) => (
            <select
              key={filter.name}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="px-4 py-3 border border-input rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            >
              {filter.placeholder && (
                <option value="">{filter.placeholder}</option>
              )}
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
    </form>
  )
}
