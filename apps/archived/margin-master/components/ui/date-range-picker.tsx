'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  value?: DateRange;
  onValueChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
}

export function DateRangePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date range',
  className,
  disabled = false,
  align = 'start',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const [fromValue, setFromValue] = React.useState(
    value?.from ? formatDate(value.from) : ''
  );
  const [toValue, setToValue] = React.useState(
    value?.to ? formatDate(value.to) : ''
  );

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromValue(e.target.value);
    if (e.target.value) {
      const newDate = new Date(e.target.value);
      onValueChange({ from: newDate, to: value?.to });
    }
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToValue(e.target.value);
    if (e.target.value) {
      const newDate = new Date(e.target.value);
      onValueChange({ from: value?.from, to: newDate });
    }
  };

  const handleClear = () => {
    setFromValue('');
    setToValue('');
    onValueChange(undefined);
    setOpen(false);
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {formatDisplayDate(value.from)} -{' '}
                  {formatDisplayDate(value.to)}
                </>
              ) : (
                formatDisplayDate(value.from)
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align={align}>
          <div className="space-y-4 p-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <input
                type="date"
                value={fromValue}
                onChange={handleFromChange}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                max={toValue || undefined}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <input
                type="date"
                value={toValue}
                onChange={handleToChange}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                min={fromValue || undefined}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}