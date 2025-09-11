'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector for the target element
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  offset?: { x?: number; y?: number };
  action?: () => void; // Optional action to perform when this step is shown
}

interface ProductTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  storageKey?: string;
}

export function ProductTour({
  steps,
  onComplete,
  onSkip,
  storageKey = 'marginmaster-tour-completed'
}: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right' | 'center'>('bottom');
  const tourRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if tour has been completed before
    const hasCompletedTour = localStorage.getItem(storageKey) === 'true';
    if (!hasCompletedTour) {
      // Delay start to ensure page is fully loaded
      setTimeout(() => setIsVisible(true), 500);
    }
  }, [storageKey]);

  useEffect(() => {
    if (isVisible && steps[currentStep]) {
      const step = steps[currentStep];
      const targetElement = document.querySelector(step.target);
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Calculate position with optional offset
        const offsetX = step.offset?.x || 0;
        const offsetY = step.offset?.y || 0;
        
        let top = rect.top + scrollTop;
        let left = rect.left + scrollLeft;
        
        // Determine tooltip position
        const pos = step.position || 'bottom';
        setTooltipPosition(pos);
        
        // Adjust position based on tooltip placement
        switch (pos) {
          case 'top':
            top -= 10;
            left += rect.width / 2;
            break;
          case 'bottom':
            top += rect.height + 10;
            left += rect.width / 2;
            break;
          case 'left':
            top += rect.height / 2;
            left -= 10;
            break;
          case 'right':
            top += rect.height / 2;
            left += rect.width + 10;
            break;
          case 'center':
            top = window.innerHeight / 2;
            left = window.innerWidth / 2;
            break;
        }
        
        setPosition({ 
          top: top + offsetY, 
          left: left + offsetX 
        });
        
        // Highlight the target element
        if (highlightRef.current && pos !== 'center') {
          highlightRef.current.style.width = `${rect.width + 20}px`;
          highlightRef.current.style.height = `${rect.height + 20}px`;
          highlightRef.current.style.top = `${rect.top + scrollTop - 10}px`;
          highlightRef.current.style.left = `${rect.left + scrollLeft - 10}px`;
          highlightRef.current.style.display = 'block';
        } else if (highlightRef.current) {
          highlightRef.current.style.display = 'none';
        }
        
        // Scroll element into view
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Execute step action if provided
        if (step.action) {
          step.action();
        }
      }
    }
  }, [currentStep, isVisible, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    if (onComplete) {
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    if (onSkip) {
      onSkip();
    }
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsVisible(true);
  };

  if (!isVisible || !steps[currentStep]) {
    return null;
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleSkip} />
      
      {/* Highlight box */}
      <div 
        ref={highlightRef}
        className="fixed border-2 border-primary rounded-lg pointer-events-none z-40 transition-all duration-300"
        style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' }}
      />
      
      {/* Tour tooltip */}
      <div
        ref={tourRef}
        className={cn(
          "fixed z-50 bg-background border rounded-lg shadow-lg p-4 max-w-sm transition-all duration-300",
          tooltipPosition === 'top' && "-translate-x-1/2 -translate-y-full",
          tooltipPosition === 'bottom' && "-translate-x-1/2",
          tooltipPosition === 'left' && "-translate-x-full -translate-y-1/2",
          tooltipPosition === 'right' && "-translate-y-1/2",
          tooltipPosition === 'center' && "-translate-x-1/2 -translate-y-1/2"
        )}
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-t-lg overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Close button */}
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-2 right-2 h-6 w-6 p-0"
          onClick={handleSkip}
        >
          <X className="h-4 w-4" />
        </Button>
        
        {/* Content */}
        <div className="mt-2">
          <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{step.content}</p>
          
          {/* Step counter */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </span>
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    index === currentStep ? "bg-primary" : 
                    index < currentStep ? "bg-primary/60" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
              >
                Skip Tour
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    Complete
                    <Check className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Restart tour button component
export function RestartTourButton({ 
  onClick, 
  storageKey = 'marginmaster-tour-completed' 
}: { 
  onClick?: () => void;
  storageKey?: string;
}) {
  const handleRestart = () => {
    localStorage.removeItem(storageKey);
    if (onClick) {
      onClick();
    } else {
      window.location.reload();
    }
  };
  
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRestart}
      className="gap-2"
    >
      <Check className="h-4 w-4" />
      Restart Tour
    </Button>
  );
}