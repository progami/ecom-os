'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Check, X, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { withAppBasePath } from '@/lib/base-path'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const DEFAULT_STRATEGY_ID = 'default-strategy'

type Strategy = {
  id: string
  name: string
  description: string | null
  region: 'US' | 'UK'
  isDefault: boolean
  createdAt: string
  updatedAt: string
  _count: {
    products: number
    purchaseOrders: number
    salesWeeks: number
  }
}

interface StrategiesWorkspaceProps {
  strategies: Strategy[]
  activeStrategyId?: string | null
}

export function StrategiesWorkspace({ strategies: initialStrategies, activeStrategyId }: StrategiesWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies)
  const [isAdding, setIsAdding] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newRegion, setNewRegion] = useState<'US' | 'UK'>('US')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRegion, setEditRegion] = useState<'US' | 'UK'>('US')

  const selectedStrategyId = activeStrategyId ?? searchParams?.get('strategy') ?? null

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Enter a strategy name')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/strategies'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription, region: newRegion }),
      })
      if (!response.ok) throw new Error('Failed to create strategy')
      const data = await response.json()
      setStrategies((prev) => [...prev, { ...data.strategy, _count: { products: 0, purchaseOrders: 0, salesWeeks: 0 } }])
      setNewName('')
      setNewDescription('')
      setNewRegion('US')
      setIsAdding(false)
      toast.success('Strategy created')
    } catch (error) {
      console.error(error)
      toast.error('Failed to create strategy')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async (id: string) => {
    const strategy = strategies.find((s) => s.id === id)
    if (id === DEFAULT_STRATEGY_ID || strategy?.isDefault) {
      toast.error('Default strategy cannot be edited')
      return
    }

    if (!editName.trim()) {
      toast.error('Enter a strategy name')
      return
    }

    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/strategies'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName, description: editDescription, region: editRegion }),
      })
      if (!response.ok) throw new Error('Failed to update strategy')
      setStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: editName, description: editDescription, region: editRegion } : s))
      )
      setEditingId(null)
      toast.success('Strategy updated')
    } catch (error) {
      console.error(error)
      toast.error('Failed to update strategy')
    }
  }

  const handleDelete = async (id: string) => {
    const strategy = strategies.find((item) => item.id === id)
    if (!strategy) return

    if (id === DEFAULT_STRATEGY_ID || strategy.isDefault) {
      toast.error('Cannot delete the default strategy for existing data')
      return
    }

    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/strategies'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) throw new Error('Failed to delete strategy')
      setStrategies((prev) => prev.filter((s) => s.id !== id))
      toast.success('Strategy deleted')
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete strategy')
    }
  }

  const handleSelectStrategy = (id: string, name: string) => {
    if (id === selectedStrategyId) return
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '')
    nextParams.set('strategy', id)
    router.push(`?${nextParams.toString()}`)
    toast.success(`Switched to "${name}"`)
  }

  const startEdit = (strategy: Strategy) => {
    if (strategy.id === DEFAULT_STRATEGY_ID || strategy.isDefault) {
      toast.error('Default strategy cannot be edited')
      return
    }
    setEditingId(strategy.id)
    setEditName(strategy.name)
    setEditDescription(strategy.description ?? '')
    setEditRegion(strategy.region ?? 'US')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
    setEditRegion('US')
  }

  const primaryActionClass =
    'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:focus:ring-cyan-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10'

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
            Planning Strategies
          </h2>
          <p className="text-sm text-muted-foreground">
            Click a row to switch strategies. Each strategy has its own products, orders, and forecasts.
          </p>
        </div>
        {!isAdding ? (
          <button type="button" onClick={() => setIsAdding(true)} className={primaryActionClass}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              New strategy
            </span>
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm dark:border-white/10">
        <div className="max-h-[440px] overflow-auto">
          <Table className="table-fixed border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky top-0 z-10 h-10 border-b border-r bg-muted px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 last:border-r-0 dark:text-cyan-300/80">
                  Strategy
                </TableHead>
                <TableHead className="sticky top-0 z-10 h-10 w-28 border-b border-r bg-muted px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 last:border-r-0 dark:text-cyan-300/80">
                  Products
                </TableHead>
                <TableHead className="sticky top-0 z-10 h-10 w-28 border-b border-r bg-muted px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 last:border-r-0 dark:text-cyan-300/80">
                  Orders
                </TableHead>
                <TableHead className="sticky top-0 z-10 h-10 w-32 border-b border-r bg-muted px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 last:border-r-0 dark:text-cyan-300/80">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdding ? (
                <TableRow className="bg-cyan-50/70 hover:bg-cyan-50/70 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/20">
                  <TableCell className="border-r px-4 py-3 align-top">
                    <div className="space-y-2">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Strategy name (e.g., Q4 2025 Planning)"
                        autoFocus
                        className="h-8"
                      />
                      <Input
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Description (optional)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleCreate()
                          if (e.key === 'Escape') setIsAdding(false)
                        }}
                        className="h-8"
                      />
                      <select
                        value={newRegion}
                        onChange={(e) => setNewRegion(e.target.value === 'UK' ? 'UK' : 'US')}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="US">US (week starts Sunday)</option>
                        <option value="UK">UK (week starts Monday)</option>
                      </select>
                    </div>
                  </TableCell>
                  <TableCell className="border-r px-4 py-3 text-center text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="border-r px-4 py-3 text-center text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => void handleCreate()}
                        disabled={isCreating}
                        className="rounded p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAdding(false)}
                        disabled={isCreating}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {strategies.length === 0 && !isAdding ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                    No strategies yet. Create your first planning strategy to get started.
                  </TableCell>
                </TableRow>
              ) : (
                strategies.map((strategy) => {
                  const isActive = selectedStrategyId === strategy.id
                  const isEditing = editingId === strategy.id

                  return (
                    <TableRow
                      key={strategy.id}
                      onClick={() => !isEditing && handleSelectStrategy(strategy.id, strategy.name)}
                      className={cn(
                        'cursor-pointer',
                        isActive
                          ? 'border-l-4 border-l-cyan-500 bg-cyan-50/70 hover:bg-cyan-50/70 dark:border-l-[#00C2B9] dark:bg-cyan-900/20 dark:hover:bg-cyan-900/20'
                          : 'hover:bg-muted/50',
                      )}
                    >
                      <TableCell className="border-r px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                            <Input
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Description"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleUpdate(strategy.id)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              className="h-8"
                            />
                            <select
                              value={editRegion}
                              onChange={(e) => setEditRegion(e.target.value === 'UK' ? 'UK' : 'US')}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="US">US (Sun)</option>
                              <option value="UK">UK (Mon)</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            {isActive ? (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-600 dark:text-[#00C2B9]" />
                            ) : null}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    'text-sm font-medium',
                                    isActive ? 'text-cyan-900 dark:text-cyan-100' : 'text-foreground',
                                  )}
                                >
                                  {strategy.name}
                                </span>
                                <Badge variant="secondary" className="uppercase">
                                  {strategy.region}
                                </Badge>
                                {isActive ? (
                                  <Badge className="bg-cyan-600 text-white hover:bg-cyan-600 dark:bg-[#00C2B9] dark:text-slate-900 dark:hover:bg-[#00C2B9]">
                                    Active
                                  </Badge>
                                ) : null}
                                {strategy.isDefault ? <Badge variant="outline">Default</Badge> : null}
                              </div>
                              {strategy.description ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{strategy.description}</p>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="border-r px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-sm tabular-nums',
                            isActive ? 'font-semibold text-cyan-700 dark:text-cyan-300' : 'text-muted-foreground',
                          )}
                        >
                          {strategy._count.products}
                        </span>
                      </TableCell>
                      <TableCell className="border-r px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-sm tabular-nums',
                            isActive ? 'font-semibold text-cyan-700 dark:text-cyan-300' : 'text-muted-foreground',
                          )}
                        >
                          {strategy._count.purchaseOrders}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleUpdate(strategy.id)}
                                className="rounded p-1.5 text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded p-1.5 text-muted-foreground transition hover:bg-muted"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(strategy)}
                                className="rounded p-1.5 text-muted-foreground transition hover:bg-muted"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {!strategy.isDefault && strategy.id !== DEFAULT_STRATEGY_ID ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(strategy.id)}
                                  className="rounded p-1.5 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
