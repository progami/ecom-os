'use client';

import React from 'react';
import { Database, Package, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DataEmptyStateProps {
  type: 'materials' | 'sourcing' | 'both';
  onAddData: () => void;
  onLoadTemplate: () => void;
}

export function DataEmptyState({ type, onAddData, onLoadTemplate }: DataEmptyStateProps) {
  const getContent = () => {
    switch (type) {
      case 'materials':
        return {
          icon: Package,
          title: 'No Material Profiles Found',
          description: 'Add material profiles to define your product costs, dimensions, and specifications.',
          tips: [
            'Include all product components and packaging',
            'Set accurate weights for shipping calculations',
            'Factor in quality control and wastage rates',
            'Consider seasonal price variations'
          ]
        };
      case 'sourcing':
        return {
          icon: Database,
          title: 'No Sourcing Profiles Found',
          description: 'Create sourcing profiles to manage supplier costs, MOQs, and lead times.',
          tips: [
            'Compare multiple suppliers for best rates',
            'Include shipping and customs fees',
            'Set realistic lead times',
            'Track supplier reliability scores'
          ]
        };
      case 'both':
        return {
          icon: Database,
          title: 'No Data Profiles Found',
          description: 'Add material and sourcing profiles to start building your pricing scenarios.',
          tips: [
            'Start with your best-selling products',
            'Use templates for common product types',
            'Keep data updated regularly',
            'Build a library of reusable profiles'
          ]
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="max-w-2xl w-full p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <Icon className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>
        
        {/* Content */}
        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold mb-3">{content.title}</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {content.description}
          </p>
        </div>
        
        {/* Tips section */}
        <div className="bg-muted rounded-lg p-6 mb-8 max-w-md mx-auto">
          <h4 className="font-semibold text-sm mb-3">Getting Started Tips:</h4>
          <ul className="space-y-2">
            {content.tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onAddData} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Add {type === 'both' ? 'Data' : type === 'materials' ? 'Material' : 'Sourcing'} Profile
          </Button>
          <Button onClick={onLoadTemplate} variant="outline" size="lg" className="gap-2">
            <Download className="h-5 w-5" />
            Use Template
          </Button>
        </div>
      </Card>
    </div>
  );
}