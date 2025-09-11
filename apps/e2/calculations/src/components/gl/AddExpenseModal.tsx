'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface ExpenseFormData {
  date: Date
  description: string
  category: string
  amount: number
  expenseType: 'regular' | 'payroll' | 'inventory' | 'owner-equity' | 'recurring' | 'revenue'
  isRecurring: boolean
  recurringConfig?: {
    frequency: 'monthly' | 'annual'
    dayOfMonth?: number
    monthOfYear?: number
    endDate?: Date
  }
}

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ExpenseFormData) => Promise<void>
}

const expenseCategories = [
  { value: 'payroll', label: 'Payroll' },
  { value: 'payroll-tax', label: 'Payroll Tax' },
  { value: 'rent', label: 'Rent' },
  { value: 'software', label: 'Software & Subscriptions' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'freight', label: 'Freight & Duties' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'professional', label: 'Professional Fees' },
  { value: 'bank-fees', label: 'Bank Fees' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'legal', label: 'Legal & Compliance' },
  { value: 'contract', label: 'Contract Services' },
  { value: 'other', label: 'Other Expenses' }
]

const ownerEquityCategories = [
  { value: 'investment', label: 'Owner Investment' },
  { value: 'distribution', label: 'Owner Distribution' },
  { value: 'return', label: 'Return to Owner' }
]

const revenueCategories = [
  { value: 'sales', label: 'Sales Revenue' },
  { value: 'service', label: 'Service Revenue' },
  { value: 'interest', label: 'Interest Income' },
  { value: 'other-income', label: 'Other Income' }
]

export function AddExpenseModal({ isOpen, onClose, onSubmit }: AddExpenseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ExpenseFormData>({
    date: new Date(),
    description: '',
    category: '',
    amount: 0,
    expenseType: 'regular',
    isRecurring: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      await onSubmit(formData)
      // Reset form
      setFormData({
        date: new Date(),
        description: '',
        category: '',
        amount: 0,
        expenseType: 'regular',
        isRecurring: false
      })
      onClose()
    } catch (error) {
      console.error('Error submitting expense:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCategoriesForType = () => {
    if (formData.expenseType === 'revenue') {
      return revenueCategories
    }
    if (formData.expenseType === 'owner-equity') {
      return ownerEquityCategories
    }
    return expenseCategories
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>One-Time Entry</DialogTitle>
          <DialogDescription>
            Add a manual transaction to the general ledger (revenue, expense, or equity)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <Select
              value={formData.expenseType}
              onValueChange={(value) => setFormData({ ...formData, expenseType: value as any, category: '' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="regular">Operating Expense</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
                <SelectItem value="inventory">Inventory/COGS</SelectItem>
                <SelectItem value="owner-equity">Owner Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && setFormData({ ...formData, date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Claude.ai subscription, Office Rent"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {getCategoriesForType().map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              required
            />
          </div>

          {/* Recurring Option (not for inventory or owner equity) */}
          {formData.expenseType === 'regular' && (
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
              />
              <Label>This is a recurring expense</Label>
            </div>
          )}

          {/* Recurring Configuration */}
          {formData.isRecurring && (
            <div className="space-y-4 border rounded-lg p-4">
              <h4 className="font-medium">Recurring Settings</h4>
              
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={formData.recurringConfig?.frequency || 'monthly'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    recurringConfig: { 
                      frequency: value as 'monthly' | 'annual',
                      ...formData.recurringConfig
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.recurringConfig?.frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label>Day of Month</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.recurringConfig?.dayOfMonth || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      recurringConfig: { 
                        frequency: formData.recurringConfig?.frequency || 'monthly',
                        ...formData.recurringConfig, 
                        dayOfMonth: parseInt(e.target.value) || 1 
                      }
                    })}
                    placeholder="1-31"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.recurringConfig?.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.recurringConfig?.endDate 
                        ? format(formData.recurringConfig.endDate, "PPP") 
                        : <span>No end date</span>
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.recurringConfig?.endDate}
                      onSelect={(date) => setFormData({
                        ...formData,
                        recurringConfig: { 
                          frequency: formData.recurringConfig?.frequency || 'monthly',
                          ...formData.recurringConfig, 
                          endDate: date || undefined 
                        }
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Transaction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}