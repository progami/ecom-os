// InvoiceStatus type from removed Invoice model in v0.5.0
type InvoiceStatus = 'pending' | 'reconciled' | 'disputed' | 'paid'
import { z } from 'zod'
import { isAfter, isBefore, differenceInDays } from 'date-fns'

// Invoice validation schema
const invoiceSchema = z.object({
  warehouseId: z.string().uuid(),
  customerId: z.string().uuid(),
  billingPeriodStart: z.date(),
  billingPeriodEnd: z.date(),
  invoiceDate: z.date(),
  dueDate: z.date().optional(),
  subtotal: z.number().positive(),
  taxAmount: z.number().min(0),
  totalAmount: z.number().positive(),
  currency: z.string().length(3),
  lineItems: z.array(z.object({
    costCategory: z.string(),
    costName: z.string(),
    quantity: z.number().positive(),
    amount: z.number().positive(),
  })).min(1),
})

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate invoice data before creation/update
 */
export async function validateInvoiceData(data: unknown): Promise<ValidationResult> {
  const errors: string[] = []
  
  try {
    // Basic schema validation
    invoiceSchema.parse(data)
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      errors.push(..._error.issues.map(e => `${e.path.join('.')}: ${e.message}`))
    }
  }
  
  // Business rule validations
  if (data.billingPeriodStart && data.billingPeriodEnd) {
    if (isAfter(data.billingPeriodStart, data.billingPeriodEnd)) {
      errors.push('Billing period start date must be before end date')
    }
    
    const periodDays = differenceInDays(data.billingPeriodEnd, data.billingPeriodStart)
    if (periodDays > 366) {
      errors.push('Billing period cannot exceed one year')
    }
  }
  
  if (data.invoiceDate && data.billingPeriodEnd) {
    if (isBefore(data.invoiceDate, data.billingPeriodEnd)) {
      errors.push('Invoice date cannot be before billing period end')
    }
  }
  
  if (data.dueDate && data.invoiceDate) {
    if (isBefore(data.dueDate, data.invoiceDate)) {
      errors.push('Due date cannot be before invoice date')
    }
    
    const paymentTerms = differenceInDays(data.dueDate, data.invoiceDate)
    if (paymentTerms > 90) {
      errors.push('Payment terms cannot exceed 90 days')
    }
  }
  
  // Financial validations
  if (data.lineItems && Array.isArray(data.lineItems)) {
    const calculatedSubtotal = (data as { lineItems: Array<{ amount?: number }> }).lineItems.reduce((sum: number, item) => {
      return sum + (item.amount || 0)
    }, 0)
    
    if (Math.abs(calculatedSubtotal - data.subtotal) > 0.01) {
      errors.push('Subtotal does not match sum of line items')
    }
  }
  
  if (data.subtotal && data.taxAmount !== undefined && data.totalAmount) {
    const calculatedTotal = data.subtotal + data.taxAmount
    if (Math.abs(calculatedTotal - data.totalAmount) > 0.01) {
      errors.push('Total amount does not equal subtotal plus tax')
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate payment against invoice
 */
export function validatePayment(
  invoice: {
    totalAmount: number
    paidAmount: number
    status: InvoiceStatus
    currency: string
  },
  paymentAmount: number
): ValidationResult {
  const errors: string[] = []
  
  if (invoice.status === 'paid') {
    errors.push('Invoice is already fully paid')
  }
  
  if (paymentAmount <= 0) {
    errors.push('Payment amount must be positive')
  }
  
  const remainingAmount = invoice.totalAmount - invoice.paidAmount
  if (paymentAmount > remainingAmount + 0.01) { // Allow 1 cent tolerance
    errors.push(`Payment exceeds remaining balance of ${remainingAmount} ${invoice.currency}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate invoice status transition
 */
export function validateStatusTransition(
  currentStatus: InvoiceStatus,
  newStatus: InvoiceStatus
): ValidationResult {
  const errors: string[] = []
  
  // Define valid transitions
  const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    'pending': ['reconciled', 'disputed', 'paid'],
    'reconciled': ['disputed', 'paid'],
    'disputed': ['reconciled', 'paid'],
    'paid': [], // No transitions from paid
  }
  
  if (!validTransitions[currentStatus].includes(newStatus)) {
    errors.push(`Cannot transition from ${currentStatus} to ${newStatus}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate invoice for closing period
 */
export function validateForClosing(
  invoice: {
    status: InvoiceStatus
    lineItems: unknown[]
    totalAmount: number
  }
): ValidationResult {
  const errors: string[] = []
  
  if (invoice.status !== 'pending') {
    errors.push('Only pending invoices can be closed')
  }
  
  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    errors.push('Invoice must have at least one line item')
  }
  
  if (invoice.totalAmount <= 0) {
    errors.push('Invoice total must be greater than zero')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate bulk invoice operation
 */
export function validateBulkOperation(
  invoices: unknown[],
  operation: 'close' | 'approve' | 'export'
): ValidationResult {
  const errors: string[] = []
  
  if (!invoices || invoices.length === 0) {
    errors.push('No invoices selected for bulk operation')
  }
  
  if (invoices.length > 1000) {
    errors.push('Bulk operations are limited to 1000 invoices')
  }
  
  // Check if all invoices are from the same period for closing
  if (operation === 'close' && invoices.length > 0) {
    const firstPeriod = `${invoices[0].billingYear}-${invoices[0].billingMonth}`
    const samePeriod = invoices.every(inv => 
      `${inv.billingYear}-${inv.billingMonth}` === firstPeriod
    )
    
    if (!samePeriod) {
      errors.push('All invoices must be from the same billing period for bulk closing')
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}