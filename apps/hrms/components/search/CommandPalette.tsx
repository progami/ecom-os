'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApiBase } from '@/lib/api-client'

type SearchResult = {
  type: 'EMPLOYEE' | 'CASE' | 'REVIEW' | 'TASK' | 'POLICY'
  id: string
  title: string
  subtitle?: string
  href: string
}

function groupLabel(type: SearchResult['type']): string {
  switch (type) {
    case 'EMPLOYEE':
      return 'Employees'
    case 'CASE':
      return 'Cases'
    case 'REVIEW':
      return 'Performance reviews'
    case 'TASK':
      return 'Tasks'
    case 'POLICY':
      return 'Policies'
    default:
      return type
  }
}

function typeBadge(type: SearchResult['type']): string {
  switch (type) {
    case 'EMPLOYEE':
      return 'EMP'
    case 'CASE':
      return 'CASE'
    case 'REVIEW':
      return 'REV'
    case 'TASK':
      return 'TASK'
    case 'POLICY':
      return 'POL'
    default:
      return type
  }
}

export function CommandPalette() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cacheRef = useRef<Map<string, SearchResult[]>>(new Map())

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const groups = new Map<SearchResult['type'], SearchResult[]>()
    for (const r of results) {
      const list = groups.get(r.type) ?? []
      list.push(r)
      groups.set(r.type, list)
    }

    const order: SearchResult['type'][] = ['EMPLOYEE', 'CASE', 'TASK', 'REVIEW', 'POLICY']
    return order
      .map((t) => ({ type: t, items: groups.get(t) ?? [] }))
      .filter((g) => g.items.length > 0)
  }, [results])

  const flatResults = useMemo(() => results, [results])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setSelectedIdx(0)
    setError(null)
  }, [])

  const openPalette = useCallback(() => {
    setOpen(true)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === 'k'
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault()
        if (open) {
          close()
        } else {
          openPalette()
        }
      }

      if (!open) return

      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((idx) => Math.min(flatResults.length - 1, idx + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((idx) => Math.max(0, idx - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatResults[selectedIdx]
        if (!item) return
        router.push(item.href)
        close()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, flatResults, open, openPalette, router, selectedIdx])

  useEffect(() => {
    if (!open) return

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSelectedIdx(0)
      setLoading(false)
      setError(null)
      return
    }

    const cached = cacheRef.current.get(trimmed)
    if (cached) {
      setResults(cached)
      setSelectedIdx(0)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)
        const base = getApiBase().replace(/\/$/, '')
        const res = await fetch(`${base}/api/search?q=${encodeURIComponent(trimmed)}`, {
          headers: { Accept: 'application/json' },
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(payload?.error || payload?.message || `${res.status} ${res.statusText}`)
        }
        const next = (payload?.results ?? []) as SearchResult[]
        if (cancelled) return
        cacheRef.current.set(trimmed, next)
        setResults(next)
        setSelectedIdx(0)
      } catch (e) {
        if (cancelled) return
        setResults([])
        setSelectedIdx(0)
        setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 320)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={close}
        role="button"
        tabIndex={-1}
        aria-label="Close search"
      />

      <div className="absolute left-1/2 top-24 w-[min(720px,calc(100%-2rem))] -translate-x-1/2">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">Search</div>
                <div className="text-xs text-gray-500">Type to search employees, cases, tasks, reviews, and policies.</div>
              </div>
              <div className="text-xs text-gray-500 shrink-0">Esc to close</div>
            </div>

            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="mt-3 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-4 text-sm text-gray-600">Searching…</div>
            ) : error ? (
              <div className="px-4 py-4 text-sm text-red-700">{error}</div>
            ) : query.trim().length < 2 ? (
              <div className="px-4 py-4 text-sm text-gray-600">Type at least 2 characters.</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-600">No results.</div>
            ) : (
              <div className="py-2">
                {grouped.map((g) => (
                  <div key={g.type} className="px-2">
                    <div className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {groupLabel(g.type)}
                    </div>
                    <div className="space-y-1">
                      {g.items.map((r) => {
                        const idx = flatResults.findIndex((x) => x.type === r.type && x.id === r.id)
                        const selected = idx === selectedIdx
                        return (
                          <button
                            key={`${r.type}:${r.id}`}
                            className={
                              selected
                                ? 'w-full text-left rounded-xl bg-blue-50 border border-blue-100 px-3 py-2'
                                : 'w-full text-left rounded-xl hover:bg-gray-50 px-3 py-2'
                            }
                            onMouseEnter={() => setSelectedIdx(idx)}
                            onClick={() => {
                              router.push(r.href)
                              close()
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                                {r.subtitle ? <div className="text-xs text-gray-600 truncate mt-0.5">{r.subtitle}</div> : null}
                              </div>
                              <span className="text-[10px] font-semibold text-gray-600 rounded-full bg-gray-100 px-2 py-0.5 shrink-0">
                                {typeBadge(r.type)}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between gap-3">
            <div>↑ ↓ to navigate • Enter to open</div>
            <div>Cmd+K / Ctrl+K</div>
          </div>
        </div>
      </div>
    </div>
  )
}
