import { NextRequest, NextResponse } from 'next/server'
import ProductService from '@/services/database/ProductService'
import logger from '@/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params
    
    // Get strategyId from query params if provided
    const { searchParams } = new URL(request.url)
    const strategyId = searchParams.get('strategyId') || undefined
    
    const productService = ProductService.getInstance()
    const product = await productService.getProductBySku(sku, strategyId)
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(product)
  } catch (error) {
    logger.error('Failed to fetch product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const { sku } = await params
  try {
    const productService = ProductService.getInstance()
    const data = await request.json()
    
    const product = await productService.updateProductCosts(sku, data)
    
    return NextResponse.json(product)
  } catch (error) {
    logger.error('Failed to update product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}