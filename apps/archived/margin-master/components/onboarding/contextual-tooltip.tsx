'use client';

import React from 'react';
import { HelpCircle, Info, Calculator } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ContextualTooltipProps {
  content: string | React.ReactNode;
  formula?: string;
  example?: string;
  children?: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  icon?: 'help' | 'info' | 'calc';
  className?: string;
  triggerClassName?: string;
}

export function ContextualTooltip({
  content,
  formula,
  example,
  children,
  side = 'top',
  icon = 'help',
  className,
  triggerClassName
}: ContextualTooltipProps) {
  const IconComponent = icon === 'help' ? HelpCircle : icon === 'info' ? Info : Calculator;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                triggerClassName
              )}
              type="button"
            >
              <IconComponent className="h-4 w-4" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          className={cn("max-w-xs", className)}
          sideOffset={5}
        >
          <div className="space-y-2">
            {/* Main content */}
            <div className="text-sm">
              {typeof content === 'string' ? <p>{content}</p> : content}
            </div>
            
            {/* Formula section */}
            {formula && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium mb-1">Formula:</p>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {formula}
                </code>
              </div>
            )}
            
            {/* Example section */}
            {example && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium mb-1">Example:</p>
                <p className="text-xs text-muted-foreground">{example}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Pre-configured tooltips for common fields
export const TooltipPresets = {
  NetMargin: (
    <ContextualTooltip
      content="The percentage of revenue that remains as profit after all expenses"
      formula="((Sale Price - Total Costs) / Sale Price) × 100"
      example="If sale price is $50 and total costs are $30, net margin is 40%"
      icon="calc"
    />
  ),
  
  ROI: (
    <ContextualTooltip
      content="Return on Investment shows the efficiency of your investment"
      formula="((Net Profit / Total Investment) × 100)"
      example="If you invest $20 and make $10 profit, ROI is 50%"
      icon="calc"
    />
  ),
  
  LandedCost: (
    <ContextualTooltip
      content="Total cost to get the product ready for sale, including product cost, shipping, duties, and fees"
      formula="Product Cost + Shipping + Duties + Other Fees"
      icon="info"
    />
  ),
  
  FBAFee: (
    <ContextualTooltip
      content="Amazon's fulfillment fee based on product size and weight"
      example="Standard size (1 lb): ~$3.22, Oversize (5 lb): ~$8.26"
      icon="info"
    />
  ),
  
  ReferralFee: (
    <ContextualTooltip
      content="Amazon's commission on each sale, typically 8-15% depending on category"
      example="Electronics: 8%, Clothing: 17%, Most categories: 15%"
      icon="info"
    />
  ),
  
  PackSize: (
    <ContextualTooltip
      content="Number of units sold together. Used to calculate per-unit costs"
      example="Pack of 3 items = Pack size 3"
      icon="help"
    />
  ),
  
  MaterialProfile: (
    <ContextualTooltip
      content="Pre-saved product specifications including dimensions, weight, and material costs"
      icon="help"
    />
  ),
  
  SourcingProfile: (
    <ContextualTooltip
      content="Supplier information including MOQs, lead times, and negotiated pricing"
      icon="help"
    />
  ),
  
  BreakEven: (
    <ContextualTooltip
      content="Number of units you need to sell to cover your initial investment"
      formula="Fixed Costs / (Sale Price - Variable Costs per Unit)"
      icon="calc"
    />
  ),
  
  MarketCompetitiveness: (
    <ContextualTooltip
      content="Score (0-100) indicating how competitive your pricing is in the market"
      example="Score > 70: Very competitive, 50-70: Moderate, < 50: Less competitive"
      icon="info"
    />
  )
};

// Mobile-friendly tooltip wrapper
export function MobileTooltip({
  content,
  children,
  className
}: {
  content: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div className="relative inline-block">
      <div
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </div>
      
      {showTooltip && (
        <div 
          className={cn(
            "absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2",
            "bg-popover text-popover-foreground rounded-md shadow-lg",
            "p-3 max-w-xs text-sm",
            "animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          <div className="relative">
            {content}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-popover" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}