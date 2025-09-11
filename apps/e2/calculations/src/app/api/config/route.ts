import { NextRequest, NextResponse } from 'next/server'
import SystemConfigService from '@/services/database/SystemConfigService'
import logger from '@/utils/logger'

export async function GET() {
  try {
    const configService = SystemConfigService.getInstance()
    
    const [businessRules, systemDates, defaultAssumptions, glAccountCodes] = await Promise.all([
      configService.getBusinessRules(),
      configService.getSystemDates(),
      configService.getDefaultAssumptions(),
      configService.getGLAccountCodes()
    ])
    
    return NextResponse.json({
      businessRules,
      systemDates,
      defaultAssumptions,
      glAccountCodes
    })
  } catch (error) {
    logger.error('Failed to fetch system config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json()
    const configService = SystemConfigService.getInstance()
    
    // Update business rules
    if (updates.businessRules) {
      for (const [key, value] of Object.entries(updates.businessRules)) {
        await configService.updateConfig(key, value)
      }
    }
    
    // Update system dates
    if (updates.systemDates) {
      for (const [key, value] of Object.entries(updates.systemDates)) {
        await configService.updateConfig(key, value)
      }
    }
    
    // Update default assumptions
    if (updates.defaultAssumptions) {
      for (const [key, value] of Object.entries(updates.defaultAssumptions)) {
        await configService.updateConfig(key, value)
      }
    }
    
    // Refresh cache after updates
    await configService.refreshCache()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to update system config:', error)
    return NextResponse.json(
      { error: 'Failed to update system configuration' },
      { status: 500 }
    )
  }
}