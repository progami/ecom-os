-- CreateEnum
CREATE TYPE "TimeSeriesSource" AS ENUM ('GOOGLE_TRENDS');

-- CreateEnum
CREATE TYPE "TimeSeriesGranularity" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ForecastModel" AS ENUM ('PROPHET');

-- CreateEnum
CREATE TYPE "ForecastStatus" AS ENUM ('DRAFT', 'RUNNING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ForecastRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "TimeSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "TimeSeriesSource" NOT NULL,
    "granularity" "TimeSeriesGranularity" NOT NULL,
    "query" TEXT NOT NULL,
    "geo" TEXT,
    "sourceMeta" JSONB,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSeriesPoint" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "t" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TimeSeriesPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" "ForecastModel" NOT NULL,
    "horizon" INTEGER NOT NULL,
    "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "lastRunAt" TIMESTAMP(3),
    "seriesId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "status" "ForecastRunStatus" NOT NULL DEFAULT 'SUCCESS',
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "params" JSONB,
    "output" JSONB,

    CONSTRAINT "ForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeSeries_source_idx" ON "TimeSeries"("source");

-- CreateIndex
CREATE INDEX "TimeSeries_createdById_idx" ON "TimeSeries"("createdById");

-- CreateIndex
CREATE INDEX "TimeSeries_createdByEmail_idx" ON "TimeSeries"("createdByEmail");

-- CreateIndex
CREATE INDEX "TimeSeriesPoint_seriesId_idx" ON "TimeSeriesPoint"("seriesId");

-- CreateIndex
CREATE INDEX "TimeSeriesPoint_t_idx" ON "TimeSeriesPoint"("t");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSeriesPoint_seriesId_t_key" ON "TimeSeriesPoint"("seriesId", "t");

-- CreateIndex
CREATE INDEX "Forecast_seriesId_idx" ON "Forecast"("seriesId");

-- CreateIndex
CREATE INDEX "Forecast_status_idx" ON "Forecast"("status");

-- CreateIndex
CREATE INDEX "Forecast_createdById_idx" ON "Forecast"("createdById");

-- CreateIndex
CREATE INDEX "Forecast_createdByEmail_idx" ON "Forecast"("createdByEmail");

-- CreateIndex
CREATE INDEX "ForecastRun_forecastId_idx" ON "ForecastRun"("forecastId");

-- CreateIndex
CREATE INDEX "ForecastRun_ranAt_idx" ON "ForecastRun"("ranAt");

-- AddForeignKey
ALTER TABLE "TimeSeriesPoint" ADD CONSTRAINT "TimeSeriesPoint_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TimeSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TimeSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

