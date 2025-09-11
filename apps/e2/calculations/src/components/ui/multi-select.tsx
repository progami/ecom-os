'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

interface MultiSelectProps {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  // Check if all are selected
  const isAllSelected = !selected.includes('__NONE_SELECTED__') && (selected.length === 0 || selected.length === options.length)

  const toggleAll = () => {
    if (isAllSelected) {
      // Currently all selected, deselect all
      // We'll use a special marker to indicate "none selected"
      onChange(['__NONE_SELECTED__'])
    } else {
      // Some selected, select all
      onChange([])
    }
  }

  const toggleItem = (value: string) => {
    // Clear the none marker if it exists
    if (selected.includes('__NONE_SELECTED__')) {
      onChange([value])
      return
    }
    
    if (selected.length === 0) {
      // All selected (empty = all), deselect this one
      const newSelected = options
        .filter(opt => opt.value !== value)
        .map(opt => opt.value)
      onChange(newSelected.length > 0 ? newSelected : ['__NONE_SELECTED__'])
    } else {
      // Some selected
      if (selected.includes(value)) {
        // Remove it
        const newSelected = selected.filter(v => v !== value)
        onChange(newSelected.length > 0 ? newSelected : ['__NONE_SELECTED__'])
      } else {
        // Add it
        const newSelected = [...selected, value]
        // If we now have all, just use empty array
        onChange(newSelected.length === options.length ? [] : newSelected)
      }
    }
  }

  // Check if an item is selected
  const isItemSelected = (value: string) => {
    if (selected.includes('__NONE_SELECTED__')) return false
    return selected.length === 0 || selected.includes(value)
  }

  // Get display text
  const getDisplayText = () => {
    if (selected.includes('__NONE_SELECTED__')) {
      return 'None Selected'
    }
    if (selected.length === 0 || selected.length === options.length) {
      return `All (${options.length})`
    }
    if (selected.length === 1) {
      const option = options.find(opt => opt.value === selected[0])
      return option?.label || selected[0]
    }
    return `${selected.length} Selected`
  }

  // Filter options
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between text-left', className)}
        >
          <span className="truncate">{getDisplayText()}</span>
          <div className="flex items-center gap-1 ml-2">
            {selected.length > 0 && selected.length < options.length && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange([]) // Clear = show all
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-2" align="start">
        <div className="space-y-2">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            <button
              className="flex w-full items-center px-2 py-1.5 text-sm font-semibold hover:bg-accent hover:text-accent-foreground rounded-sm"
              onClick={(e) => {
                e.preventDefault()
                toggleAll()
              }}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  isAllSelected ? 'opacity-100' : 'opacity-0'
                )}
              />
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            
            <div className="border-t my-1" />
            
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No options found.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
                  onClick={(e) => {
                    e.preventDefault()
                    toggleItem(option.value)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      isItemSelected(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}