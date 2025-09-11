import { BaseService } from './base.service'

/**
 * Invoice Service
 * Note: Invoice functionality has been removed in v0.5.0
 * with the removal of Invoice and related models
 */
export class InvoiceService extends BaseService {
  constructor(context?: { user?: { id: string; role: string; warehouseId?: string } }) {
    super(context)
  }

  /**
   * Create invoice (stub - no longer supported)
   */
  async createInvoice(_data: { invoiceNumber: string; customerName: string; amount: number; dueDate: Date }) {
    throw new Error('Invoice functionality removed in v0.5.0')
  }

  /**
   * Get invoice by ID (stub - no longer supported)
   */
  async getInvoiceById(_id: string) {
    throw new Error('Invoice functionality removed in v0.5.0')
  }

  /**
   * Update invoice (stub - no longer supported)
   */
  async updateInvoice(_id: string, _data: Partial<{ invoiceNumber: string; customerName: string; amount: number; dueDate: Date; status: string }>) {
    throw new Error('Invoice functionality removed in v0.5.0')
  }

  /**
   * Delete invoice (stub - no longer supported)
   */
  async deleteInvoice(_id: string) {
    throw new Error('Invoice functionality removed in v0.5.0')
  }

  /**
   * List invoices (stub - no longer supported)
   */
  async listInvoices(_filters?: { status?: string; customerId?: string; warehouseId?: string }) {
    return {
      invoices: [],
      total: 0,
      message: 'Invoice functionality removed in v0.5.0'
    }
  }

  /**
   * Export invoice (stub - no longer supported)
   */
  async exportInvoice(_id: string, _format: 'pdf' | 'csv') {
    throw new Error('Invoice functionality removed in v0.5.0')
  }

  /**
   * Process payment (stub - no longer supported)
   */
  async processPayment(_invoiceId: string, _amount: number) {
    throw new Error('Invoice functionality removed in v0.5.0')
  }

  /**
   * Reconcile invoice (stub - no longer supported)
   */
  async reconcileInvoice(_invoiceId: string) {
    throw new Error('Invoice functionality removed in v0.5.0')
  }

  /**
   * Dispute invoice (stub - no longer supported)
   */
  async disputeInvoice(_invoiceId: string, _reason: string) {
    throw new Error('Invoice functionality removed in v0.5.0')
  }
}