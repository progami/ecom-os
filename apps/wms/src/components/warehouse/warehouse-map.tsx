'use client'

import { MapPin } from '@/lib/lucide-icons'

interface Warehouse {
  id: string
  code: string
  name: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface WarehouseMapProps {
  warehouses: Warehouse[]
  selectedWarehouseId?: string
  height?: string
}

export function WarehouseMap({ 
  warehouses, 
  selectedWarehouseId,
  height = '400px' 
}: WarehouseMapProps) {
  // Google Maps implementation temporarily disabled - needs @types/google.maps
  return (
    <div 
      className="bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center" 
      style={{ height }}
    >
      <div className="text-center">
        <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Map view temporarily unavailable</p>
        <div className="mt-4 space-y-1">
          {warehouses.map(warehouse => (
            <div 
              key={warehouse.id} 
              className={`text-sm ${warehouse.id === selectedWarehouseId ? 'font-medium text-primary' : 'text-gray-600'}`}
            >
              {warehouse.name} - {warehouse.address || 'No address'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}