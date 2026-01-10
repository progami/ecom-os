-- Add AWD (Amazon Warehousing & Distribution) to CostCategory enum
DO $$ BEGIN
    ALTER TYPE "CostCategory" ADD VALUE 'AWD';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
