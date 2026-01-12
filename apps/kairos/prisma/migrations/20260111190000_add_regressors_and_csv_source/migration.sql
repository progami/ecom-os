-- Add CSV_UPLOAD to TimeSeriesSource enum
ALTER TYPE "TimeSeriesSource" ADD VALUE 'CSV_UPLOAD';

-- Create RegressorFutureMode enum
CREATE TYPE "RegressorFutureMode" AS ENUM ('FORECAST', 'USER_INPUT');

-- Rename seriesId to targetSeriesId in Forecast table
ALTER TABLE "Forecast" RENAME COLUMN "seriesId" TO "targetSeriesId";

-- Drop old index and create new one with renamed column
DROP INDEX IF EXISTS "Forecast_seriesId_idx";
CREATE INDEX "Forecast_targetSeriesId_idx" ON "Forecast"("targetSeriesId");

-- Create ForecastRegressor table
CREATE TABLE "ForecastRegressor" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "futureMode" "RegressorFutureMode" NOT NULL DEFAULT 'FORECAST',

    CONSTRAINT "ForecastRegressor_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for forecastId + seriesId
CREATE UNIQUE INDEX "ForecastRegressor_forecastId_seriesId_key" ON "ForecastRegressor"("forecastId", "seriesId");

-- Create indexes
CREATE INDEX "ForecastRegressor_forecastId_idx" ON "ForecastRegressor"("forecastId");
CREATE INDEX "ForecastRegressor_seriesId_idx" ON "ForecastRegressor"("seriesId");

-- Add foreign key constraints
ALTER TABLE "ForecastRegressor" ADD CONSTRAINT "ForecastRegressor_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForecastRegressor" ADD CONSTRAINT "ForecastRegressor_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TimeSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
