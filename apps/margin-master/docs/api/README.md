# Amazon Fees API Documentation

## Overview
This API provides comprehensive access to Amazon marketplace fees data, including fulfilment fees, storage fees, referral fees, and fee calculations.

## Base URL
```
/api/amazon-fees
```

## Endpoints

### 1. Countries
**GET** `/api/amazon-fees/countries`

Lists all countries with their associated fee data.

#### Query Parameters
- `includePrograms` (boolean): Include available programs for each country
- `activeOnly` (boolean, default: true): Filter only active countries
- `region` (string): Filter by region

#### Response
```typescript
{
  countries: CountryDTO[],
  total: number,
  regions: string[],
  currencies: string[]
}
```

### 2. Programs
**GET** `/api/amazon-fees/programs`

Lists all available programs (FBA, MCF, etc.).

#### Query Parameters
- `country` (string): Filter programs available in specific country
- `activeOnly` (boolean, default: true): Filter only active programs
- `includeCountries` (boolean): Include countries where program is available

#### Response
```typescript
{
  programs: ProgramDTO[],
  total: number,
  feeTypesSummary: {
    fulfilment: number,
    storage: number,
    referral: number,
    optionalServices: number,
    surcharges: number
  }
}
```

### 3. Fulfilment Fees
**GET** `/api/amazon-fees/fulfilment-fees`

Get fulfilment fees with advanced filtering.

#### Query Parameters
- `country` (string): Single country code
- `countries` (string): Comma-separated country codes
- `program` (string, default: 'FBA'): Program code
- `sizeTier` (string): Filter by size tier name
- `minWeight` (number): Minimum weight in kg
- `maxWeight` (number): Maximum weight in kg
- `isApparel` (boolean): Filter apparel items
- `activeOnly` (boolean, default: true): Filter only active fees
- `page` (number, default: 1): Page number
- `limit` (number, default: 100): Items per page

#### Response
```typescript
{
  fees: FulfilmentFeeDTO[],
  total: number,
  filters: {
    countries: string[],
    programs: string[],
    sizeTiers: string[],
    currencies: string[]
  }
}
```

### 4. Storage Fees
**GET** `/api/amazon-fees/storage-fees`

Get storage fees by country and period.

#### Query Parameters
- `country` (string): Single country code
- `countries` (string): Comma-separated country codes
- `program` (string, default: 'FBA'): Program code
- `periodType` (string): PEAK or OFF_PEAK
- `activeOnly` (boolean, default: true): Filter only active fees

#### Response
```typescript
{
  fees: StorageFeeDTO[],
  total: number,
  summary: {
    byCountry: {
      [countryCode]: {
        currency: string,
        periods: Array<{
          period: string,
          standardSize: number,
          oversize: number
        }>
      }
    }
  }
}
```

**POST** `/api/amazon-fees/storage-fees?type=utilization-surcharges`

Get storage utilization surcharges.

#### Request Body
```typescript
{
  countryCode: string,
  programCode: string,
  utilizationRatio: number
}
```

**POST** `/api/amazon-fees/storage-fees?type=aged-inventory`

Get aged inventory surcharges.

#### Request Body
```typescript
{
  countryCode: string,
  programCode: string,
  daysInInventory: number
}
```

### 5. Referral Fees
**GET** `/api/amazon-fees/referral-fees`

Get referral fees by category.

#### Query Parameters
- `country` (string): Single country code
- `countries` (string): Comma-separated country codes
- `program` (string, default: 'FBA'): Program code
- `category` (string): Filter by category name
- `groupByCategory` (boolean): Group results by category
- `activeOnly` (boolean, default: true): Filter only active fees

#### Response
```typescript
{
  fees: ReferralFeeDTO[],
  total: number,
  categories: CategorySummaryDTO[],
  summary: {
    byCountry: {
      [countryCode]: {
        currency: string,
        categoriesCount: number,
        averagePercentage: number
      }
    }
  }
}
```

### 6. Calculate Fees
**POST** `/api/amazon-fees/calculate`

Calculate total fees for a product.

#### Request Body
```typescript
{
  product: {
    name?: string,
    category: string,
    dimensions: {
      length: number,  // cm
      width: number,   // cm
      height: number   // cm
    },
    weight: number,    // grams
    price: number,     // sale price
    cost?: number,     // product cost
    isApparel?: boolean
  },
  marketplace: {
    countryCode: string,
    programCode?: string  // defaults to 'FBA'
  },
  options?: {
    includeStorageFees?: boolean,
    storageDuration?: number,      // days
    utilizationRatio?: number,     // 0-1
    includeOptionalServices?: string[],
    includeSurcharges?: boolean,
    returnRate?: number            // percentage
  }
}
```

#### Response
```typescript
{
  request: CalculateFeesRequest,
  marketplace: {
    country: string,
    currency: string,
    program: string
  },
  product: {
    sizeTier: string,
    weightBand: string,
    category: string,
    isOversized: boolean
  },
  fees: {
    fulfilment: FeeBreakdown,
    referral: FeeBreakdown,
    storage?: FeeBreakdown,
    optionalServices?: FeeBreakdown[],
    surcharges?: FeeBreakdown[],
    total: {
      amount: number,
      currency: string,
      percentageOfPrice: number
    }
  },
  profitability?: {
    grossRevenue: number,
    totalFees: number,
    netRevenue: number,
    productCost?: number,
    netProfit?: number,
    profitMargin?: number,
    roi?: number
  },
  warnings?: string[]
}
```

## Error Handling

All endpoints return standard error responses:

```typescript
{
  error: string
}
```

HTTP Status Codes:
- 200: Success
- 400: Bad Request (invalid parameters)
- 500: Internal Server Error

## Examples

### Calculate fees for a product
```bash
curl -X POST /api/amazon-fees/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "category": "Electronics",
      "dimensions": { "length": 20, "width": 15, "height": 10 },
      "weight": 500,
      "price": 29.99,
      "cost": 10
    },
    "marketplace": {
      "countryCode": "GB",
      "programCode": "FBA"
    },
    "options": {
      "includeStorageFees": true,
      "storageDuration": 30
    }
  }'
```

### Get fulfilment fees for multiple countries
```bash
curl "/api/amazon-fees/fulfilment-fees?countries=GB,DE,FR&program=FBA&minWeight=0.1&maxWeight=1"
```

### Get referral fees grouped by category
```bash
curl "/api/amazon-fees/referral-fees?countries=GB,US&groupByCategory=true"
```