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
            Targon WMS
          </h1>
          <p className="text-xl text-slate-300">
            Select your region to continue
          </p>
        </div>

        {/* World visualization with regions */}
        <div className="relative w-full max-w-5xl">
          {/* Simplified world map SVG - Miller projection style */}
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-auto opacity-40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* North America */}
            <path
              d="M45 85 L65 75 L85 70 L110 65 L130 60 L155 55 L180 50 L205 48 L230 52 L250 60 L265 70 L275 85 L280 100 L275 115 L265 130 L250 145 L235 160 L220 175 L205 185 L190 190 L175 188 L160 182 L145 175 L130 170 L115 168 L100 172 L85 180 L70 190 L55 200 L45 210 L40 195 L38 175 L40 155 L45 135 L48 115 L45 100 L45 85Z M280 155 L295 150 L310 148 L320 155 L318 170 L305 185 L290 195 L275 200 L260 198 L250 190 L255 175 L265 162 L280 155Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Greenland */}
            <path
              d="M310 45 L340 40 L370 42 L390 50 L400 65 L395 80 L380 92 L360 98 L340 95 L320 88 L310 75 L308 60 L310 45Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* South America */}
            <path
              d="M220 245 L240 240 L260 242 L280 250 L295 265 L305 285 L310 310 L308 340 L300 370 L285 395 L265 415 L245 430 L225 438 L210 435 L200 420 L195 395 L198 365 L205 335 L210 305 L208 275 L212 255 L220 245Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Europe */}
            <path
              d="M440 65 L460 60 L485 55 L510 52 L530 55 L545 62 L555 72 L560 85 L558 100 L550 112 L535 120 L520 125 L500 130 L480 128 L460 122 L445 115 L435 105 L430 92 L432 78 L440 65Z M430 130 L445 128 L460 132 L470 145 L465 160 L450 168 L435 165 L428 150 L430 130Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* British Isles */}
            <path
              d="M408 85 L420 80 L430 85 L432 98 L425 110 L412 115 L402 110 L398 98 L402 88 L408 85Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Africa */}
            <path
              d="M430 175 L460 168 L490 165 L520 168 L550 178 L575 195 L590 220 L598 250 L600 285 L595 320 L582 355 L560 385 L530 405 L495 415 L460 412 L430 400 L410 378 L400 350 L398 315 L405 280 L415 248 L420 215 L425 190 L430 175Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Middle East */}
            <path
              d="M560 140 L590 135 L620 138 L645 150 L658 168 L660 190 L650 210 L630 222 L605 228 L580 225 L560 215 L550 198 L548 178 L552 158 L560 140Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Russia/Northern Asia */}
            <path
              d="M560 50 L600 42 L650 38 L700 35 L750 38 L800 45 L850 55 L890 68 L920 85 L940 105 L950 125 L945 145 L930 160 L905 170 L875 175 L840 172 L800 165 L760 155 L720 148 L680 145 L640 148 L600 155 L570 165 L550 160 L545 140 L548 115 L555 90 L560 70 L560 50Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* India */}
            <path
              d="M665 195 L695 188 L720 195 L738 215 L745 240 L740 270 L725 295 L702 310 L678 305 L660 285 L655 258 L658 230 L662 210 L665 195Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* China/East Asia */}
            <path
              d="M720 125 L760 118 L800 115 L840 120 L875 130 L900 148 L912 170 L908 195 L892 218 L865 235 L830 245 L790 248 L750 242 L715 230 L690 212 L680 188 L685 165 L700 145 L720 125Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Southeast Asia */}
            <path
              d="M780 265 L810 258 L840 262 L862 275 L870 295 L865 318 L850 335 L825 345 L798 342 L775 328 L765 308 L770 285 L780 265Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Japan */}
            <path
              d="M905 145 L925 140 L940 148 L948 165 L945 185 L932 200 L915 205 L900 198 L892 180 L895 162 L905 145Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Indonesia */}
            <path
              d="M795 360 L830 355 L865 358 L895 368 L912 385 L905 402 L882 412 L850 415 L815 410 L785 398 L772 380 L780 365 L795 360Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Australia */}
            <path
              d="M825 405 L870 395 L915 398 L955 410 L978 430 L985 455 L975 478 L952 495 L920 502 L882 498 L848 488 L822 470 L810 448 L812 425 L825 405Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* New Zealand */}
            <path
              d="M965 475 L980 470 L992 478 L995 492 L988 505 L975 510 L962 505 L958 492 L962 480 L965 475Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1"
            />
          </svg>

          {/* Region dots */}
          {tenants.map((tenant) => {
            // Position dots on actual continent locations
            const x = tenant.code === 'US' ? 180 : 415
            const y = tenant.code === 'US' ? 130 : 95

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
        <p className="mt-16 text-sm text-slate-400">
          Each region operates as an independent warehouse system
        </p>
      </div>
    </div>
  )
}
