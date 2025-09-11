'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AreaModalProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  productSku: string
  currentArea?: {
    length?: number  // stored in cm
    width?: number   // stored in cm
  }
  onSave: (area: { length: number; width: number; area: number }) => void
}

export function AreaModal({
  isOpen,
  onClose,
  productName,
  productSku,
  currentArea,
  onSave
}: AreaModalProps) {
  // Convert stored cm values to feet for display (1 ft = 30.48 cm)
  const [lengthFeet, setLengthFeet] = useState(currentArea?.length ? parseFloat((currentArea.length / 30.48).toFixed(2)) : 0)
  const [widthFeet, setWidthFeet] = useState(currentArea?.width ? parseFloat((currentArea.width / 30.48).toFixed(2)) : 0)
  const [lengthCm, setLengthCm] = useState(currentArea?.length || 0)
  const [widthCm, setWidthCm] = useState(currentArea?.width || 0)
  const [area, setArea] = useState(0)

  useEffect(() => {
    // Convert feet to cm when feet values change
    const lengthInCm = lengthFeet * 30.48
    const widthInCm = widthFeet * 30.48
    setLengthCm(lengthInCm)
    setWidthCm(widthInCm)
    
    // Calculate area in square feet (primary unit for storage)
    const areaInSqFt = lengthFeet * widthFeet
    setArea(areaInSqFt)
  }, [lengthFeet, widthFeet])

  const handleSave = () => {
    // Save dimensions in cm
    onSave({
      length: lengthCm,
      width: widthCm,
      area
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Product Area - {productName}</DialogTitle>
          <p className="text-sm text-gray-500">SKU: {productSku}</p>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="length">Length (feet)</Label>
              <Input
                id="length"
                type="number"
                step="0.1"
                value={lengthFeet}
                onChange={(e) => setLengthFeet(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 1.5"
              />
            </div>
            <div>
              <Label htmlFor="width">Width (feet)</Label>
              <Input
                id="width"
                type="number"
                step="0.1"
                value={widthFeet}
                onChange={(e) => setWidthFeet(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 1.0"
              />
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm font-medium">Calculated Area:</p>
            <p className="text-lg font-bold">{area.toFixed(2)} ft²</p>
            <p className="text-sm text-gray-600">{(area * 0.092903).toFixed(4)} m²</p>
            <p className="text-sm text-gray-600">{(lengthCm * widthCm).toFixed(0)} cm²</p>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm font-medium">Converted to Metric:</p>
            <p className="text-sm text-gray-600">
              {lengthCm.toFixed(1)} cm × {widthCm.toFixed(1)} cm
            </p>
          </div>
          
          <div className="text-xs text-gray-500">
            <p>This is the area of the actual product material (e.g., plastic wrap sheet).</p>
            <p>Area is stored in square feet (ft²) for weight calculations.</p>
            <p>Weight formula: Area (ft²) × Thickness (micron) × Density × Pack Size</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Area
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}