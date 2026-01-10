#!/usr/bin/env tsx

import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
Add SKU Dimension Columns

Adds unit/carton dimension columns (L/W/H) to skus and backfills from the legacy
unit_dimensions_cm / carton_dimensions_cm strings when possible.

Usage:
  pnpm --filter @ecom-os/talos tsx scripts/migrations/add-sku-dimension-columns.ts [options]

Options:
  --tenant=US|UK|ALL        Which tenant(s) to process (default: ALL)
  --dry-run                Print actions without applying changes
  --help, -h               Show this help
`)
}

async function applyForTenant(tenant: TenantCode, options: ScriptOptions) {
  const prisma = await getTenantPrismaClient(tenant)

  const ddlStatements = [
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "unit_length_cm" DECIMAL(8,2)`,
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "unit_width_cm" DECIMAL(8,2)`,
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "unit_height_cm" DECIMAL(8,2)`,
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "carton_length_cm" DECIMAL(8,2)`,
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "carton_width_cm" DECIMAL(8,2)`,
    `ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "carton_height_cm" DECIMAL(8,2)`,
  ]

  console.log(`\n[${tenant}] Ensuring dimension columns exist`)
  for (const statement of ddlStatements) {
    if (options.dryRun) {
      console.log(`[${tenant}] DRY RUN: ${statement}`)
      continue
    }
    await prisma.$executeRawUnsafe(statement)
  }

  const backfillStatements = [
    {
      label: 'unit dimensions',
      sql: `
        WITH parsed AS (
          SELECT
            id,
            regexp_match(
              regexp_replace(replace(unit_dimensions_cm, '×', 'x'), '\\s+', '', 'g'),
              '([0-9]+(?:\\.[0-9]+)?)[xX]([0-9]+(?:\\.[0-9]+)?)[xX]([0-9]+(?:\\.[0-9]+)?)'
            ) AS m
          FROM skus
          WHERE unit_dimensions_cm IS NOT NULL
            AND (unit_length_cm IS NULL OR unit_width_cm IS NULL OR unit_height_cm IS NULL)
        )
        UPDATE skus s
        SET
          unit_length_cm = COALESCE(s.unit_length_cm, (p.m[1])::numeric),
          unit_width_cm = COALESCE(s.unit_width_cm, (p.m[2])::numeric),
          unit_height_cm = COALESCE(s.unit_height_cm, (p.m[3])::numeric)
        FROM parsed p
        WHERE s.id = p.id
          AND p.m IS NOT NULL
      `,
    },
    {
      label: 'carton dimensions',
      sql: `
        WITH parsed AS (
          SELECT
            id,
            regexp_match(
              regexp_replace(replace(carton_dimensions_cm, '×', 'x'), '\\s+', '', 'g'),
              '([0-9]+(?:\\.[0-9]+)?)[xX]([0-9]+(?:\\.[0-9]+)?)[xX]([0-9]+(?:\\.[0-9]+)?)'
            ) AS m
          FROM skus
          WHERE carton_dimensions_cm IS NOT NULL
            AND (carton_length_cm IS NULL OR carton_width_cm IS NULL OR carton_height_cm IS NULL)
        )
        UPDATE skus s
        SET
          carton_length_cm = COALESCE(s.carton_length_cm, (p.m[1])::numeric),
          carton_width_cm = COALESCE(s.carton_width_cm, (p.m[2])::numeric),
          carton_height_cm = COALESCE(s.carton_height_cm, (p.m[3])::numeric)
        FROM parsed p
        WHERE s.id = p.id
          AND p.m IS NOT NULL
      `,
    },
  ]

  console.log(`[${tenant}] Backfilling dimension columns from legacy strings`)
  for (const statement of backfillStatements) {
    if (options.dryRun) {
      console.log(`[${tenant}] DRY RUN: backfill ${statement.label}`)
      continue
    }
    await prisma.$executeRawUnsafe(statement.sql)
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
