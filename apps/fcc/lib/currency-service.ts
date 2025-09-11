import { prisma } from '@/lib/prisma'
import { structuredLogger } from '@/lib/logger'
import { Decimal } from '@prisma/client/runtime/library'
import type { PrismaClient } from '@prisma/client'

interface ExchangeRate {
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveDate: Date
  source?: string
}

type PrismaTransaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export class CurrencyService {
  private static readonly BASE_CURRENCY = 'GBP'
  private static readonly CACHE_DURATION_HOURS = 24
  
  /**
   * Get exchange rate from one currency to another
   * First checks database cache, then fetches from Xero if needed
   */
  static async getExchangeRate(
    fromCurrency: string, 
    toCurrency: string,
    date?: Date,
    tx?: PrismaTransaction
  ): Promise<number> {
    // Same currency = 1:1
    if (fromCurrency === toCurrency) return 1
    
    const effectiveDate = date || new Date()
    
    try {
      // Try to get from cache first
      const cachedRate = await this.getCachedRate(fromCurrency, toCurrency, effectiveDate, tx)
      if (cachedRate) {
        structuredLogger.debug('Using cached exchange rate', {
          component: 'currency-service',
          fromCurrency,
          toCurrency,
          rate: cachedRate.rate.toNumber(),
          effectiveDate: cachedRate.effectiveDate
        })
        return cachedRate.rate.toNumber()
      }
      
      // If not in cache, fetch from Xero or use fallback
      const freshRate = await this.fetchFreshRate(fromCurrency, toCurrency)
      
      // Cache the rate for future use
      // Using upsert in cacheRate method to handle concurrent requests
      await this.cacheRate({
        fromCurrency,
        toCurrency,
        rate: freshRate,
        effectiveDate,
        source: 'fallback' // Mark as fallback since it came from getFallbackRate
      }, tx)
      
      return freshRate
    } catch (error) {
      structuredLogger.error('Failed to get exchange rate', error, {
        component: 'currency-service',
        fromCurrency,
        toCurrency
      })
      
      // Return fallback rate
      return this.getFallbackRate(fromCurrency, toCurrency)
    }
  }
  
  /**
   * Convert amount from one currency to another
   */
  static async convert(
    amount: number | Decimal,
    fromCurrency: string,
    toCurrency: string,
    date?: Date,
    tx?: PrismaTransaction
  ): Promise<number> {
    const numAmount = typeof amount === 'number' ? amount : amount.toNumber()
    const rate = await this.getExchangeRate(fromCurrency, toCurrency, date, tx)
    return numAmount * rate
  }
  
  /**
   * Get cached rate from database
   */
  private static async getCachedRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date,
    tx?: PrismaTransaction
  ) {
    const db = tx || prisma
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - this.CACHE_DURATION_HOURS)
    
    return await db.currencyRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        effectiveDate: {
          gte: cutoffTime
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    })
  }
  
  /**
   * Cache exchange rate in database
   */
  private static async cacheRate(
    rate: ExchangeRate,
    tx?: PrismaTransaction
  ) {
    const db = tx || prisma
    try {
      // Use upsert to handle concurrent requests and avoid unique constraint errors
      await db.currencyRate.upsert({
        where: {
          fromCurrency_toCurrency_effectiveDate: {
            fromCurrency: rate.fromCurrency,
            toCurrency: rate.toCurrency,
            effectiveDate: rate.effectiveDate
          }
        },
        update: {
          rate: new Decimal(rate.rate),
          source: rate.source || 'fallback',
          updatedAt: new Date()
        },
        create: {
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: new Decimal(rate.rate),
          effectiveDate: rate.effectiveDate,
          source: rate.source || 'fallback'
        }
      })
      
      structuredLogger.debug('Cached currency rate', {
        component: 'currency-service',
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: rate.rate,
        effectiveDate: rate.effectiveDate
      })
    } catch (error) {
      structuredLogger.error('Failed to cache currency rate', error, {
        component: 'currency-service',
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: rate.rate,
        effectiveDate: rate.effectiveDate
      })
      // Don't throw - caching failure shouldn't break the flow
      // The rate was already fetched successfully
    }
  }
  
  /**
   * Fetch fresh rate from Xero API
   * First checks if we have recent Xero rates in the database
   * Falls back to hardcoded rates if not available
   */
  private static async fetchFreshRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    // First, check if we have a recent Xero rate in the database
    // This would have been populated during sync from actual Xero transactions
    const recentXeroRate = await prisma.currencyRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        source: 'xero',
        effectiveDate: {
          // Look for rates from the last 30 days
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    })
    
    if (recentXeroRate) {
      structuredLogger.info('Using Xero exchange rate from recent transactions', {
        component: 'currency-service',
        fromCurrency,
        toCurrency,
        rate: recentXeroRate.rate.toNumber(),
        effectiveDate: recentXeroRate.effectiveDate
      })
      return recentXeroRate.rate.toNumber()
    }
    
    // If no Xero rate available, use fallback rates
    structuredLogger.debug('No recent Xero rate found, using fallback rates', {
      component: 'currency-service',
      fromCurrency,
      toCurrency
    })
    
    return this.getFallbackRate(fromCurrency, toCurrency)
  }
  
  /**
   * Get fallback exchange rates
   * These are approximate rates for when API is unavailable
   */
  private static getFallbackRate(fromCurrency: string, toCurrency: string): number {
    // Convert everything to GBP first, then to target currency
    const toGBP: Record<string, number> = {
      'GBP': 1,
      'USD': 0.79,    // 1 USD = 0.79 GBP
      'EUR': 0.86,    // 1 EUR = 0.86 GBP
      'PKR': 0.0028,  // 1 PKR = 0.0028 GBP
      'SEK': 0.074,   // 1 SEK = 0.074 GBP
      'CAD': 0.58,    // 1 CAD = 0.58 GBP
      'AUD': 0.52,    // 1 AUD = 0.52 GBP
      'NZD': 0.49,    // 1 NZD = 0.49 GBP
      'INR': 0.0096,  // 1 INR = 0.0096 GBP
      'ZAR': 0.042,   // 1 ZAR = 0.042 GBP
    }
    
    const fromRate = toGBP[fromCurrency] || 1
    const toRate = toGBP[toCurrency] || 1
    
    // Convert: fromCurrency -> GBP -> toCurrency
    return fromRate / toRate
  }
  
  /**
   * Sync currency rates from Xero for all active currencies
   * This would be called during regular sync operations
   */
  static async syncCurrencyRates(
    currencies: string[],
    tx?: PrismaTransaction
  ): Promise<void> {
    structuredLogger.info('Syncing currency rates', {
      component: 'currency-service',
      currencies
    })
    
    const uniqueCurrencies = [...new Set(currencies)]
    const effectiveDate = new Date()
    
    for (const fromCurrency of uniqueCurrencies) {
      for (const toCurrency of uniqueCurrencies) {
        if (fromCurrency !== toCurrency) {
          try {
            await this.getExchangeRate(fromCurrency, toCurrency, effectiveDate, tx)
          } catch (error) {
            structuredLogger.error('Failed to sync rate', error, {
              component: 'currency-service',
              fromCurrency,
              toCurrency
            })
          }
        }
      }
    }
  }
  
  /**
   * Get all rates for a base currency
   */
  static async getAllRatesForCurrency(baseCurrency: string): Promise<Record<string, number>> {
    const rates: Record<string, number> = { [baseCurrency]: 1 }
    
    // Get all recent rates from database
    const recentRates = await prisma.currencyRate.findMany({
      where: {
        fromCurrency: baseCurrency,
        effectiveDate: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      },
      distinct: ['toCurrency']
    })
    
    for (const rate of recentRates) {
      rates[rate.toCurrency] = rate.rate.toNumber()
    }
    
    return rates
  }
}