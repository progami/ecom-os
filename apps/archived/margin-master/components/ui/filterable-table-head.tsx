'use client';

import * as React from 'react';
import { Filter, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';

export type FilterType = 'text' | 'number' | 'select' | 'range';

export interface FilterState {
  column: string;
  type: FilterType;
  value: any;
}

interface BaseFilterProps {
  column: string;
  filterState?: FilterState;
  onFilter?: (column: string, value: any) => void;
  onClear?: (column: string) => void;
}

interface TextFilterProps extends BaseFilterProps {
  type: 'text';
  placeholder?: string;
}

interface NumberFilterProps extends BaseFilterProps {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

interface SelectFilterProps extends BaseFilterProps {
  type: 'select';
  options: { value: string; label: string }[];
  multiple?: boolean;
  placeholder?: string;
}

interface RangeFilterProps extends BaseFilterProps {
  type: 'range';
  min?: number;
  max?: number;
  step?: number;
  formatLabel?: (value: number) => string;
}

type FilterableTableHeadProps = 
  | TextFilterProps 
  | NumberFilterProps 
  | SelectFilterProps 
  | RangeFilterProps;

export function FilterableTableHead(props: FilterableTableHeadProps) {
  const [open, setOpen] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(props.filterState?.value || '');

  const hasActiveFilter = props.filterState?.value !== undefined && 
    props.filterState?.value !== '' && 
    props.filterState?.value !== null;

  const handleApply = () => {
    if (props.onFilter) {
      props.onFilter(props.column, localValue);
    }
    setOpen(false);
  };

  const handleClear = () => {
    setLocalValue('');
    if (props.onClear) {
      props.onClear(props.column);
    }
    setOpen(false);
  };

  const renderFilterContent = () => {
    switch (props.type) {
      case 'text':
        return (
          <div className="space-y-2 p-2">
            <Input
              placeholder={props.placeholder || 'Filter...'}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApply();
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2 p-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Min</label>
                <Input
                  type="number"
                  placeholder="Min"
                  value={localValue[0] || ''}
                  onChange={(e) => setLocalValue([e.target.value, localValue[1] || ''])}
                  min={props.min}
                  max={props.max}
                  step={props.step}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max</label>
                <Input
                  type="number"
                  placeholder="Max"
                  value={localValue[1] || ''}
                  onChange={(e) => setLocalValue([localValue[0] || '', e.target.value])}
                  min={props.min}
                  max={props.max}
                  step={props.step}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        );

      case 'select':
        const selectedValues = Array.isArray(localValue) ? localValue : [localValue].filter(Boolean);
        return (
          <Command className="p-0">
            <CommandInput placeholder={props.placeholder || 'Search...'} />
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {props.options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    if (props.multiple) {
                      const newValue = selectedValues.includes(option.value)
                        ? selectedValues.filter((v) => v !== option.value)
                        : [...selectedValues, option.value];
                      setLocalValue(newValue);
                    } else {
                      setLocalValue(option.value);
                      if (props.onFilter) {
                        props.onFilter(props.column, option.value);
                      }
                      setOpen(false);
                    }
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedValues.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {props.multiple && (
              <div className="border-t p-2">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={handleClear}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleApply}>
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </Command>
        );

      case 'range':
        const [min, max] = Array.isArray(localValue) ? localValue : [props.min || 0, props.max || 100];
        return (
          <div className="space-y-2 p-2 w-64">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{props.formatLabel ? props.formatLabel(min) : min}</span>
                <span>{props.formatLabel ? props.formatLabel(max) : max}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={min}
                  onChange={(e) => setLocalValue([Number(e.target.value), max])}
                  min={props.min}
                  max={props.max}
                  step={props.step}
                />
                <Input
                  type="number"
                  value={max}
                  onChange={(e) => setLocalValue([min, Number(e.target.value)])}
                  min={props.min}
                  max={props.max}
                  step={props.step}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-8 p-0',
            hasActiveFilter && 'text-primary'
          )}
        >
          <Filter className="h-4 w-4" />
          {hasActiveFilter && (
            <Badge className="absolute -top-1 -right-1 h-2 w-2 p-0" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        {renderFilterContent()}
      </PopoverContent>
    </Popover>
  );
}