/**
 * Utility functions for handling base path in the application
 */

/**
 * Get the base path from environment or default to empty string
 */
export function getBasePath(): string {
 return process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || ''
}

/**
 * Prepend base path to a given path
 * @param path - The path to prepend base path to
 * @returns The path with base path prepended
 */
export function withBasePath(path: string): string {
 const basePath = getBasePath()
 if (!basePath) return path
 
 // Ensure path starts with /
 const normalizedPath = path.startsWith('/') ? path : `/${path}`
 
 // Avoid double slashes
 return `${basePath}${normalizedPath}`
}

/**
 * Remove base path from a given path
 * @param path - The path to remove base path from
 * @returns The path without base path
 */
export function withoutBasePath(path: string): string {
 const basePath = getBasePath()
 if (!basePath || !path.startsWith(basePath)) return path
 
 const pathWithoutBase = path.slice(basePath.length)
 return pathWithoutBase.startsWith('/') ? pathWithoutBase : `/${pathWithoutBase}`
}

/**
 * Check if we're running with a base path
 */
export function hasBasePath(): boolean {
 return !!getBasePath()
}