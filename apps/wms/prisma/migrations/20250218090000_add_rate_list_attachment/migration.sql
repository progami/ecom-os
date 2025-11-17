-- Add JSON column to store warehouse rate list attachment metadata
ALTER TABLE "warehouses"
ADD COLUMN IF NOT EXISTS "rate_list_attachment" JSONB;
