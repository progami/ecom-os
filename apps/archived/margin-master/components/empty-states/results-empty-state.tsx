'use client';

import React from 'react';
import { BarChart3, Calculator, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ResultsEmptyStateProps {
  onCalculate: () => void;
  hasScenarios: boolean;
}

export function ResultsEmptyState({ onCalculate, hasScenarios }: ResultsEmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-lg w-full p-8 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>
        
        {/* Content */}
        <h3 className="text-xl font-semibold mb-3">No Results Yet</h3>
        <p className="text-muted-foreground mb-6">
          {hasScenarios 
            ? "Calculate your scenarios to see profitability metrics and comparisons."
            : "Create scenarios first, then calculate to see your results here."
          }
        </p>
        
        {/* Visual flow */}
        {hasScenarios && (
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-2 border-primary flex items-center justify-center">
                <span className="font-semibold">1</span>
              </div>
              <span>Add Data</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center">
                <span className="font-semibold">2</span>
              </div>
              <span>Calculate</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center">
                <span className="font-semibold">3</span>
              </div>
              <span>View Results</span>
            </div>
          </div>
        )}
        
        {/* Action */}
        <Button 
          onClick={onCalculate} 
          disabled={!hasScenarios}
          size="lg"
          className="gap-2"
        >
          <Calculator className="h-5 w-5" />
          {hasScenarios ? 'Calculate Scenarios' : 'Add Scenarios First'}
        </Button>
      </Card>
    </div>
  );
}