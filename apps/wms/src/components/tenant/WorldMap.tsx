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

        {/* Region selector - Clean modern design */}
        <div className="relative w-full max-w-4xl">
          {/* Connection visualization */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg className="w-full h-32" viewBox="0 0 800 100" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4"/>
                  <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.4"/>
                </linearGradient>
              </defs>
              <path
                d="M 100 50 Q 400 10 700 50"
                fill="none"
                stroke="url(#connectionGradient)"
                strokeWidth="2"
                strokeDasharray="8 4"
                className="animate-pulse"
              />
              {/* Animated dots along the path */}
              <circle r="4" fill="#3B82F6" opacity="0.6">
                <animateMotion dur="3s" repeatCount="indefinite">
                  <mpath href="#connectionPath" />
                </animateMotion>
              </circle>
              <path id="connectionPath" d="M 100 50 Q 400 10 700 50" fill="none" />
            </svg>
          </div>

          {/* Region markers */}
          <div className="flex justify-between items-center px-8 py-16">
            {tenants.map((tenant) => (
              <button
                key={tenant.code}
                onClick={() => handleSelectTenant(tenant)}
                disabled={selecting !== null}
                className="group relative flex flex-col items-center"
              >
                {/* Pulse rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="absolute w-32 h-32 rounded-full animate-ping opacity-20"
                    style={{ backgroundColor: tenant.color }}
                  />
                  <span
                    className="absolute w-24 h-24 rounded-full animate-ping opacity-30"
                    style={{ backgroundColor: tenant.color, animationDelay: '0.5s' }}
                  />
                </div>

                {/* Main marker */}
                <div
                  className={cn(
                    'relative z-10 w-20 h-20 rounded-full flex items-center justify-center',
                    'transition-all duration-300 group-hover:scale-110',
                    'border-2 border-opacity-50',
                    selecting === tenant.code && 'animate-pulse scale-110'
                  )}
                  style={{
                    backgroundColor: `${tenant.color}20`,
                    borderColor: tenant.color,
                    boxShadow: `0 0 40px ${tenant.color}40`,
                  }}
                >
                  <span className="text-4xl">{tenant.flag}</span>
                </div>

                {/* Label */}
                <div className="mt-4 text-center">
                  <div className="text-lg font-semibold text-white">{tenant.displayName}</div>
                  <div className="text-sm text-slate-400">{tenant.timezone.replace('_', ' ')}</div>
                </div>

                {/* Hover indicator */}
                <div
                  className={cn(
                    'mt-3 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300',
                    'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
                  )}
                  style={{
                    backgroundColor: tenant.color,
                    color: 'white',
                  }}
                >
                  {selecting === tenant.code ? 'Connecting...' : 'Select'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Region cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
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
