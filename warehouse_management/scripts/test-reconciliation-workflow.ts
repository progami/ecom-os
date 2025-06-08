import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function testReconciliationWorkflow() {
  console.log('Testing Invoice Reconciliation Workflow...\n')

  try {
    // 1. Setup test data
    console.log('1. Setting up test data...')
    
    // Create test user
    const password = await hash('test123', 12)
    const testUser = await prisma.user.upsert({
      where: { email: 'finance.test@example.com' },
      update: {},
      create: {
        email: 'finance.test@example.com',
        passwordHash: password,
        fullName: 'Finance Test User',
        role: 'admin'
      }
    })
    console.log('   ✓ Created test user')

    // Get a warehouse
    const warehouse = await prisma.warehouse.findFirst({
      where: { isActive: true }
    })
    if (!warehouse) throw new Error('No active warehouse found')
    console.log(`   ✓ Using warehouse: ${warehouse.name}`)

    // 2. Create a test invoice
    console.log('\n2. Creating test invoice...')
    const billingPeriodStart = new Date('2024-11-16')
    const billingPeriodEnd = new Date('2024-12-15')
    
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-${Date.now()}`,
        warehouseId: warehouse.id,
        billingPeriodStart,
        billingPeriodEnd,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        totalAmount: 5000,
        status: 'pending',
        createdById: testUser.id,
        lineItems: {
          create: [
            {
              costCategory: 'Storage',
              costName: 'Weekly Storage',
              quantity: 100,
              unitRate: 25,
              amount: 2500
            },
            {
              costCategory: 'Carton',
              costName: 'Inbound Carton Handling',
              quantity: 200,
              unitRate: 5,
              amount: 1000
            },
            {
              costCategory: 'Pallet',
              costName: 'Outbound Pallet Handling',
              quantity: 50,
              unitRate: 30,
              amount: 1500
            }
          ]
        }
      },
      include: {
        lineItems: true
      }
    })
    console.log(`   ✓ Created invoice ${invoice.invoiceNumber} with ${invoice.lineItems.length} line items`)
    console.log(`   ✓ Total amount: £${invoice.totalAmount}`)

    // 3. Test reconciliation API
    console.log('\n3. Testing reconciliation API...')
    const reconcileResponse = await fetch(`http://localhost:3000/api/reconciliation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: invoice.id,
        performedBy: testUser.email
      })
    })

    if (!reconcileResponse.ok) {
      const error = await reconcileResponse.text()
      console.error('   ✗ Reconciliation failed:', error)
    } else {
      const result = await reconcileResponse.json()
      console.log(`   ✓ Reconciliation completed`)
      console.log(`   - Total expected: £${result.summary.totalExpected}`)
      console.log(`   - Total invoiced: £${result.summary.totalInvoiced}`)
      console.log(`   - Total difference: £${result.summary.totalDifference}`)
      console.log(`   - Status: ${result.reconciled ? 'RECONCILED' : 'DISCREPANCIES FOUND'}`)
    }

    // 4. Test dispute workflow
    console.log('\n4. Testing dispute workflow...')
    const disputeResponse = await fetch(`http://localhost:3000/api/invoices/${invoice.id}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disputedBy: testUser.email,
        reason: 'Storage costs appear higher than expected based on inventory levels',
        lineItemDisputes: [
          {
            costCategory: 'Storage',
            costName: 'Weekly Storage',
            suggestedAmount: 2000,
            reason: 'Calculation seems incorrect'
          }
        ]
      })
    })

    if (!disputeResponse.ok) {
      const error = await disputeResponse.text()
      console.error('   ✗ Dispute creation failed:', error)
    } else {
      const dispute = await disputeResponse.json()
      console.log(`   ✓ Dispute created successfully`)
      console.log(`   - Dispute ID: ${dispute.id}`)
      console.log(`   - Disputed amount: £${dispute.disputedAmount}`)
      console.log(`   - Status: ${dispute.status}`)
    }

    // 5. Test acceptance workflow
    console.log('\n5. Testing partial acceptance workflow...')
    const acceptResponse = await fetch(`http://localhost:3000/api/invoices/${invoice.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acceptedBy: testUser.email,
        paymentMethod: 'Bank Transfer',
        paymentReference: 'TEST-PAY-12345',
        acceptedLineItems: [
          {
            costCategory: 'Carton',
            costName: 'Inbound Carton Handling'
          },
          {
            costCategory: 'Pallet',
            costName: 'Outbound Pallet Handling'
          }
        ]
      })
    })

    if (!acceptResponse.ok) {
      const error = await acceptResponse.text()
      console.error('   ✗ Acceptance failed:', error)
    } else {
      const result = await acceptResponse.json()
      console.log(`   ✓ Partial acceptance completed`)
      console.log(`   - Invoice status: ${result.invoice.status}`)
      console.log(`   - Payment method: ${result.invoice.paymentMethod}`)
      console.log(`   - Payment reference: ${result.invoice.paymentReference}`)
    }

    // 6. Check final state
    console.log('\n6. Checking final invoice state...')
    const finalInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        reconciliations: true,
        disputes: true,
        auditLogs: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (finalInvoice) {
      console.log(`   ✓ Invoice status: ${finalInvoice.status}`)
      console.log(`   ✓ Reconciliation items: ${finalInvoice.reconciliations.length}`)
      console.log(`   ✓ Disputes: ${finalInvoice.disputes.length}`)
      console.log(`   ✓ Audit logs: ${finalInvoice.auditLogs.length}`)
      
      if (finalInvoice.auditLogs.length > 0) {
        console.log('\n   Audit Trail:')
        finalInvoice.auditLogs.forEach(log => {
          console.log(`   - ${log.action} by ${log.performedBy} at ${log.performedAt.toLocaleString()}`)
        })
      }
    }

    console.log('\n✅ Reconciliation workflow test completed successfully!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testReconciliationWorkflow()