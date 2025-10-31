import { WarehouseInvoiceDetailPage } from '@/components/warehouse-invoices/warehouse-invoice-detail-page'

export default function FinanceInvoiceDetailPage() {
  return (
    <WarehouseInvoiceDetailPage
      titlePrefix="Invoice"
      redirectBasePath="/finance/invoices"
      backHref="/finance/invoices"
    />
  )
}
