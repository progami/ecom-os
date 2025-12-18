'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { TenantConfig, TenantCode, TENANTS, getAllTenants } from '@/lib/tenant/constants'
import { ChevronDown, Globe } from '@/lib/lucide-icons'

interface TenantIndicatorProps {
  className?: string
  collapsed?: boolean
}

export function TenantIndicator({ className, collapsed }: TenantIndicatorProps) {
  const router = useRouter()
  const [current, setCurrent] = useState<TenantConfig | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tenants = getAllTenants()

  useEffect(() => {
    // Fetch current tenant on mount
    fetch('/api/tenant/current')
      .then((res) => res.json())
      .then((data) => {
        if (data.current) {
          setCurrent(TENANTS[data.current as TenantCode])
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitch = async (tenant: TenantConfig) => {
    if (tenant.code === current?.code) {
      setIsOpen(false)
      return
    }

    setSwitching(true)
    try {
      const response = await fetch('/api/tenant/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: tenant.code }),
      })

      if (!response.ok) {
        throw new Error('Failed to switch region')
      }

      setCurrent(tenant)
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to switch tenant:', error)
    } finally {
      setSwitching(false)
    }
  }

  if (!current) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 text-slate-400', className)}>
        <Globe className="h-4 w-4 animate-pulse" />
        {!collapsed && <span className="text-sm">Loading...</span>}
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-200',
          'hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/20',
          isOpen && 'bg-slate-100'
        )}
      >
        <span className="text-lg">{current.flag}</span>
        {!collapsed && (
          <>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-slate-900">{current.displayName}</span>
              <span className="text-xs text-slate-500">{current.timezone}</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Switch Region
          </div>
          {tenants.map((tenant) => (
            <button
              key={tenant.code}
              onClick={() => handleSwitch(tenant)}
              disabled={switching}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                'hover:bg-slate-50 disabled:opacity-50',
                tenant.code === current.code && 'bg-cyan-50'
              )}
            >
              <span className="text-xl">{tenant.flag}</span>
              <div className="flex-1">
                <div className="font-medium text-slate-900">{tenant.displayName}</div>
                <div className="text-xs text-slate-500">{tenant.name}</div>
              </div>
              {tenant.code === current.code && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tenant.color }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
