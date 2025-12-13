'use client'

import { useState } from 'react'
import { Eye, Trash2, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { ImportActionsProps } from './types'
import { cn } from '@/lib/utils'

export function ImportActions({
  importItem,
  onView,
  onDelete,
  onSelect,
  isSelected = false,
  disabled = false
}: ImportActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleDelete = async () => {
    if (!onDelete) return
    
    const confirmed = confirm('Are you sure you want to delete this import? This action cannot be undone.')
    if (!confirmed) return
    
    setIsDeleting(true)
    try {
      await onDelete()
      toast.success('Import deleted successfully')
    } catch (error) {
      toast.error('Failed to delete import')
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }
  
  return (
    <div className="flex items-center gap-2">
      {onSelect && (
        <button
          onClick={() => onSelect(!isSelected)}
          disabled={disabled}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            isSelected 
              ? "text-brand-blue hover:text-brand-blue/80" 
              : "text-gray-400 hover:text-gray-300",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title={isSelected ? "Deselect" : "Select for comparison"}
        >
          {isSelected ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      )}
      
      {onView && (
        <button
          onClick={onView}
          disabled={disabled || importItem.status !== 'completed'}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            "text-gray-400 hover:text-gray-300 hover:bg-gray-800",
            (disabled || importItem.status !== 'completed') && "opacity-50 cursor-not-allowed"
          )}
          title="View import data"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={disabled || isDeleting}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            "text-gray-400 hover:text-red-500 hover:bg-red-500/10",
            (disabled || isDeleting) && "opacity-50 cursor-not-allowed"
          )}
          title="Delete import"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}