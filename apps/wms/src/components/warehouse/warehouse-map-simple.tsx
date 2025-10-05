'use client'

import { MapPin, ExternalLink } from '@/lib/lucide-icons'

interface Warehouse {
  id: string
  code: string
  name: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface WarehouseMapSimpleProps {
  warehouses: Warehouse[]
  selectedWarehouseId?: string
}

export function WarehouseMapSimple({ 
  warehouses, 
  selectedWarehouseId
}: WarehouseMapSimpleProps) {
  const warehousesWithCoords = warehouses.filter(w => w.latitude && w.longitude)
  
  if (warehousesWithCoords.length === 0) {
    return (
      <div className="bg-secondary border border-border rounded-lg p-8 text-center">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">No warehouses available</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {warehousesWithCoords.map((warehouse) => (
        <div
          key={warehouse.id}
          className={`border rounded-lg p-4 ${
            warehouse.id === selectedWarehouseId
              ? 'border-cyan-600 bg-cyan-50'
              : 'border-border bg-card'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className={`h-5 w-5 ${
                  warehouse.id === selectedWarehouseId ? 'text-cyan-600' : 'text-foreground'
                }`} />
                <h4 className="font-semibold">{warehouse.name}</h4>
                <span className="text-sm text-muted-foreground">({warehouse.code})</span>
              </div>
              {warehouse.address && (
                <p className="text-sm text-foreground mt-1 ml-7">{warehouse.address}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1 ml-7">
                Coordinates: {warehouse.latitude?.toFixed(4)}, {warehouse.longitude?.toFixed(4)}
              </p>
            </div>
            <a
              href={`https://www.google.com/maps?q=${warehouse.latitude},${warehouse.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700"
            >
              View Map
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}