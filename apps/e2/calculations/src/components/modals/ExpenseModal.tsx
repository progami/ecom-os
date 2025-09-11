'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import SharedFinancialDataService from '@/lib/services/SharedFinancialDataService'

interface ExpenseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExpenseAdded: () => void
}

const expenseCategories = [
  { id: 'payroll', name: 'Payroll', description: 'Salaries and wages' },
  { id: 'payroll-tax', name: 'Payroll Tax', description: '15.3% employer taxes' },
  { id: 'rent', name: 'Rent', description: 'Office/warehouse rent' },
  { id: 'advertising', name: 'Advertising', description: 'PPC and marketing' },
  { id: 'software', name: 'Software', description: 'All subscriptions' },
  { id: 'insurance', name: 'Insurance', description: 'Business insurance' },
  { id: 'inventory', name: 'Inventory', description: 'Product purchases' },
  { id: 'freight', name: 'Freight & Duties', description: 'Shipping and tariffs' },
  { id: 'office', name: 'Office Supplies', description: 'Office expenses' },
  { id: 'professional', name: 'Professional', description: 'Legal, accounting, etc' },
  { id: 'other', name: 'Other', description: 'Miscellaneous' }
]

export function ExpenseModal({ open, onOpenChange, onExpenseAdded }: ExpenseModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('other')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>('monthly')
  const [endDate, setEndDate] = useState('')
  const [includePayrollTax, setIncludePayrollTax] = useState(false)
  const [payrollTaxRate, setPayrollTaxRate] = useState(0.153) // Default rate
  
  const sharedDataService = SharedFinancialDataService.getInstance()
  
  React.useEffect(() => {
    // Load config from API
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config')
        if (response.ok) {
          const config = await response.json()
          if (config.businessRules?.payrollTaxRate) {
            setPayrollTaxRate(config.businessRules.payrollTaxRate)
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }
    loadConfig()
  }, [])

  const handleSubmit = () => {
    if (!date || !category || !description || !amount) return

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    // If adding payroll with tax, calculate the tax amount
    if (category === 'payroll' && includePayrollTax) {
      const taxAmount = parsedAmount * payrollTaxRate
      
      // Add payroll expense
      addExpenseToGL(date, 'payroll', description, parsedAmount)
      
      // Add payroll tax expense
      const taxDate = new Date(date)
      taxDate.setDate(taxDate.getDate() + 30) // Tax due end of month
      addExpenseToGL(
        taxDate.toISOString().split('T')[0], 
        'payroll-tax', 
        `Payroll Tax - ${description}`, 
        taxAmount
      )
    } else {
      // Add single expense
      addExpenseToGL(date, category, description, parsedAmount)
    }

    // Handle recurring expenses
    if (isRecurring) {
      scheduleRecurringExpenses()
    }

    // Reset form
    resetForm()
    onExpenseAdded()
    onOpenChange(false)
  }

  const addExpenseToGL = (expenseDate: string, expenseCategory: string, expenseDescription: string, expenseAmount: number) => {
    // Convert date string to year-month format
    const dateObj = new Date(expenseDate)
    const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
    
    // TODO: Update this to use the new SharedFinancialDataService API
    // The service no longer has getAllData() or updateMonthlyExpenses() methods
    // This component appears to be deprecated and is not being used in the application
  }

  const scheduleRecurringExpenses = () => {
    if (!isRecurring) return

    const startDate = new Date(date)
    const finalDate = endDate ? new Date(endDate) : new Date(startDate.getFullYear() + 5, 11, 31) // Default 5 years
    
    let currentDate = new Date(startDate)
    
    while (currentDate <= finalDate) {
      if (frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1)
      } else {
        currentDate.setFullYear(currentDate.getFullYear() + 1)
      }
      
      if (currentDate <= finalDate) {
        const recurringAmount = parseFloat(amount)
        
        if (category === 'payroll' && includePayrollTax) {
          // Add payroll
          addExpenseToGL(
            currentDate.toISOString().split('T')[0],
            'payroll',
            `${description} (Recurring)`,
            recurringAmount
          )
          
          // Add tax
          const taxDate = new Date(currentDate)
          taxDate.setDate(taxDate.getDate() + 30)
          addExpenseToGL(
            taxDate.toISOString().split('T')[0],
            'payroll-tax',
            `Payroll Tax - ${description} (Recurring)`,
            recurringAmount * payrollTaxRate
          )
        } else {
          addExpenseToGL(
            currentDate.toISOString().split('T')[0],
            category,
            `${description} (Recurring)`,
            recurringAmount
          )
        }
      }
    }
  }

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0])
    setCategory('other')
    setDescription('')
    setAmount('')
    setIsRecurring(false)
    setFrequency('monthly')
    setEndDate('')
    setIncludePayrollTax(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Add a new expense transaction to the general ledger
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Date
            </Label>
            <div className="col-span-3 relative">
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <select
              id="category"
              className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {expenseCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} - {cat.description}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              className="col-span-3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Monthly office rent"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              className="col-span-3"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          {category === 'payroll' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="col-span-1"></div>
              <div className="col-span-3 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includePayrollTax"
                  checked={includePayrollTax}
                  onChange={(e) => setIncludePayrollTax(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label 
                  htmlFor="includePayrollTax" 
                  className="text-sm font-normal cursor-pointer"
                >
                  Automatically add payroll tax (15.3%)
                </Label>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="col-span-1"></div>
            <div className="col-span-3 flex items-center space-x-2">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label 
                htmlFor="recurring" 
                className="text-sm font-normal cursor-pointer"
              >
                This is a recurring expense
              </Label>
            </div>
          </div>
          
          {isRecurring && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="frequency" className="text-right">
                  Frequency
                </Label>
                <select
                  id="frequency"
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'monthly' | 'annual')}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endDate" className="text-right">
                  End Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  className="col-span-3"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </>
          )}
          
          {includePayrollTax && category === 'payroll' && amount && (
            <div className="col-span-4 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm">
                <strong>Payroll:</strong> ${parseFloat(amount || '0').toFixed(2)}<br />
                <strong>Payroll Tax ({payrollTaxRate * 100}%):</strong> ${(parseFloat(amount || '0') * payrollTaxRate).toFixed(2)}<br />
                <strong>Total:</strong> ${(parseFloat(amount || '0') * (1 + payrollTaxRate)).toFixed(2)}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}