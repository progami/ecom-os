-- CreateEnum
CREATE TYPE "public"."InboundReceiveType" AS ENUM ('CONTAINER_20', 'CONTAINER_40', 'CONTAINER_40_HQ', 'CONTAINER_45_HQ', 'LCL');

-- CreateEnum
CREATE TYPE "public"."OutboundShipMode" AS ENUM ('PALLETS', 'CARTONS');

-- AlterTable
ALTER TABLE "public"."purchase_orders"
ADD COLUMN "receive_type" "public"."InboundReceiveType",
ADD COLUMN "ship_mode" "public"."OutboundShipMode";

