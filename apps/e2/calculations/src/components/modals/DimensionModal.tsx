'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dimensions: { length: number; width: number; height: number }) => void;
  initialDimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  productName?: string;
}

export function DimensionModal({
  isOpen,
  onClose,
  onSave,
  initialDimensions = {},
  productName = 'Product'
}: DimensionModalProps) {
  const [length, setLength] = useState<string>(initialDimensions.length?.toString() || '');
  const [width, setWidth] = useState<string>(initialDimensions.width?.toString() || '');
  const [height, setHeight] = useState<string>(initialDimensions.height?.toString() || '');
  const [cbm, setCbm] = useState<number>(0);

  // Calculate CBM whenever dimensions change
  useEffect(() => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    
    // Calculate CBM (convert cm to m: divide by 100)
    const calculatedCbm = (l * w * h) / 1000000; // cm³ to m³
    setCbm(calculatedCbm);
  }, [length, width, height]);

  const handleSave = () => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    
    if (l > 0 && w > 0 && h > 0) {
      onSave({ length: l, width: w, height: h });
      onClose();
    }
  };

  const isValid = length && width && height && 
                  parseFloat(length) > 0 && 
                  parseFloat(width) > 0 && 
                  parseFloat(height) > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] z-[9999]">
        <DialogHeader>
          <DialogTitle>Enter Package Dimensions</DialogTitle>
          <DialogDescription>
            Enter the package dimensions for {productName} in centimeters (cm)
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="length" className="text-right">
              Length (cm)
            </Label>
            <Input
              id="length"
              type="number"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="col-span-3"
              placeholder="First side"
              step="0.01"
              min="0"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="width" className="text-right">
              Width (cm)
            </Label>
            <Input
              id="width"
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="col-span-3"
              placeholder="Second side"
              step="0.01"
              min="0"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="height" className="text-right">
              Height (cm)
            </Label>
            <Input
              id="height"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="col-span-3"
              placeholder="Third side"
              step="0.01"
              min="0"
            />
          </div>
          
          {isValid && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <div className="text-sm text-gray-600">
                <strong>Calculated CBM per unit:</strong> {cbm.toFixed(6)} m³
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Formula: ({length} × {width} × {height}) ÷ 1,000,000
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSave}
            disabled={!isValid}
          >
            Save Dimensions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}