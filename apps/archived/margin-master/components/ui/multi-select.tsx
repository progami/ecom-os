'use client';

import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  maxDisplay?: number;
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyText = 'No items found.',
  className,
  disabled = false,
  maxDisplay = 3,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (currentValue: string) => {
    const newValue = value.includes(currentValue)
      ? value.filter((v) => v !== currentValue)
      : [...value, currentValue];
    onValueChange(newValue);
  };

  const handleRemove = (valueToRemove: string) => {
    onValueChange(value.filter((v) => v !== valueToRemove));
  };

  const handleClear = () => {
    onValueChange([]);
  };

  const displayValue = React.useMemo(() => {
    if (value.length === 0) return placeholder;
    
    const selectedLabels = value
      .map(v => options.find(opt => opt.value === v)?.label || v)
      .slice(0, maxDisplay);
    
    if (value.length > maxDisplay) {
      return `${selectedLabels.join(', ')} +${value.length - maxDisplay} more`;
    }
    
    return selectedLabels.join(', ');
  }, [value, options, placeholder, maxDisplay]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            value.length === 0 && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <div className="flex items-center gap-1">
            {value.length > 0 && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value.includes(option.value) ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface MultiSelectWithBadgesProps extends MultiSelectProps {
  showBadges?: boolean;
}

export function MultiSelectWithBadges({
  showBadges = true,
  ...props
}: MultiSelectWithBadgesProps) {
  const { value, onValueChange, options } = props;

  return (
    <div className="space-y-2">
      <MultiSelect {...props} />
      {showBadges && value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((val) => {
            const option = options.find((opt) => opt.value === val);
            return (
              <Badge
                key={val}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => onValueChange(value.filter((v) => v !== val))}
              >
                {option?.label || val}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}