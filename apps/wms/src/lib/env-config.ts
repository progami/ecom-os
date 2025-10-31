// Environment configuration that works on both client and server
export function getEnvironment(): 'production' | 'development' {
 // This will be evaluated at build time and included in the bundle
 return process.env.NODE_ENV as 'production' | 'development'
}

export const isProduction = getEnvironment() === 'production'
export const isDevelopment = getEnvironment() === 'development'