'use client'

import clsx from 'clsx'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Check, X, Pencil, Trash2, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { withAppBasePath } from '@/lib/base-path'

type Strategy = {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
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
}

export function StrategiesWorkspace({ strategies: initialStrategies }: StrategiesWorkspaceProps) {
  const router = useRouter()
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies)
  const [isAdding, setIsAdding] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

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
        body: JSON.stringify({ name: newName, description: newDescription }),
      })
      if (!response.ok) throw new Error('Failed to create strategy')
      const data = await response.json()
      setStrategies((prev) => [...prev, { ...data.strategy, _count: { products: 0, purchaseOrders: 0, salesWeeks: 0 } }])
      setNewName('')
      setNewDescription('')
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
    if (!editName.trim()) {
      toast.error('Enter a strategy name')
      return
    }

    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/strategies'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName, description: editDescription }),
      })
      if (!response.ok) throw new Error('Failed to update strategy')
      setStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: editName, description: editDescription } : s))
      )
      setEditingId(null)
      toast.success('Strategy updated')
    } catch (error) {
      console.error(error)
      toast.error('Failed to update strategy')
    }
  }

  const handleDelete = async (id: string) => {
    const strategy = strategies.find((s) => s.id === id)
    if (strategy?.isDefault) {
      toast.error('Cannot delete the default strategy')
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

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/strategies'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true }),
      })
      if (!response.ok) throw new Error('Failed to set default strategy')
      setStrategies((prev) =>
        prev.map((s) => ({ ...s, isDefault: s.id === id }))
      )
      toast.success('Default strategy updated')
    } catch (error) {
      console.error(error)
      toast.error('Failed to set default strategy')
    }
  }

  const handleSelectStrategy = async (id: string) => {
    // Set this strategy as ACTIVE (API will set others to DRAFT)
    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/strategies'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'ACTIVE' }),
      })
      if (!response.ok) throw new Error('Failed to activate strategy')

      // Update local state
      setStrategies((prev) =>
        prev.map((s) => ({ ...s, status: s.id === id ? 'ACTIVE' : 'DRAFT' }))
      )
    } catch (error) {
      console.error(error)
      // Still navigate even if status update fails
    }

    router.push(`/1-product-setup?strategy=${id}`)
  }

  const startEdit = (strategy: Strategy) => {
    setEditingId(strategy.id)
    setEditName(strategy.name)
    setEditDescription(strategy.description ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      case 'ARCHIVED':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Planning Strategies</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Each strategy is an isolated planning session with its own products, orders, and forecasts
          </p>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600"
          >
            <Plus className="h-4 w-4" />
            New Strategy
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#041324]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Strategy
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Products
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Orders
              </th>
              <th className="w-48 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {isAdding && (
              <tr className="bg-cyan-50/50 dark:bg-cyan-900/10">
                <td className="px-4 py-3" colSpan={2}>
                  <div className="space-y-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Strategy name (e.g., Q4 2025 Planning)"
                      autoFocus
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
                    />
                    <input
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Description (optional)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate()
                        if (e.key === 'Escape') setIsAdding(false)
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-sm text-slate-500">-</td>
                <td className="px-4 py-3 text-center text-sm text-slate-500">-</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={isCreating}
                      className="rounded p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      disabled={isCreating}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {strategies.length === 0 && !isAdding ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No strategies yet. Create your first planning strategy to get started.
                  </p>
                </td>
              </tr>
            ) : (
              strategies.map((strategy) => (
                <tr
                  key={strategy.id}
                  className={clsx(
                    'bg-white transition hover:bg-slate-50 dark:bg-transparent dark:hover:bg-white/5',
                    strategy.isDefault && 'bg-cyan-50/30 dark:bg-cyan-950/20'
                  )}
                >
                  <td className="px-4 py-3">
                    {editingId === strategy.id ? (
                      <div className="space-y-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-cyan-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-100 dark:border-cyan-500/50 dark:bg-white/5 dark:text-slate-100"
                        />
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(strategy.id)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          className="w-full rounded border border-cyan-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-100 dark:border-cyan-500/50 dark:bg-white/5 dark:text-slate-100"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectStrategy(strategy.id)}
                        className="group text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 group-hover:text-cyan-600 dark:text-slate-100 dark:group-hover:text-cyan-400">
                            {strategy.name}
                          </span>
                          {strategy.isDefault && (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          )}
                        </div>
                        {strategy.description && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {strategy.description}
                          </p>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        getStatusBadge(strategy.status)
                      )}
                    >
                      {strategy.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {strategy._count.products}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {strategy._count.purchaseOrders}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {editingId === strategy.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdate(strategy.id)}
                            className="rounded p-1.5 text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {!strategy.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(strategy.id)}
                              title="Set as default"
                              className="rounded p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                            >
                              <Star className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(strategy)}
                            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {!strategy.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleDelete(strategy.id)}
                              className="rounded p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
