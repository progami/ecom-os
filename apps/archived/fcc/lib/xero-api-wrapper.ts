import { XeroClient } from 'xero-node';
import { structuredLogger } from './logger';
import { XeroErrorHandler } from './xero-error-handler';
import { XeroApiCache, CacheOptions } from './xero-api-cache';

// Current Xero API version as of 2024
const XERO_API_VERSION = '2.0';

export interface XeroApiOptions {
  cache?: boolean;
  cacheTtl?: number;
  retryEnabled?: boolean;
  maxRetries?: number;
}

export class XeroApiWrapper {
  private client: XeroClient;
  private tenantId: string;

  constructor(client: XeroClient, tenantId: string) {
    this.client = client;
    this.tenantId = tenantId;
    
    // Add API version header to all requests
    this.addApiVersionHeader();
  }

  private addApiVersionHeader(): void {
    // The Xero SDK doesn't directly expose axios config, but we can intercept
    // through the underlying OAuth2 client
    const oauth2 = (this.client as any).oauth2;
    if (oauth2 && oauth2.axios) {
      oauth2.axios.interceptors.request.use((config: any) => {
        config.headers = config.headers || {};
        config.headers['Xero-Api-Version'] = XERO_API_VERSION;
        return config;
      });
    }
  }

  // Accounting API wrapper with caching and error handling
  get accountingApi() {
    const originalApi = this.client.accountingApi;
    const tenantId = this.tenantId;
    
    return new Proxy(originalApi, {
      get(target: any, prop: string) {
        const original = target[prop];
        
        // If it's not a function, return as is
        if (typeof original !== 'function') {
          return original;
        }
        
        // Wrap the function
        return async (...args: any[]) => {
          const operation = `accountingApi.${prop}`;
          
          // Log API call
          structuredLogger.debug(`Xero API call: ${operation}`, {
            component: 'xero-api-wrapper',
            operation,
            tenantId
          });
          
          // Execute with error handling and retry
          return XeroErrorHandler.withRetry(
            async () => {
              const result = await original.apply(target, args);
              
              // Log successful response
              structuredLogger.debug(`Xero API success: ${operation}`, {
                component: 'xero-api-wrapper',
                operation,
                tenantId
              });
              
              return result;
            },
            { operation, tenantId }
          );
        };
      }
    });
  }

  // Cached GL Accounts
  async getCachedGLAccounts(options?: { where?: string; order?: string }) {
    const cacheOptions: CacheOptions = {
      ttl: XeroApiCache.TTL.GL_ACCOUNTS,
      tenantId: this.tenantId
    };
    
    return XeroApiCache.withCache(
      'gl-accounts',
      cacheOptions,
      async () => {
        const response = await this.accountingApi.getAccounts(
          this.tenantId,
          undefined, // If-Modified-Since
          options?.where,
          options?.order
        );
        return response.body;
      },
      options
    );
  }

  // Cached Chart of Accounts
  async getCachedChartOfAccounts() {
    const cacheOptions: CacheOptions = {
      ttl: XeroApiCache.TTL.CHART_OF_ACCOUNTS,
      tenantId: this.tenantId
    };
    
    return XeroApiCache.withCache(
      'chart-of-accounts',
      cacheOptions,
      async () => {
        const response = await this.accountingApi.getAccounts(this.tenantId);
        return response.body;
      }
    );
  }

  // Cached Tax Rates
  async getCachedTaxRates() {
    const cacheOptions: CacheOptions = {
      ttl: XeroApiCache.TTL.TAX_RATES,
      tenantId: this.tenantId
    };
    
    return XeroApiCache.withCache(
      'tax-rates',
      cacheOptions,
      async () => {
        const response = await this.accountingApi.getTaxRates(this.tenantId);
        return response.body;
      }
    );
  }

  // Cached Organisation Info
  async getCachedOrganisation() {
    const cacheOptions: CacheOptions = {
      ttl: XeroApiCache.TTL.ORGANISATIONS,
      tenantId: this.tenantId
    };
    
    return XeroApiCache.withCache(
      'organisation',
      cacheOptions,
      async () => {
        const response = await this.accountingApi.getOrganisations(this.tenantId);
        return response.body;
      }
    );
  }

  // Cached Reports with parameters
  async getCachedReport(reportType: string, params?: Record<string, any>) {
    const cacheOptions: CacheOptions = {
      ttl: XeroApiCache.TTL.REPORTS,
      tenantId: this.tenantId
    };
    
    return XeroApiCache.withCache(
      `report-${reportType}`,
      cacheOptions,
      async () => {
        // Call the appropriate report method based on type
        switch (reportType) {
          case 'TrialBalance':
            return await this.accountingApi.getReportTrialBalance(
              this.tenantId,
              params?.date,
              params?.paymentsOnly,
              params?.standardLayout
            );
          case 'ProfitAndLoss':
            return await this.accountingApi.getReportProfitAndLoss(
              this.tenantId,
              params?.fromDate,
              params?.toDate,
              params?.periods,
              params?.timeframe,
              params?.trackingCategoryID,
              params?.trackingCategoryID2,
              params?.trackingOptionID,
              params?.trackingOptionID2,
              params?.standardLayout,
              params?.paymentsOnly
            );
          case 'BalanceSheet':
            return await this.accountingApi.getReportBalanceSheet(
              this.tenantId,
              params?.date,
              params?.periods,
              params?.timeframe,
              params?.trackingCategoryID,
              params?.trackingCategoryID2,
              params?.trackingOptionID,
              params?.trackingOptionID2,
              params?.standardLayout,
              params?.paymentsOnly
            );
          default:
            throw new Error(`Unknown report type: ${reportType}`);
        }
      },
      params
    );
  }

  // Invalidate cache methods
  async invalidateGLAccountsCache() {
    await XeroApiCache.invalidate('gl-accounts', this.tenantId);
  }

  async invalidateAllCaches() {
    await XeroApiCache.invalidateTenant(this.tenantId);
  }

  // Helper to create wrapper from existing client
  static create(client: XeroClient, tenantId: string): XeroApiWrapper {
    return new XeroApiWrapper(client, tenantId);
  }
}