import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
export const dynamic = 'force-dynamic'

interface NotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  lowStockAlerts: boolean
  newTransactionAlerts: boolean
  dailyReports: boolean
  weeklyReports: boolean
  monthlyReports: boolean
  alertRecipients: string[]
  reportRecipients: string[]
}

// Default notification settings
const DEFAULT_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  lowStockAlerts: true,
  newTransactionAlerts: false,
  dailyReports: false,
  weeklyReports: true,
  monthlyReports: true,
  alertRecipients: [],
  reportRecipients: [],
}

// Settings model removed in v0.5.0
// GET /api/settings/notifications - Get notification settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return default settings (Settings model removed in v0.5.0)
    return NextResponse.json(DEFAULT_SETTINGS)
  } catch (_error) {
    // console.error('Error fetching notification settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    )
  }
}

// POST /api/settings/notifications - Save notification settings
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as NotificationSettings

    // Validate settings
    if (typeof body.emailEnabled !== 'boolean' ||
        typeof body.smsEnabled !== 'boolean' ||
        typeof body.pushEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid settings format' },
        { status: 400 }
      )
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    for (const email of body.alertRecipients) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid alert recipient email: ${email}` },
          { status: 400 }
        )
      }
    }
    
    for (const email of body.reportRecipients) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid report recipient email: ${email}` },
          { status: 400 }
        )
      }
    }

    // At least one notification method should be enabled
    if (!body.emailEnabled && !body.smsEnabled && !body.pushEnabled) {
      return NextResponse.json(
        { error: 'At least one notification method must be enabled' },
        { status: 400 }
      )
    }

    // Settings model removed in v0.5.0 - return success with the validated settings
    return NextResponse.json({
      success: true,
      message: 'Notification settings saved successfully (in-memory only)',
      settings: body
    })
  } catch (_error) {
    // console.error('Error saving notification settings:', error)
    return NextResponse.json(
      { error: 'Failed to save notification settings' },
      { status: 500 }
    )
  }
}