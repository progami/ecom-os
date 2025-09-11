'use client';

import React from 'react';
import { Laptop, Shirt, Home, Package, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface SampleTemplate {
  id: string;
  name: string;
  category: 'electronics' | 'clothing' | 'home-goods';
  description: string;
  icon: React.ElementType;
  data: {
    scenarios: Array<{
      name: string;
      salePrice: number;
      packSize: number;
    }>;
    material: {
      name: string;
      productCost: number;
      weight: number;
      dimensions: { length: number; width: number; height: number };
    };
    sourcing: {
      name: string;
      unitCost: number;
      moq: number;
      leadTime: number;
      shippingCost: number;
    };
  };
  metrics: {
    avgMargin: string;
    avgROI: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
}

export const sampleTemplates: SampleTemplate[] = [
  {
    id: 'electronics-phone-case',
    name: 'Phone Case Bundle',
    category: 'electronics',
    description: 'Premium smartphone cases with multiple SKU variations',
    icon: Laptop,
    data: {
      scenarios: [
        { name: 'Single Case - Premium', salePrice: 24.99, packSize: 1 },
        { name: '3-Pack Bundle', salePrice: 59.99, packSize: 3 },
        { name: 'Wholesale 10-Pack', salePrice: 149.99, packSize: 10 }
      ],
      material: {
        name: 'TPU Phone Case - iPhone 15',
        productCost: 3.50,
        weight: 0.15, // lbs
        dimensions: { length: 6, width: 4, height: 0.5 }
      },
      sourcing: {
        name: 'Shenzhen Tech Supplier',
        unitCost: 3.50,
        moq: 500,
        leadTime: 25,
        shippingCost: 0.75
      }
    },
    metrics: {
      avgMargin: '45-55%',
      avgROI: '120-180%',
      difficulty: 'beginner'
    }
  },
  {
    id: 'clothing-tshirt',
    name: 'Graphic T-Shirt Line',
    category: 'clothing',
    description: 'Custom printed t-shirts with seasonal designs',
    icon: Shirt,
    data: {
      scenarios: [
        { name: 'Single Shirt', salePrice: 29.99, packSize: 1 },
        { name: '2-Pack Deal', salePrice: 49.99, packSize: 2 },
        { name: 'Family 4-Pack', salePrice: 89.99, packSize: 4 }
      ],
      material: {
        name: '100% Cotton T-Shirt - Medium',
        productCost: 5.00,
        weight: 0.35,
        dimensions: { length: 12, width: 10, height: 1 }
      },
      sourcing: {
        name: 'Vietnam Textile Factory',
        unitCost: 5.00,
        moq: 300,
        leadTime: 35,
        shippingCost: 1.20
      }
    },
    metrics: {
      avgMargin: '35-45%',
      avgROI: '80-120%',
      difficulty: 'intermediate'
    }
  },
  {
    id: 'home-goods-organizer',
    name: 'Kitchen Storage Set',
    category: 'home-goods',
    description: 'Modular kitchen organization containers',
    icon: Home,
    data: {
      scenarios: [
        { name: '5-Piece Starter Set', salePrice: 39.99, packSize: 5 },
        { name: '10-Piece Complete Set', salePrice: 69.99, packSize: 10 },
        { name: '20-Piece Pro Set', salePrice: 119.99, packSize: 20 }
      ],
      material: {
        name: 'BPA-Free Plastic Containers',
        productCost: 2.00,
        weight: 0.25,
        dimensions: { length: 8, width: 6, height: 4 }
      },
      sourcing: {
        name: 'Guangzhou Home Products',
        unitCost: 2.00,
        moq: 1000,
        leadTime: 30,
        shippingCost: 0.50
      }
    },
    metrics: {
      avgMargin: '40-50%',
      avgROI: '100-150%',
      difficulty: 'beginner'
    }
  }
];

interface TemplateCardProps {
  template: SampleTemplate;
  onSelect: (template: SampleTemplate) => void;
  selected?: boolean;
}

export function TemplateCard({ template, onSelect, selected }: TemplateCardProps) {
  const Icon = template.icon;
  
  return (
    <Card 
      className={cn(
        "p-6 cursor-pointer transition-all hover:shadow-lg",
        selected && "ring-2 ring-primary"
      )}
      onClick={() => onSelect(template)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center",
            template.category === 'electronics' && "bg-blue-500/10",
            template.category === 'clothing' && "bg-purple-500/10",
            template.category === 'home-goods' && "bg-green-500/10"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              template.category === 'electronics' && "text-blue-500",
              template.category === 'clothing' && "text-purple-500",
              template.category === 'home-goods' && "text-green-500"
            )} />
          </div>
          <div>
            <h3 className="font-semibold">{template.name}</h3>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>
        </div>
        {selected && (
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Avg Margin</p>
          <p className="text-sm font-semibold">{template.metrics.avgMargin}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Avg ROI</p>
          <p className="text-sm font-semibold">{template.metrics.avgROI}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Level</p>
          <Badge 
            variant={template.metrics.difficulty === 'beginner' ? 'default' : 
                    template.metrics.difficulty === 'intermediate' ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {template.metrics.difficulty}
          </Badge>
        </div>
      </div>
      
      {/* Scenarios preview */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground mb-1">Includes {template.data.scenarios.length} scenarios:</p>
        {template.data.scenarios.map((scenario, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{scenario.name}</span>
            <span className="font-medium">${scenario.salePrice}</span>
          </div>
        ))}
      </div>
      
      {/* Product details */}
      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Unit Cost:</span>
          <span className="ml-1 font-medium">${template.data.material.productCost}</span>
        </div>
        <div>
          <span className="text-muted-foreground">MOQ:</span>
          <span className="ml-1 font-medium">{template.data.sourcing.moq} units</span>
        </div>
        <div>
          <span className="text-muted-foreground">Weight:</span>
          <span className="ml-1 font-medium">{template.data.material.weight} lbs</span>
        </div>
        <div>
          <span className="text-muted-foreground">Lead Time:</span>
          <span className="ml-1 font-medium">{template.data.sourcing.leadTime} days</span>
        </div>
      </div>
    </Card>
  );
}

interface TemplatePickerProps {
  onSelectTemplate: (template: SampleTemplate) => void;
  selectedId?: string;
}

export function TemplatePicker({ onSelectTemplate, selectedId }: TemplatePickerProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Choose a Sample Template</h2>
        <p className="text-muted-foreground">
          Start with pre-configured data for common e-commerce products
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sampleTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={onSelectTemplate}
            selected={selectedId === template.id}
          />
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">What's included in each template:</p>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 ml-6">
          <li>• Multiple pricing scenarios to compare</li>
          <li>• Pre-filled material specifications and costs</li>
          <li>• Realistic sourcing profiles with MOQs</li>
          <li>• Calculated margins and ROI estimates</li>
        </ul>
      </div>
    </div>
  );
}