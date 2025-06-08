-- CreateEnum
CREATE TYPE "WmsUserRole" AS ENUM ('admin', 'staff');

-- CreateEnum
CREATE TYPE "WmsTransactionType" AS ENUM ('RECEIVE', 'SHIP', 'ADJUST_IN', 'ADJUST_OUT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "WmsCostCategory" AS ENUM ('Container', 'Carton', 'Pallet', 'Storage', 'Unit', 'Shipment', 'Accessorial');

-- CreateEnum
CREATE TYPE "WmsInvoiceStatus" AS ENUM ('pending', 'reconciled', 'disputed', 'paid');

-- CreateEnum
CREATE TYPE "WmsReconciliationStatus" AS ENUM ('match', 'overbilled', 'underbilled');

-- CreateEnum
CREATE TYPE "WmsDisputeStatus" AS ENUM ('open', 'resolved', 'escalated');

-- CreateEnum
CREATE TYPE "WmsInvoiceAction" AS ENUM ('CREATED', 'UPDATED', 'ACCEPTED', 'DISPUTED', 'RESOLVED', 'PAID');

-- CreateEnum
CREATE TYPE "WmsNotificationType" AS ENUM ('INVOICE_DISPUTED', 'RECONCILIATION_COMPLETE', 'PAYMENT_RECEIVED', 'DISPUTE_RESOLVED');

-- CreateEnum
CREATE TYPE "WmsResolutionType" AS ENUM ('ACCEPTED', 'REJECTED', 'PARTIAL_ACCEPT', 'ESCALATED');

-- CreateTable
CREATE TABLE "wms_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "WmsUserRole" NOT NULL,
    "warehouse_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "wms_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_skus" (
    "id" TEXT NOT NULL,
    "sku_code" TEXT NOT NULL,
    "asin" TEXT,
    "description" TEXT NOT NULL,
    "pack_size" INTEGER NOT NULL,
    "material" TEXT,
    "unit_dimensions_cm" TEXT,
    "unit_weight_kg" DECIMAL(10,3),
    "units_per_carton" INTEGER NOT NULL,
    "carton_dimensions_cm" TEXT,
    "carton_weight_kg" DECIMAL(10,3),
    "packaging_type" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fba_stock" INTEGER NOT NULL DEFAULT 0,
    "fba_stock_last_updated" TIMESTAMP(3),

    CONSTRAINT "wms_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_sku_versions" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "version_identifier" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "units_per_carton" INTEGER NOT NULL,
    "carton_dimensions_cm" TEXT,
    "carton_weight_kg" DECIMAL(10,3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "wms_sku_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_warehouse_sku_configs" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "storage_cartons_per_pallet" INTEGER NOT NULL,
    "shipping_cartons_per_pallet" INTEGER NOT NULL,
    "max_stacking_height_cm" INTEGER,
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "wms_warehouse_sku_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_cost_rates" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "cost_category" "WmsCostCategory" NOT NULL,
    "cost_name" TEXT NOT NULL,
    "cost_value" DECIMAL(12,2) NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "wms_cost_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_transactions" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "batch_lot" TEXT NOT NULL,
    "transaction_type" "WmsTransactionType" NOT NULL,
    "reference_id" TEXT,
    "cartons_in" INTEGER NOT NULL DEFAULT 0,
    "cartons_out" INTEGER NOT NULL DEFAULT 0,
    "storage_pallets_in" INTEGER NOT NULL DEFAULT 0,
    "shipping_pallets_out" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "pickup_date" TIMESTAMP(3),
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "shipping_cartons_per_pallet" INTEGER,
    "storage_cartons_per_pallet" INTEGER,
    "ship_name" TEXT,
    "container_number" TEXT,
    "attachments" JSONB,

    CONSTRAINT "wms_inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_balances" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "batch_lot" TEXT NOT NULL,
    "current_cartons" INTEGER NOT NULL DEFAULT 0,
    "current_pallets" INTEGER NOT NULL DEFAULT 0,
    "current_units" INTEGER NOT NULL DEFAULT 0,
    "last_transaction_date" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipping_cartons_per_pallet" INTEGER,
    "storage_cartons_per_pallet" INTEGER,

    CONSTRAINT "wms_inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_storage_ledger" (
    "id" TEXT NOT NULL,
    "sl_id" TEXT NOT NULL,
    "week_ending_date" DATE NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "batch_lot" TEXT NOT NULL,
    "cartons_end_of_monday" INTEGER NOT NULL,
    "storage_pallets_charged" INTEGER NOT NULL,
    "applicable_weekly_rate" DECIMAL(10,2) NOT NULL,
    "calculated_weekly_cost" DECIMAL(12,2) NOT NULL,
    "billing_period_start" DATE NOT NULL,
    "billing_period_end" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_storage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_calculated_costs" (
    "id" TEXT NOT NULL,
    "calculated_cost_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "transaction_reference_id" TEXT NOT NULL,
    "cost_rate_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "batch_lot" TEXT,
    "transaction_date" DATE NOT NULL,
    "billing_week_ending" DATE NOT NULL,
    "billing_period_start" DATE NOT NULL,
    "billing_period_end" DATE NOT NULL,
    "quantity_charged" DECIMAL(12,2) NOT NULL,
    "applicable_rate" DECIMAL(10,2) NOT NULL,
    "calculated_cost" DECIMAL(12,2) NOT NULL,
    "cost_adjustment_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_expected_cost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "wms_calculated_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "billing_period_start" DATE NOT NULL,
    "billing_period_end" DATE NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "WmsInvoiceStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "payment_method" TEXT,
    "payment_reference" TEXT,
    "payment_date" DATE,
    "paid_at" TIMESTAMP(3),
    "paid_by" TEXT,
    "disputed_at" TIMESTAMP(3),
    "disputed_by" TEXT,

    CONSTRAINT "wms_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "cost_category" "WmsCostCategory" NOT NULL,
    "cost_name" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_rate" DECIMAL(10,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_invoice_reconciliations" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "cost_category" "WmsCostCategory" NOT NULL,
    "cost_name" TEXT NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "invoiced_amount" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "status" "WmsReconciliationStatus" NOT NULL,
    "resolution_notes" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "suggested_amount" DECIMAL(12,2),
    "expected_quantity" DECIMAL(12,2),
    "invoiced_quantity" DECIMAL(12,2),
    "unit_rate" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_invoice_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_audit_logs" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_inventory_audit_log" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "transaction_id" VARCHAR(255),
    "attempted_by" VARCHAR(255),
    "attempted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,

    CONSTRAINT "wms_inventory_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_pallet_variance" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "batch_lot" TEXT NOT NULL,
    "documented_pallets" INTEGER NOT NULL,
    "expected_pallets" INTEGER NOT NULL,
    "variance_pallets" INTEGER NOT NULL,
    "variance_cartons" INTEGER NOT NULL,
    "notes" TEXT,
    "resolution_status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_pallet_variance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_invoice_disputes" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "disputed_by" TEXT NOT NULL,
    "disputed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "disputed_amount" DECIMAL(12,2) NOT NULL,
    "line_items_disputed" INTEGER NOT NULL DEFAULT 0,
    "status" "WmsDisputeStatus" NOT NULL DEFAULT 'open',
    "contacted_warehouse" BOOLEAN NOT NULL DEFAULT false,
    "resolution_notes" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_invoice_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_invoice_audit_logs" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "action" "WmsInvoiceAction" NOT NULL,
    "performed_by" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_invoice_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_warehouse_notifications" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "type" "WmsNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "related_invoice_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "read_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_warehouse_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_dispute_resolutions" (
    "id" TEXT NOT NULL,
    "dispute_id" TEXT NOT NULL,
    "resolutionType" "WmsResolutionType" NOT NULL,
    "resolution_amount" DECIMAL(12,2),
    "resolution_notes" TEXT,
    "resolved_by" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wms_dispute_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_users_email_key" ON "wms_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wms_users_username_key" ON "wms_users"("username");

-- CreateIndex
CREATE INDEX "wms_users_email_idx" ON "wms_users"("email");

-- CreateIndex
CREATE INDEX "wms_users_username_idx" ON "wms_users"("username");

-- CreateIndex
CREATE INDEX "wms_users_warehouse_id_idx" ON "wms_users"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "wms_warehouses_code_key" ON "wms_warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wms_skus_sku_code_key" ON "wms_skus"("sku_code");

-- CreateIndex
CREATE INDEX "wms_skus_sku_code_idx" ON "wms_skus"("sku_code");

-- CreateIndex
CREATE UNIQUE INDEX "wms_warehouse_sku_configs_warehouse_id_sku_id_effective_dat_key" ON "wms_warehouse_sku_configs"("warehouse_id", "sku_id", "effective_date");

-- CreateIndex
CREATE INDEX "wms_warehouse_sku_configs_warehouse_id_sku_id_idx" ON "wms_warehouse_sku_configs"("warehouse_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "wms_cost_rates_warehouse_id_cost_name_effective_date_key" ON "wms_cost_rates"("warehouse_id", "cost_name", "effective_date");

-- CreateIndex
CREATE INDEX "wms_cost_rates_warehouse_id_cost_name_effective_date_idx" ON "wms_cost_rates"("warehouse_id", "cost_name", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_transactions_transaction_id_key" ON "wms_inventory_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "wms_inventory_transactions_transaction_date_idx" ON "wms_inventory_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "wms_inventory_transactions_warehouse_id_sku_id_batch_lot_idx" ON "wms_inventory_transactions"("warehouse_id", "sku_id", "batch_lot");

-- CreateIndex
CREATE INDEX "idx_wms_inventory_transactions_date" ON "wms_inventory_transactions"("transaction_date" DESC);

-- CreateIndex
CREATE INDEX "idx_wms_inventory_transactions_warehouse_sku_batch" ON "wms_inventory_transactions"("warehouse_id", "sku_id", "batch_lot");

-- CreateIndex
CREATE UNIQUE INDEX "wms_inventory_balances_warehouse_id_sku_id_batch_lot_key" ON "wms_inventory_balances"("warehouse_id", "sku_id", "batch_lot");

-- CreateIndex
CREATE INDEX "wms_inventory_balances_warehouse_id_sku_id_batch_lot_idx" ON "wms_inventory_balances"("warehouse_id", "sku_id", "batch_lot");

-- CreateIndex
CREATE UNIQUE INDEX "wms_storage_ledger_sl_id_key" ON "wms_storage_ledger"("sl_id");

-- CreateIndex
CREATE UNIQUE INDEX "wms_storage_ledger_week_ending_date_warehouse_id_sku_id_bat_key" ON "wms_storage_ledger"("week_ending_date", "warehouse_id", "sku_id", "batch_lot");

-- CreateIndex
CREATE INDEX "wms_storage_ledger_billing_period_start_billing_period_end_idx" ON "wms_storage_ledger"("billing_period_start", "billing_period_end");

-- CreateIndex
CREATE INDEX "wms_storage_ledger_warehouse_id_week_ending_date_idx" ON "wms_storage_ledger"("warehouse_id", "week_ending_date");

-- CreateIndex
CREATE UNIQUE INDEX "wms_calculated_costs_calculated_cost_id_key" ON "wms_calculated_costs"("calculated_cost_id");

-- CreateIndex
CREATE INDEX "wms_calculated_costs_billing_period_start_billing_period_en_idx" ON "wms_calculated_costs"("billing_period_start", "billing_period_end");

-- CreateIndex
CREATE INDEX "wms_calculated_costs_warehouse_id_transaction_date_idx" ON "wms_calculated_costs"("warehouse_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "wms_invoices_invoice_number_key" ON "wms_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_wms_invoices_payment_date" ON "wms_invoices"("payment_date");

-- CreateIndex
CREATE INDEX "idx_wms_invoices_paid_at" ON "wms_invoices"("paid_at");

-- CreateIndex
CREATE INDEX "idx_wms_invoices_disputed_at" ON "wms_invoices"("disputed_at");

-- CreateIndex
CREATE INDEX "wms_audit_logs_table_name_record_id_idx" ON "wms_audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "wms_audit_logs_user_id_idx" ON "wms_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "wms_audit_logs_created_at_idx" ON "wms_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wms_settings_key_key" ON "wms_settings"("key");

-- CreateIndex
CREATE INDEX "wms_pallet_variance_transaction_id_idx" ON "wms_pallet_variance"("transaction_id");

-- CreateIndex
CREATE INDEX "wms_pallet_variance_warehouse_id_sku_id_idx" ON "wms_pallet_variance"("warehouse_id", "sku_id");

-- CreateIndex
CREATE INDEX "wms_pallet_variance_resolution_status_idx" ON "wms_pallet_variance"("resolution_status");

-- CreateIndex
CREATE INDEX "idx_wms_invoice_disputes_invoice_id" ON "wms_invoice_disputes"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_wms_invoice_disputes_status" ON "wms_invoice_disputes"("status");

-- CreateIndex
CREATE INDEX "idx_wms_invoice_disputes_disputed_at" ON "wms_invoice_disputes"("disputed_at");

-- CreateIndex
CREATE INDEX "idx_wms_invoice_audit_logs_invoice_id" ON "wms_invoice_audit_logs"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_wms_invoice_audit_logs_action" ON "wms_invoice_audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_wms_invoice_audit_logs_performed_at" ON "wms_invoice_audit_logs"("performed_at");

-- CreateIndex
CREATE INDEX "idx_wms_warehouse_notifications_warehouse_id" ON "wms_warehouse_notifications"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_wms_warehouse_notifications_type" ON "wms_warehouse_notifications"("type");

-- CreateIndex
CREATE INDEX "idx_wms_warehouse_notifications_read" ON "wms_warehouse_notifications"("read");

-- CreateIndex
CREATE INDEX "idx_wms_warehouse_notifications_created_at" ON "wms_warehouse_notifications"("created_at");

-- CreateIndex
CREATE INDEX "idx_wms_dispute_resolutions_dispute_id" ON "wms_dispute_resolutions"("dispute_id");

-- AddForeignKey
ALTER TABLE "wms_users" ADD CONSTRAINT "wms_users_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_sku_versions" ADD CONSTRAINT "wms_sku_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "wms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_sku_versions" ADD CONSTRAINT "wms_sku_versions_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "wms_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_warehouse_sku_configs" ADD CONSTRAINT "wms_warehouse_sku_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "wms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_warehouse_sku_configs" ADD CONSTRAINT "wms_warehouse_sku_configs_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "wms_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_warehouse_sku_configs" ADD CONSTRAINT "wms_warehouse_sku_configs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_cost_rates" ADD CONSTRAINT "wms_cost_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "wms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_cost_rates" ADD CONSTRAINT "wms_cost_rates_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transactions" ADD CONSTRAINT "wms_inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "wms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transactions" ADD CONSTRAINT "wms_inventory_transactions_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "wms_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_transactions" ADD CONSTRAINT "wms_inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_balances" ADD CONSTRAINT "wms_inventory_balances_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "wms_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_inventory_balances" ADD CONSTRAINT "wms_inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_storage_ledger" ADD CONSTRAINT "wms_storage_ledger_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "wms_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_storage_ledger" ADD CONSTRAINT "wms_storage_ledger_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_calculated_costs" ADD CONSTRAINT "wms_calculated_costs_cost_rate_id_fkey" FOREIGN KEY ("cost_rate_id") REFERENCES "wms_cost_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_calculated_costs" ADD CONSTRAINT "wms_calculated_costs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "wms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_calculated_costs" ADD CONSTRAINT "wms_calculated_costs_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "wms_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_calculated_costs" ADD CONSTRAINT "wms_calculated_costs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_invoices" ADD CONSTRAINT "wms_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "wms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_invoices" ADD CONSTRAINT "wms_invoices_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_invoice_line_items" ADD CONSTRAINT "wms_invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "wms_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_invoice_reconciliations" ADD CONSTRAINT "wms_invoice_reconciliations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "wms_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_invoice_reconciliations" ADD CONSTRAINT "wms_invoice_reconciliations_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "wms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_audit_logs" ADD CONSTRAINT "wms_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_invoice_disputes" ADD CONSTRAINT "wms_invoice_disputes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "wms_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_invoice_audit_logs" ADD CONSTRAINT "wms_invoice_audit_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "wms_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_warehouse_notifications" ADD CONSTRAINT "wms_warehouse_notifications_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "wms_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_warehouse_notifications" ADD CONSTRAINT "wms_warehouse_notifications_related_invoice_id_fkey" FOREIGN KEY ("related_invoice_id") REFERENCES "wms_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_dispute_resolutions" ADD CONSTRAINT "wms_dispute_resolutions_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "wms_invoice_disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;