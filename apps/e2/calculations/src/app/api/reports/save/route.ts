import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const { content, filename, format, strategyName } = await req.json()
    
    // Use the correct folder name: B-Financial-Documentation
    const reportsDir = path.join(process.cwd(), '..', 'appendices', 'B-Financial-Documentation')
    
    // Ensure the reports directory exists
    await fs.mkdir(reportsDir, { recursive: true })
    
    // Save the file (will overwrite if exists)
    const filePath = path.join(reportsDir, filename)
    
    // Handle different formats
    if (format === 'pdf') {
      // Decode base64 PDF
      const buffer = Buffer.from(content, 'base64')
      await fs.writeFile(filePath, buffer)
    } else {
      // CSV and JSON are text
      await fs.writeFile(filePath, content, 'utf-8')
    }
    
    return NextResponse.json({
      success: true,
      path: filePath.replace(process.cwd(), ''),
      message: `appendices/B-Financial-Documentation/${filename}`
    })
  } catch (error) {
    console.error('Error saving report:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save report' },
      { status: 500 }
    )
  }
}