#!/bin/bash

# Fix Prisma model references
echo "Fixing Prisma model references..."

# Fix in all TypeScript files under app/api/v1/wms
find app/api/v1/wms -name "*.ts" -exec sed -i '' \
  -e 's/prisma\.warehouse\b/prisma.wmsWarehouse/g' \
  -e 's/prisma\.sku\b/prisma.wmsSku/g' \
  -e 's/prisma\.inventoryBalance\b/prisma.wmsInventoryBalance/g' \
  -e 's/prisma\.inventoryTransaction\b/prisma.wmsInventoryTransaction/g' \
  -e 's/prisma\.storageLedger\b/prisma.wmsStorageLedger/g' \
  -e 's/prisma\.invoice\b/prisma.wmsInvoice/g' \
  -e 's/prisma\.calculatedCost\b/prisma.wmsCalculatedCost/g' \
  -e 's/prisma\.costRate\b/prisma.wmsCostRate/g' \
  -e 's/prisma\.user\b/prisma.wmsUser/g' \
  -e 's/prisma\.invoiceReconciliation\b/prisma.wmsInvoiceReconciliation/g' \
  -e 's/prisma\.settings\b/prisma.wmsSettings/g' \
  {} \;

echo "Prisma model references fixed!"