-- Add cost estimation fields to purchase_orders table
-- These fields allow users to specify expected quantities and see estimated costs before posting

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_cartons INT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_pallets INT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_sku_count INT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS estimated_total_cost DECIMAL(12, 2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS actual_total_cost DECIMAL(12, 2);

-- Add comments for documentation
COMMENT ON COLUMN purchase_orders.expected_cartons IS 'Expected number of cartons for cost estimation';
COMMENT ON COLUMN purchase_orders.expected_pallets IS 'Expected number of pallets for cost estimation';
COMMENT ON COLUMN purchase_orders.expected_sku_count IS 'Expected number of SKUs for cost estimation';
COMMENT ON COLUMN purchase_orders.estimated_total_cost IS 'Pre-calculated estimated total cost based on warehouse rates';
COMMENT ON COLUMN purchase_orders.actual_total_cost IS 'Actual total cost after posting (sum of cost_ledger)';
