-- AlterTable
ALTER TABLE "public"."storage_ledger"
ADD COLUMN "closing_pallets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pallet_days" INTEGER NOT NULL DEFAULT 0;

