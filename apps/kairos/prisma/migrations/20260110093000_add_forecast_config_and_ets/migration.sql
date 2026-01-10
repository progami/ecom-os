-- AlterEnum
ALTER TYPE "ForecastModel" ADD VALUE 'ETS';

-- AlterTable
ALTER TABLE "Forecast" ADD COLUMN "config" JSONB;

