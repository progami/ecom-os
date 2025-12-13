'use client';

import { useState, useRef, useEffect } from 'react';
import { format, subDays, subMonths, subWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns';
import { Calendar, ChevronDown, Check } from 'lucide-react';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DatePreset {
  id: string;
  label: string;
  range: DateRange;
}

export interface DateRangePickerProps {
  value?: DateRange | null;
  onChange: (range: DateRange | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const getDatePresets = (): DatePreset[] => {
  const today = new Date();
  
  return [
    {
      id: 'today',
      label: 'Today',
      range: { from: today, to: today }
    },
    {
      id: 'yesterday',
      label: 'Yesterday',
      range: { from: subDays(today, 1), to: subDays(today, 1) }
    },
    {
      id: 'last-7-days',
      label: 'Last 7 days',
      range: { from: subDays(today, 6), to: today }
    },
    {
      id: 'last-30-days',
      label: 'Last 30 days',
      range: { from: subDays(today, 29), to: today }
    },
    {
      id: 'this-week',
      label: 'This week',
      range: { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) }
    },
    {
      id: 'last-week',
      label: 'Last week',
      range: { 
        from: startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), 
        to: endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
      }
    },
    {
      id: 'this-month',
      label: 'This month',
      range: { from: startOfMonth(today), to: endOfMonth(today) }
    },
    {
      id: 'last-month',
      label: 'Last month',
      range: { 
        from: startOfMonth(subMonths(today, 1)), 
        to: endOfMonth(subMonths(today, 1))
      }
    },
    {
      id: 'this-quarter',
      label: 'This quarter',
      range: { from: startOfQuarter(today), to: endOfQuarter(today) }
    },
    {
      id: 'last-quarter',
      label: 'Last quarter',
      range: { 
        from: startOfQuarter(subMonths(today, 3)), 
        to: endOfQuarter(subMonths(today, 3))
      }
    },
    {
      id: 'this-year',
      label: 'This year',
      range: { from: startOfYear(today), to: endOfYear(today) }
    },
    {
      id: 'last-year',
      label: 'Last year',
      range: { 
        from: startOfYear(subMonths(today, 12)), 
        to: endOfYear(subMonths(today, 12))
      }
    }
  ];
};

export function DateRangePicker({ 
  value, 
  onChange, 
  placeholder = "Select date range",
  disabled = false,
  className = ""
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const presets = getDatePresets();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Initialize custom dates when value changes
  useEffect(() => {
    if (value) {
      setCustomFromDate(format(value.from, 'yyyy-MM-dd'));
      setCustomToDate(format(value.to, 'yyyy-MM-dd'));
      
      // Check if current value matches any preset
      const matchingPreset = presets.find(preset => 
        format(preset.range.from, 'yyyy-MM-dd') === format(value.from, 'yyyy-MM-dd') &&
        format(preset.range.to, 'yyyy-MM-dd') === format(value.to, 'yyyy-MM-dd')
      );
      
      setSelectedPreset(matchingPreset?.id || null);
    }
  }, [value]);

  const handlePresetSelect = (preset: DatePreset) => {
    setSelectedPreset(preset.id);
    onChange(preset.range);
    setIsOpen(false);
  };

  const handleCustomDateApply = () => {
    if (customFromDate && customToDate) {
      const fromDate = new Date(customFromDate);
      const toDate = new Date(customToDate);
      
      if (fromDate <= toDate) {
        setSelectedPreset(null);
        onChange({ from: fromDate, to: toDate });
        setIsOpen(false);
      }
    }
  };

  const handleClear = () => {
    setSelectedPreset(null);
    setCustomFromDate('');
    setCustomToDate('');
    onChange(null);
    setIsOpen(false);
  };

  const displayValue = value ? 
    `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}` : 
    placeholder;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center justify-between w-full px-3 py-2 
          bg-slate-800 border border-slate-600 rounded-lg text-sm
          text-white placeholder:text-slate-400
          hover:bg-slate-700 hover:border-slate-500
          focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
        `}
      >
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className={value ? 'text-white' : 'text-slate-400'}>
            {displayValue}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-[80vh] sm:max-h-80 overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            {/* Presets */}
            <div className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-slate-600">
              <div className="p-3 border-b border-slate-600">
                <h4 className="text-sm font-medium text-white">Quick select</h4>
              </div>
              <div className="max-h-40 sm:max-h-60 overflow-y-auto">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`
                      w-full px-3 py-3 sm:py-2 text-left text-sm hover:bg-slate-700
                      transition-colors duration-150 flex items-center justify-between
                      ${selectedPreset === preset.id ? 'bg-slate-700 text-brand-blue' : 'text-slate-300'}
                    `}
                  >
                    <span>{preset.label}</span>
                    {selectedPreset === preset.id && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range */}
            <div className="w-full sm:w-64 p-4 sm:p-3">
              <h4 className="text-sm font-medium text-white mb-3">Custom range</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">From</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="w-full min-w-[140px] px-3 py-2 sm:px-2 sm:py-1 pr-8 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-blue hover:bg-slate-800 hover:border-slate-500 transition-colors"
                    />
                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">To</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="w-full min-w-[140px] px-3 py-2 sm:px-2 sm:py-1 pr-8 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-blue hover:bg-slate-800 hover:border-slate-500 transition-colors"
                    />
                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={handleClear}
                    className="flex-1 px-3 py-2 sm:py-1 text-xs text-slate-400 hover:text-white border border-slate-600 rounded hover:border-slate-500 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleCustomDateApply}
                    disabled={!customFromDate || !customToDate}
                    className="flex-1 px-3 py-2 sm:py-1 text-xs bg-brand-blue hover:bg-brand-blue/80 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;