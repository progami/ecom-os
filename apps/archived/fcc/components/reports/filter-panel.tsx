'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, Filter, X, RotateCcw, Check, Calendar } from 'lucide-react';
import { DateRangePicker, DateRange } from './date-range-picker';
import { MonthPicker } from './month-picker';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'date-range' | 'select' | 'multi-select' | 'number-range' | 'text' | 'month' | 'date';
  options?: FilterOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface FilterValue {
  dateRange?: DateRange | null;
  select?: string;
  multiSelect?: string[];
  numberRange?: { min?: number; max?: number };
  text?: string;
  month?: Date | null;
  date?: Date | null;
}

export interface FilterValues {
  [key: string]: FilterValue;
}

export interface ActiveFilter {
  key: string;
  label: string;
  displayValue: string;
  value: FilterValue;
}

export interface FilterPanelProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onApply?: () => void;
  onReset?: () => void;
  isLoading?: boolean;
  className?: string;
  defaultCollapsed?: boolean;
  showActiveFilters?: boolean;
}

function FilterChip({ filter, onRemove }: { 
  filter: ActiveFilter; 
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center space-x-1 px-2 py-1 bg-brand-blue/20 border border-brand-blue/30 rounded-md text-xs text-brand-blue">
      <span className="font-medium">{filter.label}:</span>
      <span>{filter.displayValue}</span>
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-brand-blue/20 rounded p-0.5 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function NumberRangeInput({ 
  value, 
  onChange, 
  min, 
  max, 
  step = 1, 
  placeholder 
}: {
  value?: { min?: number; max?: number };
  onChange: (value: { min?: number; max?: number }) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        placeholder="Min"
        value={value?.min ?? ''}
        onChange={(e) => onChange({ 
          ...value, 
          min: e.target.value ? Number(e.target.value) : undefined 
        })}
        min={min}
        max={max}
        step={step}
        className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      <input
        type="number"
        placeholder="Max"
        value={value?.max ?? ''}
        onChange={(e) => onChange({ 
          ...value, 
          max: e.target.value ? Number(e.target.value) : undefined 
        })}
        min={min}
        max={max}
        step={step}
        className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
    </div>
  );
}

function MultiSelectDropdown({ 
  options, 
  value = [], 
  onChange, 
  placeholder 
}: {
  options: FilterOption[];
  value?: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOptionToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const selectedLabels = value.length > 0 
    ? value.map(v => options.find(opt => opt.value === v)?.label).filter(Boolean).join(', ')
    : placeholder || 'Select options';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
      >
        <span className={value.length > 0 ? 'text-white' : 'text-slate-400'}>
          {selectedLabels}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleOptionToggle(option.value)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <span className="text-slate-300">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-slate-500">({option.count})</span>
                )}
              </div>
              {value.includes(option.value) && (
                <Check className="h-4 w-4 text-brand-blue" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterPanel({
  filters,
  values,
  onChange,
  onApply,
  onReset,
  isLoading = false,
  className = '',
  defaultCollapsed = false,
  showActiveFilters = true
}: FilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Calculate active filters
  const activeFilters: ActiveFilter[] = filters.reduce<ActiveFilter[]>((acc, filter) => {
    const value = values[filter.key];
    if (!value) return acc;

    let displayValue = '';
    let hasValue = false;

    switch (filter.type) {
      case 'date-range':
        if (value.dateRange) {
          displayValue = `${value.dateRange.from.toLocaleDateString()} - ${value.dateRange.to.toLocaleDateString()}`;
          hasValue = true;
        }
        break;
      case 'select':
        if (value.select) {
          const option = filter.options?.find(opt => opt.value === value.select);
          displayValue = option?.label || value.select;
          hasValue = true;
        }
        break;
      case 'multi-select':
        if (value.multiSelect && value.multiSelect.length > 0) {
          if (value.multiSelect.length === 1) {
            const option = filter.options?.find(opt => opt.value === value.multiSelect![0]);
            displayValue = option?.label || value.multiSelect[0];
          } else {
            displayValue = `${value.multiSelect.length} selected`;
          }
          hasValue = true;
        }
        break;
      case 'number-range':
        if (value.numberRange && (value.numberRange.min !== undefined || value.numberRange.max !== undefined)) {
          const min = value.numberRange.min !== undefined ? value.numberRange.min : '';
          const max = value.numberRange.max !== undefined ? value.numberRange.max : '';
          displayValue = `${min} - ${max}`;
          hasValue = true;
        }
        break;
      case 'text':
        if (value.text && value.text.trim()) {
          displayValue = value.text;
          hasValue = true;
        }
        break;
      case 'month':
        if (value.month) {
          displayValue = value.month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          hasValue = true;
        }
        break;
      case 'date':
        if (value.date) {
          displayValue = value.date.toLocaleDateString();
          hasValue = true;
        }
        break;
    }

    if (hasValue) {
      acc.push({
        key: filter.key,
        label: filter.label,
        displayValue,
        value
      });
    }

    return acc;
  }, []);

  const handleFilterChange = (key: string, filterValue: FilterValue) => {
    onChange({
      ...values,
      [key]: filterValue
    });
  };

  const handleRemoveFilter = (key: string) => {
    const newValues = { ...values };
    delete newValues[key];
    onChange(newValues);
  };

  const handleResetAll = () => {
    onChange({});
    onReset?.();
  };

  return (
    <>
      {/* Mobile filter button - shown only on mobile */}
      <div className="sm:hidden mb-4">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary border border-default rounded-xl text-white"
        >
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
            {activeFilters.length > 0 && (
              <span className="px-2 py-0.5 bg-brand-blue/20 text-brand-blue text-xs rounded-full">
                {activeFilters.length}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile filter drawer */}
      {isMobileOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative ml-auto w-full max-w-sm bg-slate-900 h-full overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Filters</h3>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              {/* Active filters in mobile */}
              {showActiveFilters && activeFilters.length > 0 && (
                <div className="mb-4 pb-4 border-b border-slate-700">
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.map((filter) => (
                      <FilterChip
                        key={filter.key}
                        filter={filter}
                        onRemove={() => handleRemoveFilter(filter.key)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Filter controls in mobile */}
              <div className="space-y-4">
                {filters.map((filter) => (
                  <div key={filter.key} className="space-y-2">
                    <label className="block text-sm font-medium text-white">
                      {filter.label}
                    </label>
                    
                    {filter.type === 'date-range' && (
                      <DateRangePicker
                        value={values[filter.key]?.dateRange}
                        onChange={(dateRange) => handleFilterChange(filter.key, { dateRange })}
                        placeholder={filter.placeholder}
                        disabled={isLoading}
                      />
                    )}

                    {filter.type === 'select' && filter.options && (
                      <select
                        value={values[filter.key]?.select || ''}
                        onChange={(e) => handleFilterChange(filter.key, { select: e.target.value || undefined })}
                        disabled={isLoading}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                      >
                        <option value="">{filter.placeholder || 'Select option'}</option>
                        {filter.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                            {option.count !== undefined && ` (${option.count})`}
                          </option>
                        ))}
                      </select>
                    )}

                    {filter.type === 'multi-select' && filter.options && (
                      <MultiSelectDropdown
                        options={filter.options}
                        value={values[filter.key]?.multiSelect}
                        onChange={(multiSelect) => handleFilterChange(filter.key, { multiSelect })}
                        placeholder={filter.placeholder}
                      />
                    )}

                    {filter.type === 'number-range' && (
                      <NumberRangeInput
                        value={values[filter.key]?.numberRange}
                        onChange={(numberRange) => handleFilterChange(filter.key, { numberRange })}
                        min={filter.min}
                        max={filter.max}
                        step={filter.step}
                        placeholder={filter.placeholder}
                      />
                    )}

                    {filter.type === 'text' && (
                      <input
                        type="text"
                        value={values[filter.key]?.text || ''}
                        onChange={(e) => handleFilterChange(filter.key, { text: e.target.value || undefined })}
                        placeholder={filter.placeholder}
                        disabled={isLoading}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                      />
                    )}

                    {filter.type === 'month' && (
                      <MonthPicker
                        value={values[filter.key]?.month || undefined}
                        onChange={(month) => handleFilterChange(filter.key, { month })}
                        maxDate={new Date()}
                        className="w-full"
                      />
                    )}

                    {filter.type === 'date' && (
                      <div className="relative">
                        <input
                          type="date"
                          value={values[filter.key]?.date ? values[filter.key].date!.toISOString().split('T')[0] : ''}
                          onChange={(e) => handleFilterChange(filter.key, { date: e.target.value ? new Date(e.target.value) : undefined })}
                          disabled={isLoading}
                          className="w-full min-w-[140px] px-3 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Mobile action buttons */}
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => {
                    onApply?.();
                    setIsMobileOpen(false);
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Applying...' : 'Apply Filters'}
                </button>
                <button
                  onClick={handleResetAll}
                  disabled={isLoading || activeFilters.length === 0}
                  className="w-full px-4 py-3 text-slate-400 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop filter panel */}
      <div className={`hidden sm:block bg-secondary backdrop-blur-sm border border-default rounded-xl ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center space-x-2 text-white hover:text-slate-300 transition-colors"
          >
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
            {activeFilters.length > 0 && (
              <span className="px-2 py-0.5 bg-brand-blue/20 text-brand-blue text-xs rounded-full">
                {activeFilters.length}
              </span>
            )}
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>

          {activeFilters.length > 0 && (
            <button
              onClick={handleResetAll}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-400 hover:text-white border border-slate-600 rounded hover:border-slate-500 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

      {/* Active Filters */}
      {showActiveFilters && activeFilters.length > 0 && (
        <div className="p-4 border-b border-default">
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <FilterChip
                key={filter.key}
                filter={filter}
                onRemove={() => handleRemoveFilter(filter.key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filter Controls */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filters.map((filter) => (
              <div key={filter.key} className="space-y-2">
                <label className="block text-sm font-medium text-white">
                  {filter.label}
                </label>
                
                {filter.type === 'date-range' && (
                  <DateRangePicker
                    value={values[filter.key]?.dateRange}
                    onChange={(dateRange) => handleFilterChange(filter.key, { dateRange })}
                    placeholder={filter.placeholder}
                    disabled={isLoading}
                  />
                )}

                {filter.type === 'select' && filter.options && (
                  <select
                    value={values[filter.key]?.select || ''}
                    onChange={(e) => handleFilterChange(filter.key, { select: e.target.value || undefined })}
                    disabled={isLoading}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  >
                    <option value="">{filter.placeholder || 'Select option'}</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        {option.count !== undefined && ` (${option.count})`}
                      </option>
                    ))}
                  </select>
                )}

                {filter.type === 'multi-select' && filter.options && (
                  <MultiSelectDropdown
                    options={filter.options}
                    value={values[filter.key]?.multiSelect}
                    onChange={(multiSelect) => handleFilterChange(filter.key, { multiSelect })}
                    placeholder={filter.placeholder}
                  />
                )}

                {filter.type === 'number-range' && (
                  <NumberRangeInput
                    value={values[filter.key]?.numberRange}
                    onChange={(numberRange) => handleFilterChange(filter.key, { numberRange })}
                    min={filter.min}
                    max={filter.max}
                    step={filter.step}
                    placeholder={filter.placeholder}
                  />
                )}

                {filter.type === 'text' && (
                  <input
                    type="text"
                    value={values[filter.key]?.text || ''}
                    onChange={(e) => handleFilterChange(filter.key, { text: e.target.value || undefined })}
                    placeholder={filter.placeholder}
                    disabled={isLoading}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  />
                )}

                {filter.type === 'month' && (
                  <MonthPicker
                    value={values[filter.key]?.month || undefined}
                    onChange={(month) => handleFilterChange(filter.key, { month })}
                    maxDate={new Date()}
                    className="w-full"
                  />
                )}

                {filter.type === 'date' && (
                  <div className="relative">
                    <input
                      type="date"
                      value={values[filter.key]?.date ? values[filter.key].date!.toISOString().split('T')[0] : ''}
                      onChange={(e) => handleFilterChange(filter.key, { date: e.target.value ? new Date(e.target.value) : undefined })}
                      disabled={isLoading}
                      className="w-full px-2 py-1 pr-8 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-800 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          {onApply && (
            <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-default">
              <button
                onClick={handleResetAll}
                disabled={isLoading || activeFilters.length === 0}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <button
                onClick={onApply}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Applying...' : 'Apply Filters'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

export default FilterPanel;