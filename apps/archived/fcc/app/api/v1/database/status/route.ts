import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('[Database Status] Checking database status...', {
      url: request.url,
      headers: {
        hasCookie: !!request.headers.get('cookie'),
        host: request.headers.get('host')
      }
    })
    // Check if we have any data in key tables
    const [
      bankAccountCount,
      invoiceCount,
      contactCount
    ] = await Promise.all([
      prisma.bankAccount.count(),
      prisma.invoice.count(),
      prisma.contact.count()
    ])

    const hasData = bankAccountCount > 0 || invoiceCount > 0 || contactCount > 0
    
    console.log('[Database Status] Returning status:', {
      hasData,
      counts: {
        bankAccounts: bankAccountCount,
        invoices: invoiceCount,
        contacts: contactCount
      }
    })
    
    return NextResponse.json({
      hasData,
      counts: {
        bankAccounts: bankAccountCount,
        invoices: invoiceCount,
        contacts: contactCount
      }
    })
  } catch (error: any) {
    console.error('Database status error:', error)
    return NextResponse.json(
      { error: 'Failed to check database status' },
      { status: 500 }
    )
  }
}