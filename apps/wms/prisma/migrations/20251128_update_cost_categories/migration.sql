-- Update CostCategory enum values
-- Map old categories to new logical categories

-- First, add new enum values (if they don't exist)
DO $$ BEGIN
    ALTER TYPE "CostCategory" ADD VALUE 'Inbound';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "CostCategory" ADD VALUE 'Outbound';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "CostCategory" ADD VALUE 'Forwarding';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing cost_rate records
UPDATE cost_rate SET cost_category = 'Inbound' WHERE cost_category IN ('Container', 'Carton', 'Pallet', 'Unit');
UPDATE cost_rate SET cost_category = 'Forwarding' WHERE cost_category IN ('transportation', 'Accessorial');

-- Update existing cost_ledger records  
UPDATE cost_ledger SET cost_category = 'Inbound' WHERE cost_category IN ('Container', 'Carton', 'Pallet', 'Unit');
UPDATE cost_ledger SET cost_category = 'Forwarding' WHERE cost_category IN ('transportation', 'Accessorial');
