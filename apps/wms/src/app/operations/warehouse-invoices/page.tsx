import { WarehouseInvoicesPage } from '@/components/warehouse-invoices/warehouse-invoices-page'

export default function WarehouseInvoicesOperationsPage() {
 return (
 <WarehouseInvoicesPage
 title="Warehouse Invoices"
 description="Operations"
 postLoginRedirectPath="/operations/warehouse-invoices"
 detailBasePath="/operations/warehouse-invoices"
 />
 )
}
