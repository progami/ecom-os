import { WarehouseInvoicesPage } from '@/components/warehouse-invoices/warehouse-invoices-page'

export default function FinanceReconciliationPage() {
  return (
    <WarehouseInvoicesPage
      title="Reconciliation"
      description="Invoices requiring review"
      postLoginRedirectPath="/finance/reconciliation"
      detailBasePath="/finance/invoices"
      filterStatuses={['IMPORTED', 'MATCHED', 'DISPUTED']}
      emptyStateMessage="No invoices currently require reconciliation."
    />
  )
}
