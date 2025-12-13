'use client';

import React from 'react';
import { Calculator, Plus, Download, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SimulationEmptyStateProps {
  onCreateScenario: () => void;
  onLoadTemplate: () => void;
  onStartTour?: () => void;
}

export function SimulationEmptyState({ 
  onCreateScenario, 
  onLoadTemplate,
  onStartTour 
}: SimulationEmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[600px] p-6">
      <Card className="max-w-2xl w-full p-8 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Calculator className="h-12 w-12 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>
        
        {/* Title and description */}
        <h2 className="text-2xl font-bold mb-3">Start Your First Pricing Simulation</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Create pricing scenarios to optimize your margins and profitability. 
          Compare different sourcing options, pricing strategies, and market conditions.
        </p>
        
        {/* Quick tips */}
        <div className="bg-muted rounded-lg p-4 mb-8 text-left max-w-md mx-auto">
          <h3 className="font-semibold text-sm mb-2">Quick Tips:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Add your product costs and sourcing details</li>
            <li>• Set target sale prices and compare margins</li>
            <li>• Analyze ROI across different scenarios</li>
            <li>• Save successful simulations for future reference</li>
          </ul>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onCreateScenario} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Create First Scenario
          </Button>
          <Button onClick={onLoadTemplate} variant="outline" size="lg" className="gap-2">
            <Download className="h-5 w-5" />
            Load Sample Template
          </Button>
          {onStartTour && (
            <Button onClick={onStartTour} variant="ghost" size="lg" className="gap-2">
              <Lightbulb className="h-5 w-5" />
              Take a Tour
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}