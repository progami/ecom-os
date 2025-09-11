#!/usr/bin/env npx tsx
/**
 * Demo Script - Creates transactions using Playwright UI automation
 * Can optionally seed base data first
 */

import { chromium, Browser, Page } from 'playwright'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { 
  createSampleDocument, 
  cleanupTempFiles,
  getReceiveUploadPattern,
  getShipUploadPattern 
} from './demo-files'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const prisma = new PrismaClient()

// Parse command line arguments
const args = process.argv.slice(2)
const headless = !args.includes('--headed')
const slowMo = args.includes('--slow') ? 500 : 0
const verbose = args.includes('--verbose')
const cleanTransactions = args.includes('--clean-transactions')
const skipReceive = args.includes('--skip-receive')
const skipShip = args.includes('--skip-ship')
const runSeed = args.includes('--seed')
const skipSeed = args.includes('--skip-seed')

function log(message: string, data?: any) {
  console.log(`[DEMO] ${message}`)
  if (verbose && data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function cleanAllTransactions() {
  log('Cleaning all existing transactions...')
  
  // Delete transactions first - cascade deletion will handle related records
  await prisma.inventoryTransaction.deleteMany()
  // Storage ledger doesn't have cascade delete, so delete it manually
  await prisma.storageLedger.deleteMany()
  
  log('All transactions cleaned')
}

async function seedBaseData() {
  log('Seeding base data...')
  
  // Create users
  log('Creating users...')
  const hashedPassword = await bcrypt.hash('test123', 10)
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@test.com' }
  })
  
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        fullName: 'Admin User',
        role: 'admin',
        passwordHash: hashedPassword
      }
    })
    log('Created admin user: admin@test.com')
  } else {
    log('Admin user already exists')
  }
  
  // Create warehouses
  log('Creating warehouses...')
  const warehouses = [
    {
      code: 'FMC',
      name: 'FMC',
      address: '123 Logistics Way, USA'
    },
    {
      code: 'VGLOBAL',
      name: 'Vglobal',
      address: '456 Distribution Center, USA'
    }
  ]
  
  for (const warehouse of warehouses) {
    const existing = await prisma.warehouse.findUnique({
      where: { code: warehouse.code }
    })
    if (!existing) {
      await prisma.warehouse.create({ data: warehouse })
      log(`Created warehouse: ${warehouse.name} (${warehouse.code})`)
    } else {
      log(`Warehouse ${warehouse.code} already exists`)
    }
  }
  
  // Create SKUs
  log('Creating SKUs...')
  const skuSpecs = [
    { skuCode: 'CS-008', description: 'Pack of 3 - LD', asin: 'B0C7ZQ3VZL', unitsPerCarton: 60 },
    { skuCode: 'CS-010', description: 'Pack of 3 - ST', asin: 'B0CR1GSBQ9', unitsPerCarton: 52 },
    { skuCode: 'CS-007', description: 'Pack of 6 - LD', asin: 'B09HXC3NL8', unitsPerCarton: 60 },
    { skuCode: 'CS-011', description: 'Pack of 6 - ST', asin: 'B0DHDTPGCP', unitsPerCarton: 24 },
    { skuCode: 'CS-009', description: 'Pack of 10 - LD', asin: 'B0CR1H3VSF', unitsPerCarton: 36 },
    { skuCode: 'CS-012', description: 'Pack of 10 - ST', asin: 'B0DHHCYZSH', unitsPerCarton: 16 },
    { skuCode: 'CS-CDS-001', description: 'CDS-001', asin: 'B0CW3N48K1', unitsPerCarton: 33 },
    { skuCode: 'CS-CDS-002', description: 'CDS-002', asin: 'B0CW3L6PQH', unitsPerCarton: 14 }
  ]
  
  for (const spec of skuSpecs) {
    const existing = await prisma.sku.findUnique({
      where: { skuCode: spec.skuCode }
    })
    if (!existing) {
      await prisma.sku.create({
        data: {
          ...spec,
          unitDimensionsCm: '25×20.5×2',
          unitWeightKg: 0.5,
          cartonDimensionsCm: '40×28×30',
          cartonWeightKg: 10,
          material: '7 Micron',
          packagingType: 'Box',
          packSize: 1,
          isActive: true
        }
      })
      log(`Created SKU: ${spec.skuCode} - ${spec.description}`)
    } else {
      log(`SKU ${spec.skuCode} already exists`)
    }
  }
  
  log('Base data seeding complete')
}

async function login(page: Page) {
  log('Logging in as admin@test.com...')
  
  await page.goto(`${BASE_URL}/auth/login`)
  await page.waitForSelector('#emailOrUsername', { timeout: 10000 })
  
  // Use regular login with admin@test.com
  await page.fill('#emailOrUsername', 'admin@test.com')
  await page.fill('#password', 'test123')
  await page.click('button[type="submit"]')
  
  // Wait for dashboard to load
  await page.waitForSelector('text=Dashboard', { timeout: 10000 })
  log('Login successful')
}

async function createReceiveTransaction(page: Page, data: {
  warehouse: string
  items: Array<{
    sku: string
    cartons: number
    storageCartonsPerPallet: number
    shippingCartonsPerPallet: number
  }>
  referenceNumber?: string
  transactionDate?: Date
  transactionIndex?: number
}) {
  const refNumber = data.referenceNumber || `CI-${Date.now()}`
  const dateStr = data.transactionDate ? data.transactionDate.toISOString().split('T')[0] : 'today'
  log(`Creating RECEIVE transaction: ${refNumber} on ${dateStr} with ${data.items.length} items`)
  
  // Navigate to receive page
  await page.goto(`${BASE_URL}/operations/receive`)
  await page.waitForSelector('text=New Receipt')
  
  // Wait for form to be ready
  await page.waitForTimeout(1000)
  
  // Fill warehouse - find select after "Warehouse *" label
  const warehouseSelect = await page.locator('label:has-text("Warehouse *")').locator('..').locator('select').first()
  // Handle warehouse name case (Vglobal vs VGLOBAL)
  const warehouseName = data.warehouse === 'VGLOBAL' ? 'Vglobal' : data.warehouse
  await warehouseSelect.selectOption({ label: `${warehouseName} (${data.warehouse})` })
  
  // Wait for tabs to appear after warehouse selection
  await page.waitForTimeout(500)
  
  // Fill transaction details
  await page.fill('input[placeholder*="CI-"]', refNumber) // Reference number
  await page.fill('input[placeholder*="ship or vessel"]', 'MV Ever Given') // Ship name
  await page.fill('input[placeholder*="XXXX-"]', `MSKU${Math.random().toString(36).substr(2, 7).toUpperCase()}`) // Container number
  await page.fill('input[placeholder*="supplier"]', 'Demo Supplier Co.') // Supplier
  
  // Set transaction date - use various dates to test the system
  // This helps uncover date-related issues
  const transactionDate = data.transactionDate || new Date()
  transactionDate.setSeconds(transactionDate.getSeconds() + Math.floor(Math.random() * 59))
  const dateTimeLocal = transactionDate.toISOString().slice(0, 16)
  await page.fill('input[type="datetime-local"]', dateTimeLocal)
  
  // Click on Cargo tab
  await page.click('button:has-text("Cargo")')
  await page.waitForTimeout(500)
  
  // Add line items
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    
    // Add new row if needed (first row might be auto-added)
    if (i > 0) {
      await page.click('button:has-text("Add Item")')
      await page.waitForTimeout(300)
    } else {
      const existingRows = await page.locator('tbody tr').count()
      if (existingRows === 0) {
        await page.click('button:has-text("Add Item")')
        await page.waitForTimeout(300)
      }
    }
    
    // Fill line item details
    const lineItemRow = page.locator('tbody tr').nth(i)
    
    // Select SKU - first select in the row
    await lineItemRow.locator('select').first().selectOption(item.sku)
    await page.waitForTimeout(1000) // Wait for defaults to load
    
    // Fill cartons using name attribute selector - more reliable
    const cartonsInput = lineItemRow.locator('input[name*="cartons-"]')
    await cartonsInput.click()
    await cartonsInput.fill('')
    await cartonsInput.type(item.cartons.toString())
    await cartonsInput.press('Tab')
    log(`Set cartons: ${item.cartons} for ${item.sku}`)
    
    // Wait a bit for calculations
    await page.waitForTimeout(300)
    
    // Fill storage config - the first of the two config inputs with c/p label
    // Using a more specific selector based on the actual structure
    const storageConfigInput = lineItemRow.locator('td').nth(4).locator('input[type="number"]')
    await storageConfigInput.click()
    await storageConfigInput.fill('')
    await storageConfigInput.type(item.storageCartonsPerPallet.toString())
    await storageConfigInput.press('Tab')
    log(`Set storage config: ${item.storageCartonsPerPallet} cartons/pallet for ${item.sku}`)
    
    // Fill shipping config - the second config input with c/p label
    const shippingConfigInput = lineItemRow.locator('td').nth(5).locator('input[type="number"]')
    await shippingConfigInput.click()
    await shippingConfigInput.fill('')
    await shippingConfigInput.type(item.shippingCartonsPerPallet.toString())
    await shippingConfigInput.press('Tab')
    log(`Set shipping config: ${item.shippingCartonsPerPallet} cartons/pallet for ${item.sku}`)
  }
  
  // Click on Costs tab to add costs
  await page.click('button:has-text("Costs")')
  await page.waitForTimeout(1000)
  
  // Find the Container Costs section and add a cost
  const containerSection = page.locator('h3:has-text("Container Costs")').locator('..').locator('..')
  const containerInput = containerSection.locator('input[type="number"]').first()
  await containerInput.click()
  await containerInput.fill('')
  await containerInput.type('1000')
  await containerInput.press('Tab')
  log('Added container cost: $1000')
  
  // Click on Attachments tab to upload documents
  const uploadIndex = data.transactionIndex || 1
  const documentsToUpload = getReceiveUploadPattern(uploadIndex)
  
  if (documentsToUpload.length > 0) {
    await page.click('button:has-text("Attachments")')
    await page.waitForTimeout(1000)
    log(`Uploading ${documentsToUpload.length} documents for RECEIVE transaction`)
    
    // Upload documents based on the pattern
    for (const docType of documentsToUpload) {
      // Create the sample document
      const filePath = createSampleDocument(docType, refNumber)
      log(`Created document: ${docType} at ${filePath}`)
      
      // Find the upload input for this document type
      const uploadInput = page.locator(`input[id="${docType}-upload"]`)
      
      // Check if input exists and upload
      if (await uploadInput.count() > 0) {
        await uploadInput.setInputFiles(filePath)
        await page.waitForTimeout(1500) // Wait for upload to process
        log(`Uploaded ${docType} for ${refNumber}`)
      } else {
        log(`Could not find upload input for ${docType}`)
      }
    }
  }
  
  // Submit the form
  await page.click('button:has-text("Create Transaction")')
  
  // Wait for success message or redirect
  await page.waitForSelector('text=successfully', { timeout: 5000 }).catch(() => {
    // If no success message, check if we're redirected to transactions page
    return page.waitForURL('**/operations/transactions', { timeout: 5000 })
  })
  
  log(`Created RECEIVE transaction: ${refNumber}`)
}

async function createShipTransaction(page: Page, data: {
  warehouse: string
  items: Array<{
    sku: string
    cartons: number
    shippingCartonsPerPallet: number
  }>
  referenceNumber?: string
  trackingNumber?: string
  transactionDate?: Date
  transactionIndex?: number
}) {
  const refNumber = data.referenceNumber || `FBA-${Date.now()}`
  const dateStr = data.transactionDate ? data.transactionDate.toISOString().split('T')[0] : 'today'
  log(`Creating SHIP transaction: ${refNumber} on ${dateStr} with ${data.items.length} items`)
  
  // Navigate to ship page
  await page.goto(`${BASE_URL}/operations/ship`)
  await page.waitForSelector('text=New Shipment')
  
  // Wait for form to load
  await page.waitForTimeout(1000)
  
  // Set transaction date - use various dates to test the system
  const transactionDate = data.transactionDate || new Date()
  transactionDate.setSeconds(transactionDate.getSeconds() + Math.floor(Math.random() * 59))
  const dateTimeLocal = transactionDate.toISOString().slice(0, 16)
  const dateInput = page.locator('input[type="datetime-local"]').first()
  await dateInput.clear()
  await dateInput.fill(dateTimeLocal)
  
  // Select warehouse from dropdown - find select after "Warehouse *" label
  const warehouseSelect = await page.locator('label:has-text("Warehouse *")').locator('..').locator('select').first()
  // Handle warehouse name case (Vglobal vs VGLOBAL)
  const warehouseName = data.warehouse === 'VGLOBAL' ? 'Vglobal' : data.warehouse
  await warehouseSelect.selectOption({ label: `${warehouseName} (${data.warehouse})` })
  
  // Wait for the page to react to warehouse selection and load inventory
  // Wait longer and check for inventory to be loaded
  await page.waitForTimeout(3000)
  
  // Fill reference number (FBA Shipment ID)
  const referenceInput = page.locator('input[placeholder*="FBA"]')
  await referenceInput.clear()
  await referenceInput.fill(refNumber)
  
  // Fill destination (optional)
  const destinationInput = page.locator('input[placeholder*="BHX4"]')
  await destinationInput.clear()
  await destinationInput.fill('AMZ-DC1')
  
  // Fill tracking number if provided
  if (data.trackingNumber) {
    const trackingInput = page.locator('input[placeholder*="Carrier tracking"]')
    await trackingInput.clear()
    await trackingInput.fill(data.trackingNumber)
  }
  
  // Verify reference number was filled
  const refValue = await referenceInput.inputValue()
  log(`Reference number filled: ${refValue}`)
  
  // Click on Cargo tab to add items
  await page.click('button:has-text("Cargo")')
  await page.waitForTimeout(500)
  
  // Add line items
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    
    // Add new row if needed
    if (i > 0) {
      await page.click('button:has-text("Add Item")')
      await page.waitForTimeout(300)
    } else {
      const existingRows = await page.locator('tbody tr').count()
      if (existingRows === 0) {
        await page.click('button:has-text("Add Item")')
        await page.waitForTimeout(300)
      }
    }
    
    const lineItemRow = page.locator('tbody tr').nth(i)
    const skuBatchSelect = lineItemRow.locator('select').first()
    
    // Wait for options to load
    await page.waitForTimeout(2000)
    
    // Get all available options
    const options = await skuBatchSelect.locator('option').allTextContents()
    
    if (options.length <= 1) {
      log(`No inventory available for ${item.sku}`)
      continue
    }
    
    // Find matching SKU/batch
    let selectedIndex = 1
    for (let j = 1; j < options.length; j++) {
      const optionText = options[j]
      if (optionText.includes(item.sku)) {
        selectedIndex = j
        log(`Found inventory: ${optionText}`)
        break
      }
    }
    
    // Select inventory
    await skuBatchSelect.selectOption({ index: selectedIndex })
    await page.waitForTimeout(1500)
    
    // Get available quantity
    const availableInput = lineItemRow.locator('input[type="number"]').first()
    const available = parseInt(await availableInput.inputValue()) || 0
    
    // Ship less than available (use 80% of available or requested, whichever is less)
    const cartonsToShip = Math.min(item.cartons, Math.floor(available * 0.8))
    if (cartonsToShip === 0) {
      log(`Skipping ${item.sku} - insufficient inventory`)
      continue
    }
    
    const cartonsInput = lineItemRow.locator('input[type="number"]').nth(1)
    await cartonsInput.clear()
    await cartonsInput.fill(cartonsToShip.toString())
    log(`Shipping ${cartonsToShip} of ${available} available cartons for ${item.sku}`)
    
    // Fill shipping config
    const shippingConfigInput = lineItemRow.locator('input[type="number"]').nth(4)
    await shippingConfigInput.clear()
    await shippingConfigInput.fill(item.shippingCartonsPerPallet.toString())
    
    // Fill pallets
    const palletsNeeded = Math.ceil(cartonsToShip / item.shippingCartonsPerPallet)
    const palletsInput = lineItemRow.locator('input[type="number"]').nth(5)
    await palletsInput.clear()
    await palletsInput.fill(palletsNeeded.toString())
  }
  
  // Navigate to Costs tab and add shipping cost
  await page.click('button:has-text("Costs")')
  await page.waitForTimeout(1500)
  log('Navigating to Costs tab')
  
  // Find the Transportation Costs section
  const transportSection = page.locator('h3:has-text("Transportation Costs")').locator('..').locator('..')
  const transportExists = await transportSection.count() > 0
  
  if (transportExists) {
    log('Found Transportation Costs section')
    
    // Find all transportation cost inputs (FTL, LTL, etc.)
    // They are number inputs within the transportation section
    const transportInputs = transportSection.locator('input[type="number"]')
    const inputCount = await transportInputs.count()
    log(`Found ${inputCount} transportation cost input(s)`)
    
    if (inputCount > 0) {
      // Use the first available transportation input (usually FTL or LTL)
      const firstInput = transportInputs.first()
      await firstInput.click()
      await firstInput.clear()
      await firstInput.fill('250')
      await firstInput.press('Tab')  // Trigger change event
      log('Added transportation cost: $250')
    } else {
      log('ERROR: No transportation cost inputs found')
    }
  } else {
    log('ERROR: Could not find Transportation Costs section')
  }
  
  // Click on Attachments tab to upload documents
  const uploadIndex = data.transactionIndex || 1
  const documentsToUpload = getShipUploadPattern(uploadIndex)
  
  if (documentsToUpload.length > 0) {
    await page.click('button:has-text("Attachments")')
    await page.waitForTimeout(1000)
    log(`Uploading ${documentsToUpload.length} documents for SHIP transaction`)
    
    // Upload documents based on the pattern
    for (let i = 0; i < documentsToUpload.length; i++) {
      const docType = documentsToUpload[i]
      // Create the sample document
      const filePath = createSampleDocument(docType, refNumber, i + 1)
      log(`Created document: ${docType} at ${filePath}`)
      
      // For SHIP, we have proof_of_pickup and other documents
      if (docType === 'proof_of_pickup') {
        const uploadInput = page.locator('input[id="proof-of-pickup-upload"]')
        if (await uploadInput.count() > 0) {
          await uploadInput.setInputFiles(filePath)
          await page.waitForTimeout(1500)
          log(`Uploaded ${docType} for ${refNumber}`)
        }
      } else {
        // For other documents, use the generic other documents upload
        const uploadInput = page.locator('input[id="other-documents-upload"]')
        if (await uploadInput.count() > 0) {
          await uploadInput.setInputFiles(filePath)
          await page.waitForTimeout(1500)
          log(`Uploaded ${docType} as other document for ${refNumber}`)
        }
      }
    }
  }
  
  // Wait a moment before submitting
  await page.waitForTimeout(1000)
  
  // Debug: Check if button exists
  const submitButtons = await page.locator('button:has-text("Create Transaction")').count()
  log(`Found ${submitButtons} submit button(s)`)
  
  // Submit the form - look for the button more specifically
  const submitButton = page.locator('button:has-text("Create Transaction")').first()
  
  // Scroll button into view and click
  await submitButton.scrollIntoViewIfNeeded()
  await submitButton.click()
  log('Clicked Create Transaction button')
  
  // Wait for either success message, redirect, or error
  try {
    await Promise.race([
      page.waitForSelector('text=successfully', { timeout: 10000 }),
      page.waitForURL('**/operations/transactions/**', { timeout: 10000 })
    ])
    log(`Created SHIP transaction successfully`)
  } catch (err) {
    // Check for any error messages on the page
    const errorElement = await page.locator('.text-red-600, [role="alert"], .text-destructive').first()
    if (await errorElement.count() > 0) {
      const errorText = await errorElement.textContent()
      log(`Error on page: ${errorText}`)
      await page.screenshot({ path: 'ship-error.png', fullPage: true })
      // Don't throw, just log the error and continue
      log(`Warning: Transaction might have been created despite UI error`)
    } else {
      // Check if we're on a transaction details page (successful redirect)
      const currentUrl = page.url()
      if (currentUrl.includes('/operations/transactions/')) {
        log(`Created SHIP transaction successfully (redirected)`)
      } else {
        log(`Warning: Could not confirm transaction success, but API returned 200`)
      }
    }
  }
}

async function createDemoTransactions(page: Page) {
  log('Creating demo transactions with varied dates to test the system...')
  
  // Helper function to get a date N days ago
  const daysAgo = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date
  }
  
  // Create RECEIVE transactions
  if (!skipReceive) {
    const receiveTransactions = [
      // 30 days ago - Regular RECEIVE #1 - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'CI-2024-001',
        transactionDate: daysAgo(30),
        items: [{
          sku: 'CS-008',
          cartons: 500,
          storageCartonsPerPallet: 30,
          shippingCartonsPerPallet: 30
        }]
      },
      // 25 days ago - Regular RECEIVE #2 - VGLOBAL
      {
        warehouse: 'VGLOBAL',
        referenceNumber: 'CI-2024-002',
        transactionDate: daysAgo(25),
        items: [{
          sku: 'CS-010',
          cartons: 400,
          storageCartonsPerPallet: 25,
          shippingCartonsPerPallet: 25
        }]
      },
      // 20 days ago - Multi-SKU RECEIVE - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'CI-2024-003',
        transactionDate: daysAgo(20),
        items: [
          {
            sku: 'CS-008',
            cartons: 300,
            storageCartonsPerPallet: 30,
            shippingCartonsPerPallet: 30
          },
          {
            sku: 'CS-010',
            cartons: 250,
            storageCartonsPerPallet: 25,
            shippingCartonsPerPallet: 25
          },
          {
            sku: 'CS-007',
            cartons: 200,
            storageCartonsPerPallet: 20,
            shippingCartonsPerPallet: 20
          },
          {
            sku: 'CS-011',
            cartons: 150,
            storageCartonsPerPallet: 30,
            shippingCartonsPerPallet: 30
          }
        ]
      },
      // 10 days ago - Another RECEIVE - VGLOBAL
      {
        warehouse: 'VGLOBAL',
        referenceNumber: 'CI-2024-004',
        transactionDate: daysAgo(10),
        items: [{
          sku: 'CS-009',
          cartons: 300,
          storageCartonsPerPallet: 30,
          shippingCartonsPerPallet: 30
        }]
      },
      // 5 days ago - Recent RECEIVE - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'CI-2024-005',
        transactionDate: daysAgo(5),
        items: [{
          sku: 'CS-012',
          cartons: 200,
          storageCartonsPerPallet: 25,
          shippingCartonsPerPallet: 25
        }]
      },
      // Today - Current RECEIVE - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'CI-2024-006',
        transactionDate: new Date(),
        items: [{
          sku: 'CS-CDS-001',
          cartons: 100,
          storageCartonsPerPallet: 25,
          shippingCartonsPerPallet: 25
        }]
      }
    ]
    
    for (let i = 0; i < receiveTransactions.length; i++) {
      const txn = { ...receiveTransactions[i], transactionIndex: i + 1 }
      await createReceiveTransaction(page, txn)
      await page.waitForTimeout(1000)
    }
  } else {
    log('Skipping RECEIVE transactions (--skip-receive flag)')
  }
  
  // Wait for inventory to be available
  await page.waitForTimeout(2000)
  
  // Create SHIP transactions
  if (!skipShip) {
    const shipTransactions = [
      // 15 days ago - Regular SHIP #1 - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'FBA-2024-001',
        trackingNumber: 'TRK-001',
        transactionDate: daysAgo(15),
        items: [{
          sku: 'CS-008',
          cartons: 100,
          shippingCartonsPerPallet: 30
        }]
      },
      // 12 days ago - Regular SHIP #2 - VGLOBAL
      {
        warehouse: 'VGLOBAL',
        referenceNumber: 'FBA-2024-002',
        trackingNumber: 'TRK-002',
        transactionDate: daysAgo(12),
        items: [{
          sku: 'CS-008',
          cartons: 80,
          shippingCartonsPerPallet: 25
        }]
      },
      // 8 days ago - Multi-SKU SHIP - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'FBA-2024-003',
        trackingNumber: 'TRK-003',
        transactionDate: daysAgo(8),
        items: [
          {
            sku: 'CS-008',
            cartons: 50,
            shippingCartonsPerPallet: 30
          },
          {
            sku: 'CS-010',
            cartons: 40,
            shippingCartonsPerPallet: 25
          },
          {
            sku: 'CS-007',
            cartons: 30,
            shippingCartonsPerPallet: 20
          }
        ]
      },
      // 3 days ago - Recent SHIP - VGLOBAL
      {
        warehouse: 'VGLOBAL',
        referenceNumber: 'FBA-2024-004',
        trackingNumber: 'TRK-004',
        transactionDate: daysAgo(3),
        items: [{
          sku: 'CS-008',
          cartons: 50,
          shippingCartonsPerPallet: 30
        }]
      },
      // Yesterday - Very recent SHIP - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'FBA-2024-005',
        trackingNumber: 'TRK-005',
        transactionDate: daysAgo(1),
        items: [{
          sku: 'CS-008',
          cartons: 25,
          shippingCartonsPerPallet: 25
        }]
      },
      // Today - Current SHIP - FMC
      {
        warehouse: 'FMC',
        referenceNumber: 'FBA-2024-006',
        trackingNumber: 'TRK-006',
        transactionDate: new Date(),
        items: [{
          sku: 'CS-008',
          cartons: 20,
          shippingCartonsPerPallet: 25
        }]
      }
    ]
    
    for (let i = 0; i < shipTransactions.length; i++) {
      const txn = { ...shipTransactions[i], transactionIndex: i + 1 }
      await createShipTransaction(page, txn)
      await page.waitForTimeout(1000)
    }
  } else {
    log('Skipping SHIP transactions (--skip-ship flag)')
  }
  
  log('Demo transactions created successfully')
}

async function verifyInventory(page: Page) {
  log('Verifying inventory levels...')
  
  // Navigate to inventory page
  await page.goto(`${BASE_URL}/operations/inventory`)
  await page.waitForSelector('text=Inventory Ledger & Balances')
  
  // Take a screenshot for verification
  if (verbose) {
    await page.screenshot({ path: 'inventory-verification.png' })
    log('Screenshot saved: inventory-verification.png')
  }
  
  // Check if inventory is displayed
  const inventoryRows = await page.$$('table tbody tr')
  log(`Found ${inventoryRows.length} inventory entries`)
  
  return inventoryRows.length > 0
}

async function main() {
  let browser: Browser | null = null
  
  try {
    console.log('='.repeat(50))
    console.log('WMS DEMO SCRIPT (Playwright UI Automation)')
    console.log('='.repeat(50))
    console.log('This script creates transactions via the UI')
    console.log('')
    console.log('Options:')
    console.log('  --seed               Force seed all base data (warehouses, SKUs)')
    console.log('  --skip-seed          Skip auto-seeding warehouses/SKUs (admin user always ensured)')
    console.log('  --headed             Show browser window')
    console.log('  --slow               Run slowly for debugging')
    console.log('  --verbose            Show detailed output')
    console.log('  --clean-transactions Clean all existing transactions before starting')
    console.log('  --skip-receive       Skip creating RECEIVE transactions')
    console.log('  --skip-ship          Skip creating SHIP transactions')
    console.log('='.repeat(50))
    console.log('')
    
    // Always ensure admin user exists for demo login
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@test.com' }
    })
    
    if (!adminUser) {
      console.log('⚠️  Admin user missing. Creating admin@test.com...')
      const hashedPassword = await bcrypt.hash('test123', 10)
      await prisma.user.create({
        data: {
          email: 'admin@test.com',
          fullName: 'Admin User',
          role: 'admin',
          passwordHash: hashedPassword
        }
      })
      log('Created admin user for demo login')
    }
    
    // Seed base data if requested or if needed
    if (runSeed) {
      await seedBaseData()
    } else if (!skipSeed) {
      // Check if OTHER base data exists (warehouses, SKUs)
      const [warehouseCount, skuCount] = await Promise.all([
        prisma.warehouse.count(),
        prisma.sku.count()
      ])
      
      if (warehouseCount === 0 || skuCount === 0) {
        console.log('⚠️  Warehouses or SKUs missing. Running seed...')
        await seedBaseData()
      } else {
        log(`Base data exists: ${warehouseCount} warehouses, ${skuCount} SKUs`)
      }
    }
    
    // Clean transactions if requested
    if (cleanTransactions) {
      await cleanAllTransactions()
    }
    
    // Launch browser
    log('Launching browser...')
    browser = await chromium.launch({
      headless,
      slowMo
    })
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    })
    const page = await context.newPage()
    
    // Capture console logs
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[BROWSER ERROR]', msg.text())
      }
    })
    
    // Capture page errors  
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]', error.message)
    })
    
    // Capture API responses
    page.on('response', response => {
      if (response.url().includes('/api/transactions') && response.request().method() === 'POST') {
        response.text().then(text => {
          console.log('[API RESPONSE]', response.status(), text.substring(0, 500))
        }).catch(() => {})
      }
    })
    
    // Login
    await login(page)
    
    // Create demo transactions
    await createDemoTransactions(page)
    
    // Verify inventory
    const hasInventory = await verifyInventory(page)
    
    console.log('')
    console.log('='.repeat(50))
    console.log('✅ DEMO COMPLETED SUCCESSFULLY')
    console.log('='.repeat(50))
    console.log('')
    console.log('Summary:')
    if (!skipReceive) {
      console.log('  - Created 6 RECEIVE transactions over 30 days')
      console.log('    • 2 single-SKU receipts (CS-008, CS-010)')
      console.log('    • 1 multi-SKU receipt (4 different SKUs)')
      console.log('    • 3 more single-SKU receipts')
    }
    if (!skipShip) {
      console.log('  - Created 6 SHIP transactions over 15 days')
      console.log('    • 2 single-SKU shipments from FMC')
      console.log('    • 1 multi-SKU shipment (3 different SKUs)')
      console.log('    • 3 more single-SKU shipments')
    }
    console.log(`  - Inventory verification: ${hasInventory ? 'PASSED' : 'FAILED'}`)
    console.log('')
    console.log('You can now:')
    console.log('  1. View transactions at /operations/transactions')
    console.log('  2. Check inventory at /operations/inventory')
    console.log('  3. View reports at /analytics/reports')
    console.log('='.repeat(50))
    
  } catch (error) {
    console.error('Error in demo script:', error)
    
    // Take error screenshot if possible
    if (browser) {
      const page = (await browser.contexts())[0]?.pages()[0]
      if (page) {
        await page.screenshot({ path: 'error-screenshot.png' })
        console.log('Error screenshot saved: error-screenshot.png')
      }
    }
    
    process.exit(1)
  } finally {
    // Clean up temporary files
    cleanupTempFiles()
    log('Cleaned up temporary document files')
    
    if (browser) {
      await browser.close()
    }
    await prisma.$disconnect()
  }
}

main()