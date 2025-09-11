'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Save, 
  FolderOpen, 
  Plus, 
  Trash2, 
  Check,
  Clock,
  Calendar,
  Info,
  Download,
  Upload,
  Copy,
  Play
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Strategy {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function BudgetStrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [currentStrategy, setCurrentStrategy] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [newStrategyDescription, setNewStrategyDescription] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    loadStrategies()
  }, [])

  const loadStrategies = async (skipLoading = false) => {
    if (!skipLoading) setIsInitialLoading(true)
    try {
      const response = await fetch('/api/strategies', {
        cache: 'no-store' // Always get fresh data
      })
      if (response.ok) {
        const data = await response.json()
        setStrategies(data)
        
        // Set active strategy if exists
        const active = data.find((s: Strategy) => s.isActive)
        if (active) {
          setCurrentStrategy(active.id)
        }
      }
    } catch (error) {
      console.error('Error loading strategies:', error)
    } finally {
      if (!skipLoading) setIsInitialLoading(false)
    }
  }

  const saveStrategy = async () => {
    if (!currentStrategy) return
    
    setLoading(true)
    try {
      const strategy = strategies.find(s => s.id === currentStrategy)
      if (!strategy) return
      
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: strategy.name,
          description: strategy.description 
        })
      })
      
      if (response.ok) {
        toast({
          title: "Strategy saved",
          description: `Successfully saved "${strategy.name}"`,
        })
        await loadStrategies(true) // Skip loading state
      } else {
        throw new Error('Failed to save strategy')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save strategy",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveAsNewStrategy = async () => {
    if (!newStrategyName.trim()) {
      toast({
        title: "Error",
        description: "Strategy name is required",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newStrategyName,
          description: newStrategyDescription 
        })
      })
      
      if (response.ok) {
        toast({
          title: "Strategy created",
          description: `Successfully created "${newStrategyName}"`,
        })
        setSaveAsDialogOpen(false)
        setNewStrategyName('')
        setNewStrategyDescription('')
        await loadStrategies(true) // Skip loading state
      } else {
        throw new Error('Failed to create strategy')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create strategy",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStrategy = async (strategyId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/strategies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId })
      })
      
      if (response.ok) {
        const strategy = strategies.find(s => s.id === strategyId)
        toast({
          title: "Strategy loaded",
          description: `Successfully loaded "${strategy?.name}"`,
        })
        
        // Update local state immediately
        setStrategies(prev => prev.map(s => ({
          ...s,
          isActive: s.id === strategyId
        })))
        setCurrentStrategy(strategyId)
        
        // Use router push instead of reload for smoother transition
        setTimeout(() => {
          window.location.href = '/financial-dashboard'
        }, 100)
      } else {
        throw new Error('Failed to load strategy')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load strategy",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const deleteStrategy = async (strategyId: string, strategyName: string) => {
    if (!confirm(`Are you sure you want to delete "${strategyName}"?`)) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/strategies?id=${strategyId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        toast({
          title: "Strategy deleted",
          description: `Successfully deleted "${strategyName}"`,
        })
        if (currentStrategy === strategyId) {
          setCurrentStrategy('')
        }
        await loadStrategies(true) // Skip loading state
      } else {
        throw new Error('Failed to delete strategy')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete strategy",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const duplicateStrategy = async (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId)
    if (!strategy) return
    
    setNewStrategyName(`${strategy.name} (Copy)`)
    setNewStrategyDescription(strategy.description || '')
    setSaveAsDialogOpen(true)
  }

  const executeStrategy = async (strategyId: string, strategyName: string) => {
    if (!confirm(`Are you sure you want to run the strategy "${strategyName}"?\n\nThis will create new revenue and expense data based on seed numbers and current product configurations.`)) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/strategies/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          strategyName,
          clearExisting: true
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast({
          title: "Strategy executed successfully",
          description: `Created ${result.results?.salesCreated || 0} sales and ${result.results?.expensesCreated || 0} expense records`,
        })
        
        // Reload the page to see updated data
        setTimeout(() => {
          window.location.href = '/financial-dashboard'
        }, 1500)
      } else if (response.status === 207) {
        // Partial success
        toast({
          title: "Strategy executed with warnings",
          description: `Some operations failed. Check console for details.`,
          variant: "default"
        })
        console.warn('Strategy execution warnings:', result.results?.errors)
      } else {
        throw new Error(result.error || 'Failed to execute strategy')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to execute strategy",
        variant: "destructive"
      })
      console.error('Strategy execution error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        return `${diffMins} minutes ago`
      }
      return `${diffHours} hours ago`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  const activeStrategy = strategies.find(s => s.id === currentStrategy)

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Budget Strategies
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and compare different budget scenarios for your business planning
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 flex gap-3">
          <Button 
            onClick={() => setSaveAsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Strategy
          </Button>
          <Button 
            onClick={saveStrategy}
            disabled={!currentStrategy || loading}
            variant="outline"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Current
          </Button>
        </div>

        {/* Strategies Grid */}
        <div className="relative">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Updating strategies...</span>
              </div>
            </div>
          )}
          
          {isInitialLoading ? (
            // Show loading skeleton only on initial load
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : strategies.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <FolderOpen className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No strategies yet</h3>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
                Create your first budget strategy to start planning different scenarios
              </p>
              <Button onClick={() => setSaveAsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Strategy
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <Card 
                key={strategy.id}
                className={cn(
                  "hover:shadow-lg transition-shadow cursor-pointer h-full",
                  strategy.isActive && "ring-2 ring-blue-500"
                )}
                onClick={() => setCurrentStrategy(strategy.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {strategy.name}
                        {strategy.isActive && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </span>
                        )}
                      </CardTitle>
                      {strategy.description && (
                        <CardDescription className="mt-1 text-sm">
                          {strategy.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-xs text-gray-500 mb-3">
                    <Clock className="h-3 w-3 mr-1" />
                    Updated {formatDate(strategy.updatedAt)}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={strategy.id === currentStrategy ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation()
                        loadStrategy(strategy.id)
                      }}
                      disabled={loading}
                      className="flex-1"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        executeStrategy(strategy.id, strategy.name)
                      }}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      title="Run strategy to generate revenue and expenses"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        duplicateStrategy(strategy.id)
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStrategy(strategy.id, strategy.name)
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>

        {/* Save As Dialog */}
        <Dialog open={saveAsDialogOpen} onOpenChange={setSaveAsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Strategy</DialogTitle>
              <DialogDescription>
                Save your current work as a new budget strategy
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Strategy Name</Label>
                <Input
                  id="name"
                  value={newStrategyName}
                  onChange={(e) => setNewStrategyName(e.target.value)}
                  placeholder="e.g., Q1 2025 Conservative"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newStrategyDescription}
                  onChange={(e) => setNewStrategyDescription(e.target.value)}
                  placeholder="e.g., Conservative growth with reduced ad spend"
                  rows={3}
                  className="w-full resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveAsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={saveAsNewStrategy} 
                disabled={loading || !newStrategyName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create Strategy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}