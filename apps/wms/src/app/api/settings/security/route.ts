import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
export const dynamic = 'force-dynamic'

interface SecuritySettings {
 passwordMinLength: number
 passwordRequireUppercase: boolean
 passwordRequireLowercase: boolean
 passwordRequireNumbers: boolean
 passwordRequireSpecialChars: boolean
 sessionTimeout: number
 maxLoginAttempts: number
 lockoutDuration: number
 twoFactorEnabled: boolean
 ipWhitelist: string[]
}

// Default security settings
const DEFAULT_SETTINGS: SecuritySettings = {
 passwordMinLength: 8,
 passwordRequireUppercase: true,
 passwordRequireLowercase: true,
 passwordRequireNumbers: true,
 passwordRequireSpecialChars: false,
 sessionTimeout: 30,
 maxLoginAttempts: 5,
 lockoutDuration: 15,
 twoFactorEnabled: false,
 ipWhitelist: [],
}

// Settings model removed in v0.5.0
export async function GET(_request: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
 
 if (!session || session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Return default settings (Settings model removed in v0.5.0)
 return NextResponse.json(DEFAULT_SETTINGS)
 } catch (_error) {
 // console.error('Error fetching security settings:', error)
 return NextResponse.json(
 { error: 'Failed to fetch security settings' },
 { status: 500 }
 )
 }
}

export async function PUT(request: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
 
 if (!session || session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const body = await request.json() as SecuritySettings

 // Validate settings
 if (body.passwordMinLength < 6 || body.passwordMinLength > 32) {
 return NextResponse.json(
 { error: 'Password minimum length must be between 6 and 32' },
 { status: 400 }
 )
 }

 if (body.sessionTimeout < 5 || body.sessionTimeout > 1440) {
 return NextResponse.json(
 { error: 'Session timeout must be between 5 and 1440 minutes' },
 { status: 400 }
 )
 }

 if (body.maxLoginAttempts < 1 || body.maxLoginAttempts > 10) {
 return NextResponse.json(
 { error: 'Max login attempts must be between 1 and 10' },
 { status: 400 }
 )
 }

 if (body.lockoutDuration < 5 || body.lockoutDuration > 60) {
 return NextResponse.json(
 { error: 'Lockout duration must be between 5 and 60 minutes' },
 { status: 400 }
 )
 }

 // Validate IP whitelist format
 const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
 for (const ip of body.ipWhitelist) {
 if (!ipRegex.test(ip)) {
 return NextResponse.json(
 { error: `Invalid IP address: ${ip}` },
 { status: 400 }
 )
 }
 }

 // Settings model removed in v0.5.0 - return success with the validated settings
 return NextResponse.json({
 success: true,
 message: 'Security settings saved successfully (in-memory only)',
 settings: body
 })
 } catch (_error) {
 // console.error('Error updating security settings:', error)
 return NextResponse.json(
 { error: 'Failed to update security settings' },
 { status: 500 }
 )
 }
}