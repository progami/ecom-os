'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  step?: number;
  formatLabel?: (value: number) => string;
  className?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min,
  max,
  value,
  onValueChange,
  step = 1,
  formatLabel = (val) => val.toString(),
  className,
  disabled = false,
}: RangeSliderProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const rangeRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState<'min' | 'max' | null>(null);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const getPercentage = (val: number) => {
    return ((val - min) / (max - min)) * 100;
  };

  const getValue = React.useCallback(
    (percentage: number) => {
      const rawValue = (percentage / 100) * (max - min) + min;
      const stepped = Math.round(rawValue / step) * step;
      return Math.min(max, Math.max(min, stepped));
    },
    [max, min, step]
  );

  const handleMouseDown = (type: 'min' | 'max') => (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(type);
  };

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!dragging || !rangeRef.current) return;

      const rect = rangeRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const newValue = getValue(percentage);

      setLocalValue((prev) => {
        const [minVal, maxVal] = prev;
        if (dragging === 'min') {
          return [Math.min(newValue, maxVal), maxVal];
        } else {
          return [minVal, Math.max(newValue, minVal)];
        }
      });
    },
    [dragging, getValue]
  );

  const handleMouseUp = React.useCallback(() => {
    if (dragging) {
      onValueChange(localValue);
      setDragging(null);
    }
  }, [dragging, localValue, onValueChange]);

  React.useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const minPercentage = getPercentage(localValue[0]);
  const maxPercentage = getPercentage(localValue[1]);

  return (
    <div className={cn('relative w-full', className)}>
      <div className="flex justify-between mb-2 text-sm text-muted-foreground">
        <span>{formatLabel(localValue[0])}</span>
        <span>{formatLabel(localValue[1])}</span>
      </div>
      <div
        ref={rangeRef}
        className="relative h-2 w-full rounded-full bg-secondary"
      >
        <div
          className="absolute h-full rounded-full bg-primary"
          style={{
            left: `${minPercentage}%`,
            width: `${maxPercentage - minPercentage}%`,
          }}
        />
        <button
          className={cn(
            'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed',
            dragging === 'min' && 'ring-2 ring-ring ring-offset-2'
          )}
          style={{ left: `${minPercentage}%` }}
          onMouseDown={handleMouseDown('min')}
          disabled={disabled}
          role="slider"
          type="button"
          aria-label="Minimum value"
          aria-valuenow={localValue[0]}
          aria-valuemin={min}
          aria-valuemax={localValue[1]}
          aria-orientation="horizontal"
        />
        <button
          className={cn(
            'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed',
            dragging === 'max' && 'ring-2 ring-ring ring-offset-2'
          )}
          style={{ left: `${maxPercentage}%` }}
          onMouseDown={handleMouseDown('max')}
          disabled={disabled}
          role="slider"
          type="button"
          aria-label="Maximum value"
          aria-valuenow={localValue[1]}
          aria-valuemin={localValue[0]}
          aria-valuemax={max}
          aria-orientation="horizontal"
        />
      </div>
    </div>
  );
}