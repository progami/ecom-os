'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getAllTenants, TenantConfig } from '@/lib/tenant/constants'

interface WorldMapProps {
  className?: string
}

export function WorldMap({ className }: WorldMapProps) {
  const router = useRouter()
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tenants = getAllTenants()

  const handleSelectTenant = async (tenant: TenantConfig) => {
    setSelecting(tenant.code)
    setError(null)

    try {
      const response = await fetch('/api/tenant/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: tenant.code }),
      })

      if (!response.ok) {
        throw new Error('Failed to select region')
      }

      // Navigate to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select region')
      setSelecting(null)
    }
  }

  return (
    <div className={cn('relative min-h-screen bg-slate-950 overflow-hidden', className)}>
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Warehouse Management
          </h1>
          <p className="text-xl text-slate-400">
            Select your region to continue
          </p>
        </div>

        {/* World visualization with regions */}
        <div className="relative w-full max-w-5xl">
          {/* Simplified world map SVG */}
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-auto opacity-20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* North America */}
            <path
              d="M150 120 Q200 100 250 110 Q300 105 320 130 Q340 150 330 180 Q320 210 280 230 Q240 250 200 240 Q160 230 140 200 Q120 170 130 140 Q140 120 150 120Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* South America */}
            <path
              d="M250 280 Q280 270 300 290 Q320 320 310 360 Q300 400 270 420 Q240 430 220 400 Q200 370 210 330 Q220 290 250 280Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Europe */}
            <path
              d="M450 100 Q500 90 540 100 Q580 110 590 140 Q600 170 580 190 Q560 210 520 210 Q480 210 460 190 Q440 170 440 140 Q440 110 450 100Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Africa */}
            <path
              d="M480 220 Q520 210 550 230 Q580 250 590 300 Q600 350 570 390 Q540 420 500 410 Q460 400 450 360 Q440 320 450 280 Q460 240 480 220Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Asia */}
            <path
              d="M600 80 Q700 70 780 90 Q860 110 900 160 Q920 200 890 240 Q860 280 800 290 Q740 300 680 280 Q620 260 590 220 Q560 180 570 130 Q580 90 600 80Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Australia */}
            <path
              d="M800 340 Q850 330 880 350 Q910 370 900 400 Q890 430 850 440 Q810 450 780 430 Q750 410 760 380 Q770 350 800 340Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
          </svg>

          {/* Region dots */}
          {tenants.map((tenant) => {
            // Convert coordinates to SVG viewBox positions
            const x = tenant.code === 'US' ? 200 : 500
            const y = tenant.code === 'US' ? 160 : 140

            return (
              <button
                key={tenant.code}
                onClick={() => handleSelectTenant(tenant)}
                disabled={selecting !== null}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{
                  left: `${(x / 1000) * 100}%`,
                  top: `${(y / 500) * 100}%`,
                }}
              >
                {/* Pulse rings */}
                <span
                  className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ backgroundColor: tenant.color }}
                />
                <span
                  className="absolute inset-0 scale-150 rounded-full animate-ping opacity-20"
                  style={{ backgroundColor: tenant.color, animationDelay: '0.5s' }}
                />

                {/* Main dot */}
                <span
                  className={cn(
                    'relative flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300',
                    'group-hover:scale-125',
                    selecting === tenant.code && 'animate-pulse'
                  )}
                  style={{ backgroundColor: tenant.color }}
                >
                  <span className="h-3 w-3 rounded-full bg-white/80" />
                </span>

                {/* Label */}
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {tenant.displayName}
                </span>
              </button>
            )
          })}
        </div>

        {/* Region cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          {tenants.map((tenant) => (
            <button
              key={tenant.code}
              onClick={() => handleSelectTenant(tenant)}
              disabled={selecting !== null}
              className={cn(
                'group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300',
                'bg-slate-900/50 border border-slate-800',
                'hover:bg-slate-900 hover:border-slate-700 hover:shadow-2xl hover:shadow-slate-900/50',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950',
                selecting === tenant.code && 'ring-2',
                selecting !== null && selecting !== tenant.code && 'opacity-50'
              )}
              style={{
                ['--ring-color' as string]: tenant.color,
              }}
            >
              {/* Gradient accent */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                style={{
                  background: `linear-gradient(135deg, ${tenant.color} 0%, transparent 60%)`,
                }}
              />

              <div className="relative">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">{tenant.flag}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {tenant.displayName}
                    </h3>
                    <p className="text-sm text-slate-400">{tenant.name}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{tenant.timezone}</span>
                  <span
                    className="flex items-center gap-2 font-medium transition-colors group-hover:text-white"
                    style={{ color: selecting === tenant.code ? tenant.color : undefined }}
                  >
                    {selecting === tenant.code ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      <>
                        Enter
                        <svg
                          className="w-4 h-4 transition-transform group-hover:translate-x-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <p className="mt-16 text-sm text-slate-600">
          Each region operates as an independent warehouse system
        </p>
      </div>
    </div>
  )
}
