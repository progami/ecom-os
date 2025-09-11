'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface MaterialTemplate {
  name: string
  category: string
  description: string
  data: {
    name: string
    densityGCm3: number
    costUnit: 'area' | 'weight' | 'volume' | 'piece'
    thicknessOptions?: number[]
    wasteFactor: number
    isRigid: boolean
    requiresLiner: boolean
    notes: string
    // Suggested values
    suggestedCost?: number
    suggestedMOQ?: number
  }
}

export const materialTemplates: MaterialTemplate[] = [
  {
    name: "LDPE Dust Sheet",
    category: "Flexible Films",
    description: "Lightweight plastic sheeting for protection",
    data: {
      name: "LDPE Dust Sheet",
      densityGCm3: 0.92,
      costUnit: "area",
      thicknessOptions: [0.1, 0.15, 0.2, 0.3, 0.5],
      wasteFactor: 0.05,
      isRigid: false,
      requiresLiner: false,
      notes: "Flexible plastic sheeting sold in rolls. Common widths: 2-6m",
      suggestedCost: 10, // per m²
    }
  },
  {
    name: "Corrugated Cardboard",
    category: "Rigid Sheets",
    description: "Standard single-wall corrugated packaging",
    data: {
      name: "Corrugated Cardboard - Single Wall",
      densityGCm3: 0.20,
      costUnit: "area",
      thicknessOptions: [1.5, 2, 3, 4],
      wasteFactor: 0.15,
      isRigid: false,
      requiresLiner: false,
      notes: "Standard corrugated cardboard for boxes and packaging",
      suggestedCost: 2.50,
      suggestedMOQ: 50,
    }
  },
  {
    name: "Bubble Wrap",
    category: "Protective Materials",
    description: "Air-filled plastic cushioning",
    data: {
      name: "Bubble Wrap",
      densityGCm3: 0.035,
      costUnit: "area",
      thicknessOptions: [3, 5, 10],
      wasteFactor: 0.05,
      isRigid: false,
      requiresLiner: false,
      notes: "Protective cushioning material with air bubbles",
      suggestedCost: 0.85,
    }
  },
  {
    name: "Kraft Paper",
    category: "Paper Products",
    description: "Brown wrapping paper",
    data: {
      name: "Kraft Paper - 80gsm",
      densityGCm3: 0.80,
      costUnit: "weight",
      thicknessOptions: [0.1, 0.15, 0.2],
      wasteFactor: 0.08,
      isRigid: false,
      requiresLiner: false,
      notes: "Standard brown kraft paper for wrapping",
      suggestedCost: 1.20, // per kg
    }
  },
  {
    name: "Stretch Film",
    category: "Flexible Films",
    description: "Stretchable plastic wrap for pallets",
    data: {
      name: "Stretch Film - Clear",
      densityGCm3: 0.92,
      costUnit: "weight",
      thicknessOptions: [0.017, 0.020, 0.023],
      wasteFactor: 0.03,
      isRigid: false,
      requiresLiner: false,
      notes: "Stretchable LLDPE film for pallet wrapping",
      suggestedCost: 110, // per kg
    }
  },
  {
    name: "Foam Sheet",
    category: "Protective Materials",
    description: "PE foam for cushioning",
    data: {
      name: "PE Foam Sheet",
      densityGCm3: 0.05,
      costUnit: "volume",
      thicknessOptions: [5, 10, 15, 20, 25],
      wasteFactor: 0.20,
      isRigid: false,
      requiresLiner: false,
      notes: "Polyethylene foam for product protection",
      suggestedCost: 85, // per m³
    }
  }
]

interface MaterialTemplateCardProps {
  template: MaterialTemplate
  onSelect: (template: MaterialTemplate) => void
}

export function MaterialTemplateCard({ template, onSelect }: MaterialTemplateCardProps) {
  return (
    <Card className="cursor-pointer hover:border-primary transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{template.name}</CardTitle>
          <Badge variant="secondary">{template.category}</Badge>
        </div>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Density:</span>
            <span>{template.data.densityGCm3} g/cm³</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cost unit:</span>
            <span>{template.data.costUnit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Waste:</span>
            <span>{(template.data.wasteFactor * 100).toFixed(0)}%</span>
          </div>
        </div>
        <Button 
          onClick={() => onSelect(template)} 
          className="w-full mt-4"
          variant="outline"
        >
          Use This Template
        </Button>
      </CardContent>
    </Card>
  )
}