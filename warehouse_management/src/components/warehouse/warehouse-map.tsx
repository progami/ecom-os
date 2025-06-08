'use client'

import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'

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
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    // Load Google Maps script if not already loaded
    if (!window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = initializeMap
      document.head.appendChild(script)
    } else {
      initializeMap()
    }

    function initializeMap() {
      if (!mapRef.current) return

      // Create map centered on UK
      const map = new google.maps.Map(mapRef.current, {
        zoom: 6,
        center: { lat: 52.5, lng: -1.5 }, // Center of UK
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      })

      mapInstanceRef.current = map

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []

      // Add markers for each warehouse
      const bounds = new google.maps.LatLngBounds()
      let hasValidCoordinates = false

      warehouses.forEach(warehouse => {
        if (warehouse.latitude && warehouse.longitude) {
          hasValidCoordinates = true
          const position = { lat: warehouse.latitude, lng: warehouse.longitude }
          
          const marker = new google.maps.Marker({
            position,
            map,
            title: warehouse.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: warehouse.id === selectedWarehouseId ? '#3B82F6' : '#EF4444',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            },
          })

          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px;">
                <h3 style="margin: 0 0 4px 0; font-weight: bold;">${warehouse.name}</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">Code: ${warehouse.code}</p>
                ${warehouse.address ? `<p style="margin: 4px 0 0 0; font-size: 13px;">${warehouse.address}</p>` : ''}
                <a href="https://www.google.com/maps?q=${warehouse.latitude},${warehouse.longitude}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   style="color: #3B82F6; text-decoration: none; font-size: 13px;">
                  View on Google Maps →
                </a>
              </div>
            `
          })

          marker.addListener('click', () => {
            infoWindow.open(map, marker)
          })

          markersRef.current.push(marker)
          bounds.extend(position)
        }
      })

      // Fit map to show all markers
      if (hasValidCoordinates) {
        map.fitBounds(bounds)
        // Don't zoom in too much for single marker
        if (warehouses.filter(w => w.latitude && w.longitude).length === 1) {
          map.setZoom(12)
        }
      }
    }

    return () => {
      // Cleanup markers
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
    }
  }, [warehouses, selectedWarehouseId])

  // Fallback if no coordinates
  const warehousesWithCoords = warehouses.filter(w => w.latitude && w.longitude)
  
  if (warehousesWithCoords.length === 0) {
    return (
      <div 
        className="bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No warehouse locations available</p>
          <p className="text-sm text-gray-400 mt-1">Add coordinates to see warehouses on map</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={mapRef} 
      className="w-full rounded-lg border border-gray-200"
      style={{ height }}
    />
  )
}