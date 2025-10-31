import { WarehouseInvoicesPage } from '@/components/warehouse-invoices/warehouse-invoices-page'

export default function FinanceInvoicesPage() {
 return (
 <WarehouseInvoicesPage
 title="Invoices"
 description="Finance"
 postLoginRedirectPath="/finance/invoices"
 detailBasePath="/finance/invoices"
 emptyStateMessage="No invoices recorded yet."
 />
 )
}
