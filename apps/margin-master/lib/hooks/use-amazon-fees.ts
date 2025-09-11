import { useQuery } from '@tanstack/react-query';
import {
  CountryDTO,
  ProgramDTO,
  FulfilmentFeeDTO,
  StorageFeeDTO,
  ReferralFeeDTO,
  CalculateFeesRequest,
  CalculateFeesResponse,
} from '@/lib/types';

// Countries Hook
export function useCountries(options?: {
  includePrograms?: boolean;
  activeOnly?: boolean;
  region?: string;
}) {
  const queryParams = new URLSearchParams();
  if (options?.includePrograms !== undefined) {
    queryParams.append('includePrograms', String(options.includePrograms));
  }
  if (options?.activeOnly !== undefined) {
    queryParams.append('activeOnly', String(options.activeOnly));
  }
  if (options?.region) {
    queryParams.append('region', options.region);
  }

  return useQuery<{
    countries: CountryDTO[];
    total: number;
    regions: string[];
    currencies: string[];
  }>({
    queryKey: ['amazon-fees', 'countries', options],
    queryFn: async () => {
      const response = await fetch(`/api/amazon-fees/countries?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch countries');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Programs Hook
export function usePrograms(options?: {
  country?: string;
  activeOnly?: boolean;
  includeCountries?: boolean;
}) {
  const queryParams = new URLSearchParams();
  if (options?.country) {
    queryParams.append('country', options.country);
  }
  if (options?.activeOnly !== undefined) {
    queryParams.append('activeOnly', String(options.activeOnly));
  }
  if (options?.includeCountries !== undefined) {
    queryParams.append('includeCountries', String(options.includeCountries));
  }

  return useQuery<{
    programs: ProgramDTO[];
    total: number;
    feeTypesSummary: {
      fulfilment: number;
      storage: number;
      referral: number;
      optionalServices: number;
      surcharges: number;
    };
  }>({
    queryKey: ['amazon-fees', 'programs', options],
    queryFn: async () => {
      const response = await fetch(`/api/amazon-fees/programs?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch programs');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fulfilment Fees Hook
export function useFulfilmentFees(options?: {
  country?: string;
  countries?: string[];
  program?: string;
  sizeTier?: string;
  minWeight?: number;
  maxWeight?: number;
  isApparel?: boolean;
  activeOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (options?.country) {
    queryParams.append('country', options.country);
  }
  if (options?.countries?.length) {
    queryParams.append('countries', options.countries.join(','));
  }
  if (options?.program) {
    queryParams.append('program', options.program);
  }
  if (options?.sizeTier) {
    queryParams.append('sizeTier', options.sizeTier);
  }
  if (options?.minWeight !== undefined) {
    queryParams.append('minWeight', String(options.minWeight));
  }
  if (options?.maxWeight !== undefined) {
    queryParams.append('maxWeight', String(options.maxWeight));
  }
  if (options?.isApparel !== undefined) {
    queryParams.append('isApparel', String(options.isApparel));
  }
  if (options?.activeOnly !== undefined) {
    queryParams.append('activeOnly', String(options.activeOnly));
  }
  if (options?.page !== undefined) {
    queryParams.append('page', String(options.page));
  }
  if (options?.limit !== undefined) {
    queryParams.append('limit', String(options.limit));
  }

  return useQuery<{
    fees: FulfilmentFeeDTO[];
    total: number;
    filters: {
      countries: string[];
      programs: string[];
      sizeTiers: string[];
      currencies: string[];
    };
  }>({
    queryKey: ['amazon-fees', 'fulfilment-fees', options],
    queryFn: async () => {
      const response = await fetch(`/api/amazon-fees/fulfilment-fees?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch fulfilment fees');
      return response.json();
    },
    enabled: !!(options?.country || options?.countries?.length),
  });
}

// Storage Fees Hook
export function useStorageFees(options?: {
  country?: string;
  countries?: string[];
  program?: string;
  periodType?: 'PEAK' | 'OFF_PEAK';
  activeOnly?: boolean;
}) {
  const queryParams = new URLSearchParams();
  if (options?.country) {
    queryParams.append('country', options.country);
  }
  if (options?.countries?.length) {
    queryParams.append('countries', options.countries.join(','));
  }
  if (options?.program) {
    queryParams.append('program', options.program);
  }
  if (options?.periodType) {
    queryParams.append('periodType', options.periodType);
  }
  if (options?.activeOnly !== undefined) {
    queryParams.append('activeOnly', String(options.activeOnly));
  }

  return useQuery<{
    fees: StorageFeeDTO[];
    total: number;
    summary: {
      byCountry: {
        [countryCode: string]: {
          currency: string;
          periods: Array<{
            period: string;
            standardSize: number;
            oversize: number;
          }>;
        };
      };
    };
  }>({
    queryKey: ['amazon-fees', 'storage-fees', options],
    queryFn: async () => {
      const response = await fetch(`/api/amazon-fees/storage-fees?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch storage fees');
      return response.json();
    },
    enabled: !!(options?.country || options?.countries?.length),
  });
}

// Referral Fees Hook
export function useReferralFees(options?: {
  country?: string;
  countries?: string[];
  program?: string;
  category?: string;
  groupByCategory?: boolean;
  activeOnly?: boolean;
}) {
  const queryParams = new URLSearchParams();
  if (options?.country) {
    queryParams.append('country', options.country);
  }
  if (options?.countries?.length) {
    queryParams.append('countries', options.countries.join(','));
  }
  if (options?.program) {
    queryParams.append('program', options.program);
  }
  if (options?.category) {
    queryParams.append('category', options.category);
  }
  if (options?.groupByCategory !== undefined) {
    queryParams.append('groupByCategory', String(options.groupByCategory));
  }
  if (options?.activeOnly !== undefined) {
    queryParams.append('activeOnly', String(options.activeOnly));
  }

  return useQuery<{
    fees: ReferralFeeDTO[];
    total: number;
    categories: Array<{
      name: string;
      count: number;
    }>;
    summary: {
      byCountry: {
        [countryCode: string]: {
          currency: string;
          categoriesCount: number;
          averagePercentage: number;
        };
      };
    };
  }>({
    queryKey: ['amazon-fees', 'referral-fees', options],
    queryFn: async () => {
      const response = await fetch(`/api/amazon-fees/referral-fees?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch referral fees');
      return response.json();
    },
    enabled: !!(options?.country || options?.countries?.length),
  });
}

// Fee Calculator Hook
export function useCalculateFees() {
  return useQuery<CalculateFeesResponse, Error, CalculateFeesResponse, [string, string, CalculateFeesRequest | null]>({
    queryKey: ['amazon-fees', 'calculate', null],
    queryFn: async ({ queryKey }) => {
      const [, , request] = queryKey;
      if (!request) throw new Error('No calculation request provided');

      const response = await fetch('/api/amazon-fees/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to calculate fees');
      }

      return response.json();
    },
    enabled: false,
  });
}