'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const TooltipRoot = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Backwards-compatible simple Tooltip API
type SimpleTooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
};

function Tooltip({
  content,
  children,
  position = 'top',
  delay = 100,
  className,
  style,
}: SimpleTooltipProps) {
  const sideMap: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
    top: 'top',
    bottom: 'bottom',
    left: 'left',
    right: 'right',
  };

  return (
    <TooltipRoot delayDuration={delay}>
      <TooltipTrigger asChild>
        <div className={className} style={style}>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side={sideMap[position]}
        className="max-w-xs whitespace-pre-line rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
      >
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}

export { Tooltip, TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider };
