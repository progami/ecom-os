import { prisma } from '@/lib/prisma'

export interface DatabaseHealthCheck {
  isHealthy: boolean
  error?: string
  connectionString?: string
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
  try {
    // Try to connect and run a simple query
    await prisma.$queryRaw`SELECT 1`
    
    return {
      isHealthy: true
    }
  } catch (_error) {
    // Extract useful error information
    let errorMessage = 'Unknown database error'
    let connectionInfo = ''
    
    if (_error instanceof Error) {
      errorMessage = _error.message
      
      // Check for specific connection errors
      if (errorMessage.includes("Can't reach database server")) {
        connectionInfo = 'Database server is not reachable. Please check if the database is running and accessible.'
      } else if (errorMessage.includes('ENOTFOUND')) {
        connectionInfo = 'Database hostname cannot be resolved. Please check the DATABASE_URL configuration.'
      } else if (errorMessage.includes('ECONNREFUSED')) {
        connectionInfo = 'Database connection was refused. Please check if the database is accepting connections.'
      } else if (errorMessage.includes('authentication failed')) {
        connectionInfo = 'Database authentication failed. Please check the username and password.'
      }
    }
    
    return {
      isHealthy: false,
      error: connectionInfo || errorMessage
    }
  }
}

export async function getDatabaseStatus() {
  const health = await checkDatabaseHealth()
  
  if (!health.isHealthy) {
    // Log the error for debugging
    // console.error('[Database Health Check Failed]', health.error)
  }
  
  return health
}