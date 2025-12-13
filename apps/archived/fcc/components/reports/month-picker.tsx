'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface MonthPickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  maxDate?: Date;
  minDate?: Date;
  className?: string;
  showComparison?: boolean;
  onComparisonChange?: (date: Date | null) => void;
  comparisonValue?: Date | null;
}

export function MonthPicker({
  value = new Date(),
  onChange,
  maxDate = new Date(),
  minDate,
  className,
  showComparison = false,
  onComparisonChange,
  comparisonValue
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());

  const months = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(viewYear, monthIndex, 1);
    onChange(newDate);
    if (!showComparison) {
      setIsOpen(false);
    }
  };

  const handleComparisonSelect = (monthIndex: number) => {
    if (onComparisonChange) {
      const newDate = new Date(viewYear - 1, monthIndex, 1);
      onComparisonChange(newDate);
      setIsOpen(false);
    }
  };

  const isMonthDisabled = (monthIndex: number, year: number) => {
    const date = new Date(year, monthIndex, 1);
    if (minDate && date < startOfMonth(minDate)) return true;
    if (maxDate && date > endOfMonth(maxDate)) return true;
    return false;
  };

  const navigateToPreviousMonth = () => {
    const newDate = subMonths(value, 1);
    if (!minDate || newDate >= startOfMonth(minDate)) {
      onChange(newDate);
    }
  };

  const navigateToNextMonth = () => {
    const newDate = addMonths(value, 1);
    if (!maxDate || newDate <= endOfMonth(maxDate)) {
      onChange(newDate);
    }
  };

  const canNavigatePrevious = !minDate || value > startOfMonth(minDate);
  const canNavigateNext = !maxDate || value < endOfMonth(maxDate);

  return (
    <div className={cn("relative", className)}>
      {/* Main display */}
      <div className="flex items-center gap-2">
        <button
          onClick={navigateToPreviousMonth}
          disabled={!canNavigatePrevious}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            canNavigatePrevious
              ? "hover:bg-secondary text-slate-400 hover:text-white"
              : "text-slate-600 cursor-not-allowed"
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-slate-700 
                     border border-default rounded-lg transition-colors min-w-[160px]"
        >
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-white">
            {format(value, 'MMMM yyyy')}
          </span>
        </button>

        <button
          onClick={navigateToNextMonth}
          disabled={!canNavigateNext}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            canNavigateNext
              ? "hover:bg-secondary text-slate-400 hover:text-white"
              : "text-slate-600 cursor-not-allowed"
          )}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {showComparison && comparisonValue && (
          <div className="ml-2 flex items-center gap-2 text-sm text-slate-400">
            <span>vs</span>
            <span className="text-white font-medium">
              {format(comparisonValue, 'MMMM yyyy')}
            </span>
          </div>
        )}
      </div>

      {/* Dropdown picker */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 p-4 bg-secondary border border-default rounded-xl shadow-xl min-w-[280px]">
            {/* Year selector */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setViewYear(viewYear - 1)}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-white">{viewYear}</span>
              <button
                onClick={() => setViewYear(viewYear + 1)}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((month, index) => {
                const isDisabled = isMonthDisabled(index, viewYear);
                const isSelected = 
                  value.getMonth() === index && 
                  value.getFullYear() === viewYear;
                const isComparison = 
                  comparisonValue?.getMonth() === index && 
                  comparisonValue?.getFullYear() === viewYear - 1;

                return (
                  <button
                    key={month}
                    onClick={() => handleMonthSelect(index)}
                    disabled={isDisabled}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isDisabled && "text-slate-600 cursor-not-allowed",
                      !isDisabled && !isSelected && "hover:bg-slate-700 text-slate-300",
                      isSelected && "bg-brand-blue text-white",
                      isComparison && "ring-2 ring-brand-purple"
                    )}
                  >
                    {month.slice(0, 3)}
                  </button>
                );
              })}
            </div>

            {/* Comparison year (if enabled) */}
            {showComparison && (
              <>
                <div className="my-4 border-t border-slate-700" />
                <div className="text-sm text-slate-400 mb-2">
                  Compare with {viewYear - 1}:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {months.map((month, index) => {
                    const isDisabled = isMonthDisabled(index, viewYear - 1);
                    const isSelected = 
                      comparisonValue?.getMonth() === index && 
                      comparisonValue?.getFullYear() === viewYear - 1;

                    return (
                      <button
                        key={`comp-${month}`}
                        onClick={() => handleComparisonSelect(index)}
                        disabled={isDisabled}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isDisabled && "text-slate-600 cursor-not-allowed",
                          !isDisabled && !isSelected && "hover:bg-slate-700 text-slate-300",
                          isSelected && "bg-brand-purple text-white"
                        )}
                      >
                        {month.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Quick presets */}
            <div className="mt-4 pt-4 border-t border-slate-700 flex gap-2">
              <button
                onClick={() => {
                  onChange(new Date());
                  setIsOpen(false);
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 
                         rounded-lg transition-colors"
              >
                This Month
              </button>
              <button
                onClick={() => {
                  onChange(subMonths(new Date(), 1));
                  setIsOpen(false);
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 
                         rounded-lg transition-colors"
              >
                Last Month
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}