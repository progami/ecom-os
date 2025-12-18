'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getAllTenants, TenantConfig } from '@/lib/tenant/constants'

interface WorldMapProps {
  className?: string
}

// Simplified world map SVG paths - clean minimal style
const WorldMapSVG = () => (
  <svg
    viewBox="0 0 1000 500"
    className="w-full h-full"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#334155" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#1e293b" stopOpacity="0.4" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* North America */}
    <path
      d="M 130 120
         C 140 100, 180 80, 220 75
         C 260 70, 280 85, 290 95
         C 300 90, 320 85, 340 90
         C 350 85, 360 80, 365 85
         L 370 100 L 365 115 L 355 120
         C 350 130, 340 140, 330 145
         L 320 160 L 300 170 L 280 175
         C 260 180, 240 190, 230 200
         L 220 215 L 200 220 L 180 225
         C 170 230, 155 235, 145 230
         L 135 220 L 125 200 L 120 180
         C 115 160, 120 140, 130 120 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="1"
      opacity="0.8"
    />

    {/* South America */}
    <path
      d="M 230 250
         C 245 245, 260 250, 275 260
         L 285 280 L 290 310 L 285 340
         C 280 360, 275 380, 265 400
         L 255 420 L 240 430 L 225 425
         C 215 415, 210 400, 215 380
         L 220 350 L 218 320 L 220 290
         C 222 270, 225 255, 230 250 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="1"
      opacity="0.8"
    />

    {/* Europe */}
    <path
      d="M 440 100
         C 450 95, 470 90, 490 95
         L 510 100 L 530 105 L 545 115
         C 550 120, 555 130, 550 140
         L 540 150 L 520 155 L 500 160
         C 480 165, 460 160, 450 155
         L 440 145 L 435 130 L 438 115
         C 438 108, 440 102, 440 100 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="1"
      opacity="0.8"
    />

    {/* Africa */}
    <path
      d="M 460 180
         C 480 175, 510 180, 530 190
         L 550 210 L 560 240 L 555 280
         C 550 310, 540 340, 520 365
         L 500 380 L 475 375 L 455 360
         C 440 340, 435 310, 440 280
         L 445 250 L 450 220 L 455 195
         C 457 187, 458 182, 460 180 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="1"
      opacity="0.8"
    />

    {/* Asia */}
    <path
      d="M 560 90
         C 600 85, 650 80, 700 85
         L 750 95 L 800 110 L 840 130
         C 860 145, 870 165, 865 190
         L 850 220 L 820 240 L 780 250
         C 740 255, 700 250, 660 240
         L 620 225 L 590 200 L 570 170
         C 555 145, 555 115, 560 90 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="1"
      opacity="0.8"
    />

    {/* Australia */}
    <path
      d="M 780 320
         C 810 315, 840 320, 860 335
         L 875 355 L 880 380 L 870 400
         C 855 415, 830 420, 805 415
         L 780 405 L 765 385 L 760 360
         C 760 340, 770 325, 780 320 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="1"
      opacity="0.8"
    />

    {/* Greenland */}
    <path
      d="M 320 50
         C 340 45, 365 50, 380 60
         L 390 75 L 385 90 L 370 100
         C 355 105, 335 100, 325 90
         L 315 75 L 318 60 L 320 50 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="1"
      opacity="0.7"
    />

    {/* UK/Ireland detail */}
    <path
      d="M 430 115
         C 435 112, 442 115, 445 120
         L 446 128 L 442 134 L 435 132
         C 430 130, 428 124, 430 115 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="0.5"
      opacity="0.9"
    />

    {/* Japan */}
    <path
      d="M 870 145
         C 878 140, 888 145, 892 155
         L 890 170 L 882 180 L 872 175
         C 865 168, 865 155, 870 145 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="0.5"
      opacity="0.8"
    />

    {/* Indonesia/SE Asia islands */}
    <path
      d="M 800 270 L 820 275 L 840 280 L 830 290 L 810 285 L 800 270 Z"
      fill="url(#mapGradient)"
      stroke="#475569"
      strokeWidth="0.5"
      opacity="0.7"
    />
  </svg>
)

// Marker positions on the map (percentages)
const MARKER_POSITIONS: Record<string, { x: number; y: number }> = {
  US: { x: 18, y: 35 }, // US West Coast (LA area)
  UK: { x: 44, y: 24 }, // UK/Europe
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
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_50%,#000_40%,transparent_100%)]" />

      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Targon WMS
          </h1>
          <p className="text-xl text-slate-400">
            Select your region to continue
          </p>
        </div>

        {/* World Map with Markers */}
        <div className="relative w-full max-w-5xl aspect-[2/1]">
          {/* The actual world map */}
          <div className="absolute inset-0">
            <WorldMapSVG />
          </div>

          {/* Connection line between markers */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <path
              d={`M ${MARKER_POSITIONS.US.x} ${MARKER_POSITIONS.US.y} Q 32 ${MARKER_POSITIONS.US.y - 8} ${MARKER_POSITIONS.UK.x} ${MARKER_POSITIONS.UK.y}`}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="0.3"
              strokeDasharray="1 0.5"
              className="animate-pulse"
            />
            {/* Animated dot along path */}
            <circle r="0.5" fill="#60A5FA">
              <animateMotion dur="4s" repeatCount="indefinite">
                <mpath href="#connectionLine" />
              </animateMotion>
            </circle>
            <path
              id="connectionLine"
              d={`M ${MARKER_POSITIONS.US.x} ${MARKER_POSITIONS.US.y} Q 32 ${MARKER_POSITIONS.US.y - 8} ${MARKER_POSITIONS.UK.x} ${MARKER_POSITIONS.UK.y}`}
              fill="none"
            />
          </svg>

          {/* Region markers */}
          {tenants.map((tenant) => {
            const pos = MARKER_POSITIONS[tenant.code]
            if (!pos) return null

            return (
              <button
                key={tenant.code}
                onClick={() => handleSelectTenant(tenant)}
                disabled={selecting !== null}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                {/* Pulse rings */}
                <span
                  className="absolute inset-0 w-16 h-16 -m-4 rounded-full animate-ping opacity-20"
                  style={{ backgroundColor: tenant.color }}
                />
                <span
                  className="absolute inset-0 w-12 h-12 -m-2 rounded-full animate-ping opacity-30"
                  style={{ backgroundColor: tenant.color, animationDelay: '0.5s' }}
                />

                {/* Main marker */}
                <div
                  className={cn(
                    'relative w-12 h-12 rounded-full flex items-center justify-center',
                    'transition-all duration-300 group-hover:scale-125',
                    'border-2',
                    selecting === tenant.code && 'animate-pulse scale-125'
                  )}
                  style={{
                    backgroundColor: `${tenant.color}30`,
                    borderColor: tenant.color,
                    boxShadow: `0 0 30px ${tenant.color}50`,
                  }}
                >
                  <span className="text-2xl">{tenant.flag}</span>
                </div>

                {/* Label */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap text-center">
                  <div className="text-sm font-semibold text-white">{tenant.displayName}</div>
                  <div className="text-xs text-slate-400">{tenant.timezone.replace('_', ' ')}</div>
                </div>

                {/* Hover tooltip */}
                <div
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                    'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                  )}
                  style={{ backgroundColor: tenant.color, color: 'white' }}
                >
                  {selecting === tenant.code ? 'Connecting...' : 'Click to select'}
                </div>
              </button>
            )
          })}
        </div>

        {/* Region cards */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
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

                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{tenant.timezone.replace('_', ' ')}</span>
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
        <p className="mt-12 text-sm text-slate-500">
          Each region operates as an independent warehouse system
        </p>
      </div>
    </div>
  )
}
