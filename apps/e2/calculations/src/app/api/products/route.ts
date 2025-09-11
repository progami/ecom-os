import { NextRequest, NextResponse } from 'next/server'
import ProductService from '@/services/database/ProductService'
import logger from '@/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const productService = ProductService.getInstance()
    await productService.initializeCache()
    
    // Get query parameter to determine response format
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format')
    
    if (format === 'dashboard') {
      // Return dashboard format (without SKU in each object)
      const products = await productService.getProductsForDashboardAsync()
      return NextResponse.json(products)
    } else {
      // Return full product list for product-margins page
      const products = await productService.getActiveProducts()
      return NextResponse.json(products)
    }
  } catch (error) {
    logger.error('Failed to fetch products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const productService = ProductService.getInstance()
    const data = await request.json()
    
    const product = await productService.createProduct(data)
    
    return NextResponse.json(product)
  } catch (error: any) {
    logger.error('Failed to create product:', error)
    logger.error('Error details:', error.message || error)
    return NextResponse.json(
      { error: 'Failed to create product', details: error.message },
      { status: 500 }
    )
  }
}