import ProductService from '@/services/database/ProductService'

/**
 * Initialize ProductService cache on application startup
 * This ensures that all synchronous methods work without throwing errors
 */
export async function initializeProductService(): Promise<void> {
  console.log('Initializing ProductService cache...')
  
  try {
    const productService = ProductService.getInstance()
    await productService.initializeCache()
    
    console.log('ProductService cache initialized successfully')
  } catch (error) {
    console.error('Failed to initialize ProductService:', error)
    // In production, you might want to throw this error to prevent app startup
    // For development, we'll log and continue
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Critical: Failed to initialize ProductService cache')
    }
  }
}

/**
 * Helper to ensure ProductService is initialized before using it
 * Can be called multiple times safely
 */
export async function ensureProductServiceInitialized(): Promise<void> {
  const productService = ProductService.getInstance()
  
  try {
    // This will throw if cache is not initialized
    productService.getProductSkus()
  } catch (error) {
    // Cache not initialized, initialize it now
    await productService.initializeCache()
  }
}

/**
 * Migration helper to replace old PRODUCTS import
 * Usage: const PRODUCTS = await getProductsObject()
 */
export async function getProductsObject() {
  await ensureProductServiceInitialized()
  const productService = ProductService.getInstance()
  return productService.getAllProducts()
}

/**
 * Migration helper to replace old productMargins import
 * Usage: const productMargins = await getProductMargins()
 */
export async function getProductMargins() {
  await ensureProductServiceInitialized()
  const productService = ProductService.getInstance()
  return productService.getProductMargins()
}

/**
 * Migration helper to replace old getProduct function
 * Usage: const product = await getProduct(sku)
 */
export async function getProduct(sku: string) {
  await ensureProductServiceInitialized()
  const productService = ProductService.getInstance()
  return productService.getProduct(sku)
}