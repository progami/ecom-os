#!/usr/bin/env tsx

import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@ecom-os/prisma-wms'
import { getTenantPrismaClient } from '../../src/lib/tenant/prisma-factory'
import type { TenantCode } from '../../src/lib/tenant/constants'

type ScriptOptions = {
  tenants: TenantCode[]
  dryRun: boolean
  help?: boolean
}

function loadEnv() {
  const candidates = ['.env.local', '.env.production', '.env.dev', '.env']
  const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  for (const candidate of candidates) {
    const fullPath = path.join(appDir, candidate)
    if (!fs.existsSync(fullPath)) continue
    dotenv.config({ path: fullPath })
    return
  }
  dotenv.config({ path: path.join(appDir, '.env') })
}

function parseArgs(): ScriptOptions {
  const options: ScriptOptions = {
    tenants: ['US', 'UK'],
    dryRun: false,
  }

  for (const raw of process.argv.slice(2)) {
    const arg = raw.trim()
    if (arg === '--') continue
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg.startsWith('--tenant=')) {
      const value = arg.split('=')[1]?.toUpperCase()
      if (value === 'US' || value === 'UK') {
        options.tenants = [value]
        continue
      }
      if (value === 'ALL') {
        options.tenants = ['US', 'UK']
        continue
      }
      throw new Error(`Invalid --tenant value: ${value ?? ''} (expected US, UK, or ALL)`)
    }

    throw new Error(`Unknown arg: ${arg}`)
  }

  return options
}

function showHelp() {
  console.log(`
Ensure WMS Tenant Schema

Brings each tenant schema in sync with required baseline tables/columns used by
the WMS app (e.g. suppliers + supplier links + batch pallet fields).

This is an idempotent migration intended for deployments on long-lived schemas
where Prisma migrate deploy is not used.

Usage:
  pnpm --filter @ecom-os/wms tsx scripts/migrations/ensure-wms-tenant-schema.ts [options]

Options:
  --tenant=US|UK|ALL        Which tenant(s) to process (default: ALL)
  --dry-run                Print actions without applying changes
  --help, -h               Show this help
`)
}

async function execute(
  prisma: PrismaClient,
  tenant: TenantCode,
  sql: string,
  options: ScriptOptions
) {
  const trimmed = sql.trim()
  if (!trimmed) return
  if (options.dryRun) {
    console.log(
      `[${tenant}] DRY RUN: ${trimmed.replaceAll(/\s+/g, ' ').slice(0, 240)}${trimmed.length > 240 ? '…' : ''}`
    )
    return
  }
  await prisma.$executeRawUnsafe(sql)
}

async function applyForTenant(tenant: TenantCode, options: ScriptOptions) {
  const prisma = await getTenantPrismaClient(tenant)

  console.log(`\n[${tenant}] Ensuring baseline schema is present`)

  const ddlStatements: string[] = [
    // suppliers table (missing in some schemas)
    `
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "contact_name" text,
        "email" text,
        "phone" text,
        "address" text,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
      )
    `,
    `CREATE INDEX IF NOT EXISTS "suppliers_is_active_idx" ON "suppliers"("is_active")`,
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.conname = 'suppliers_name_key'
            AND n.nspname = current_schema()
        ) THEN
          ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_name_key" UNIQUE ("name");
        END IF;
      END $$;
    `,

    // link skus -> suppliers
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "default_supplier_id" text`,
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "secondary_supplier_id" text`,
    `CREATE INDEX IF NOT EXISTS "skus_default_supplier_id_idx" ON "skus"("default_supplier_id")`,
    `CREATE INDEX IF NOT EXISTS "skus_secondary_supplier_id_idx" ON "skus"("secondary_supplier_id")`,
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.conname = 'skus_supplier_ids_distinct_check'
            AND n.nspname = current_schema()
        ) THEN
          ALTER TABLE "skus"
            ADD CONSTRAINT "skus_supplier_ids_distinct_check"
            CHECK (
              default_supplier_id IS NULL
              OR secondary_supplier_id IS NULL
              OR default_supplier_id <> secondary_supplier_id
            );
        END IF;
      END $$;
    `,
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.conname = 'skus_default_supplier_id_fkey'
            AND n.nspname = current_schema()
        ) THEN
          ALTER TABLE "skus"
            ADD CONSTRAINT "skus_default_supplier_id_fkey"
            FOREIGN KEY ("default_supplier_id") REFERENCES "suppliers"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
      END $$;
    `,
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.conname = 'skus_secondary_supplier_id_fkey'
            AND n.nspname = current_schema()
        ) THEN
          ALTER TABLE "skus"
            ADD CONSTRAINT "skus_secondary_supplier_id_fkey"
            FOREIGN KEY ("secondary_supplier_id") REFERENCES "suppliers"("id")
            ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
      END $$;
    `,

    // batch pallet configuration fields (missing in some schemas)
    `ALTER TABLE "sku_batches" ADD COLUMN IF NOT EXISTS "storage_cartons_per_pallet" integer`,
    `ALTER TABLE "sku_batches" ADD COLUMN IF NOT EXISTS "shipping_cartons_per_pallet" integer`,
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.conname = 'sku_batches_storage_cartons_per_pallet_check'
            AND n.nspname = current_schema()
        ) THEN
          ALTER TABLE "sku_batches"
            ADD CONSTRAINT "sku_batches_storage_cartons_per_pallet_check"
            CHECK (storage_cartons_per_pallet IS NULL OR storage_cartons_per_pallet > 0);
        END IF;
      END $$;
    `,
    `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.conname = 'sku_batches_shipping_cartons_per_pallet_check'
            AND n.nspname = current_schema()
        ) THEN
          ALTER TABLE "sku_batches"
            ADD CONSTRAINT "sku_batches_shipping_cartons_per_pallet_check"
            CHECK (shipping_cartons_per_pallet IS NULL OR shipping_cartons_per_pallet > 0);
        END IF;
      END $$;
    `,
  ]

  for (const statement of ddlStatements) {
    await execute(prisma, tenant, statement, options)
  }
}

async function main() {
  loadEnv()
  const options = parseArgs()

  if (options.help) {
    showHelp()
    return
  }

  for (const tenant of options.tenants) {
    await applyForTenant(tenant, options)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
