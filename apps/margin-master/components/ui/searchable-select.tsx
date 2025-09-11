"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export interface Option {
  value: string
  label: string
  disabled?: boolean
  group?: string
  description?: string
}

export interface SearchableSelectProps {
  options: Option[]
  value?: string | string[]
  onChange?: (value: string | string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  multiple?: boolean
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  className?: string
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  onSearch?: (value: string) => void
  clearable?: boolean
  maxSelectedItems?: number
  renderOption?: (option: Option) => React.ReactNode
  renderValue?: (option: Option | Option[]) => React.ReactNode
}

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  multiple = false,
  disabled = false,
  loading = false,
  loadingText = "Loading...",
  className,
  label,
  error,
  helperText,
  required,
  onSearch,
  clearable = true,
  maxSelectedItems,
  renderOption,
  renderValue,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const inputId = React.useId()

  const selectedValues = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  const selectedOptions = React.useMemo(() => {
    return options.filter(option => selectedValues.includes(option.value))
  }, [options, selectedValues])

  const filteredOptions = React.useMemo(() => {
    if (!search) return options
    
    const searchLower = search.toLowerCase()
    return options.filter(option => 
      option.label.toLowerCase().includes(searchLower) ||
      option.description?.toLowerCase().includes(searchLower) ||
      option.value.toLowerCase().includes(searchLower)
    )
  }, [options, search])

  const groupedOptions = React.useMemo(() => {
    const groups: { [key: string]: Option[] } = {}
    const noGroup: Option[] = []

    filteredOptions.forEach(option => {
      if (option.group) {
        if (!groups[option.group]) {
          groups[option.group] = []
        }
        groups[option.group].push(option)
      } else {
        noGroup.push(option)
      }
    })

    return { groups, noGroup }
  }, [filteredOptions])

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue]
      
      if (maxSelectedItems && newValues.length > maxSelectedItems) {
        return
      }
      
      onChange?.(newValues)
    } else {
      onChange?.(optionValue)
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.(multiple ? [] : "")
  }

  const handleRemoveItem = (itemValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (multiple) {
      onChange?.(selectedValues.filter(v => v !== itemValue))
    }
  }

  const displayValue = React.useMemo(() => {
    if (renderValue && selectedOptions.length > 0) {
      return renderValue(multiple ? selectedOptions : selectedOptions[0])
    }

    if (multiple) {
      if (selectedOptions.length === 0) return null
      if (selectedOptions.length === 1) return selectedOptions[0].label
      return `${selectedOptions.length} selected`
    }

    return selectedOptions[0]?.label || null
  }, [selectedOptions, multiple, renderValue])

  const showClear = clearable && selectedValues.length > 0 && !disabled

  return (
    <div className="relative">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block",
            error && "text-destructive",
            required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label || placeholder}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-10 font-normal",
              "hover:bg-background hover:border-primary/50",
              "focus:border-primary focus:ring-2 focus:ring-primary/20",
              error && "border-destructive focus:border-destructive focus:ring-destructive/20",
              !displayValue && "text-muted-foreground",
              className
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{loadingText}</span>
                </>
              ) : (
                displayValue || placeholder
              )}
            </span>
            <div className="flex items-center gap-1">
              {showClear && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100 transition-opacity"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  onSearch?.(e.target.value)
                }}
              />
            </div>
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">{loadingText}</span>
                </div>
              ) : filteredOptions.length === 0 ? (
                <CommandEmpty>{emptyText}</CommandEmpty>
              ) : (
                <>
                  {groupedOptions.noGroup.length > 0 && (
                    <CommandGroup>
                      {groupedOptions.noGroup.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => handleSelect(option.value)}
                          disabled={option.disabled}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {renderOption ? (
                            renderOption(option)
                          ) : (
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              {option.description && (
                                <span className="text-xs text-muted-foreground">{option.description}</span>
                              )}
                            </div>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {Object.entries(groupedOptions.groups).map(([group, groupOptions]) => (
                    <CommandGroup key={group} heading={group}>
                      {groupOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => handleSelect(option.value)}
                          disabled={option.disabled}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {renderOption ? (
                            renderOption(option)
                          ) : (
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              {option.description && (
                                <span className="text-xs text-muted-foreground">{option.description}</span>
                              )}
                            </div>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {multiple && selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedOptions.map((option) => (
            <Badge
              key={option.value}
              variant="secondary"
              className="text-xs"
            >
              {option.label}
              {!disabled && (
                <button
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRemoveItem(option.value, e as any)
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => handleRemoveItem(option.value, e)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  <span className="sr-only">Remove {option.label}</span>
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      
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