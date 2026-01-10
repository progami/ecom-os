# Amazon SP-API Integration Plan for Kairos

## Executive Summary

This plan outlines the integration of Amazon Selling Partner API (SP-API) data sources into Kairos for time series forecasting. The integration will enable users to import Amazon marketplace data alongside existing Google Trends data.

---

## Data Sources Overview

| Data Source | API | Priority | Unique Value |
|-------------|-----|----------|--------------|
| **Brand Analytics** | Reports API | P0 | Search frequency, conversion, market basket |
| **Seller Economics** | Data Kiosk | P1 | Profitability, net proceeds per ASIN |
| **Vendor Forecasting** | Data Kiosk | P1 | 48-week demand predictions |
| **Customer Feedback** | Customer Feedback API | P2 | Review trends, sentiment signals |

---

## Phase 1: Authentication & Infrastructure

### 1.1 SP-API App Registration

**Prerequisites:**
- Amazon Seller/Vendor Central account
- Developer registration at [developer.amazonservices.com](https://developer.amazonservices.com)

**Credentials Required:**
```
LWA_CLIENT_ID        # Login with Amazon client ID
LWA_CLIENT_SECRET    # Login with Amazon client secret
AWS_ACCESS_KEY       # For SP-API signing
AWS_SECRET_KEY       # For SP-API signing
```

### 1.2 OAuth 2.0 Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Kairos    │────▶│   Amazon    │────▶│   Seller    │
│   Sources   │     │   OAuth     │     │   Central   │
│    Page     │◀────│   Server    │◀────│   Consent   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                        │
      │         refresh_token stored           │
      └────────────────────────────────────────┘
```

**Flow Steps:**
1. User clicks "Connect Amazon Account" in Kairos
2. Redirect to Amazon authorization URL
3. User grants permissions in Seller Central
4. Amazon redirects back with `authorization_code`
5. Exchange code for `refresh_token` (store securely)
6. Use refresh token to get short-lived `access_token` for API calls

### 1.3 Database Schema

```sql
-- Store connected Amazon accounts
CREATE TABLE amazon_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  seller_id VARCHAR(255) NOT NULL,
  marketplace_id VARCHAR(50) NOT NULL,
  refresh_token TEXT NOT NULL ENCRYPTED,
  roles TEXT[] NOT NULL, -- ['BRAND_ANALYTICS', 'SELLING_PARTNER_INSIGHTS']
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, seller_id, marketplace_id)
);

-- Track imported Amazon time series
CREATE TABLE amazon_time_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES amazon_connections(id),
  source_type VARCHAR(50) NOT NULL, -- 'BRAND_ANALYTICS', 'DATA_KIOSK_ECONOMICS', etc.
  asin VARCHAR(20),
  query_params JSONB NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'PENDING'
);
```

### 1.4 Environment Configuration

```env
# apps/kairos/.env.local

# Amazon SP-API
AMAZON_LWA_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_LWA_CLIENT_SECRET=xxxxx
AMAZON_AWS_ACCESS_KEY=AKIAXXXXX
AMAZON_AWS_SECRET_KEY=xxxxx
AMAZON_SP_API_ENDPOINT=https://sellingpartnerapi-na.amazon.com

# Supported regions
AMAZON_SP_API_REGIONS=NA,EU,FE
```

---

## Phase 2: Brand Analytics Integration (Reports API)

### 2.1 Available Reports

| Report Type | Data | Granularity | Use Case |
|-------------|------|-------------|----------|
| `GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT` | Top search terms, click share | DAY/WEEK/MONTH | Keyword trend forecasting |
| `GET_BRAND_ANALYTICS_MARKET_BASKET_REPORT` | Co-purchased items | DAY/WEEK/MONTH | Bundle opportunity signals |
| `GET_BRAND_ANALYTICS_REPEAT_PURCHASE_REPORT` | Repeat purchase rate | WEEK/MONTH | Customer loyalty trends |
| `GET_BRAND_ANALYTICS_SEARCH_CATALOG_PERFORMANCE_REPORT` | Impressions, clicks, cart adds | WEEK/MONTH | Conversion funnel metrics |

### 2.2 API Integration

**Endpoint:** `POST /reports/2021-06-30/reports`

**Request Flow:**
```
1. createReport()     → Returns reportId
2. poll getReport()   → Wait for status: DONE
3. getReportDocument() → Get download URL
4. Download & parse   → Extract time series
```

**Example: Search Terms Report**
```typescript
// lib/amazon/brand-analytics.ts

interface SearchTermsReportOptions {
  marketplaceId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  reportPeriod: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER';
}

async function requestSearchTermsReport(
  connection: AmazonConnection,
  options: SearchTermsReportOptions
): Promise<string> {
  const client = await getSpApiClient(connection);

  const response = await client.post('/reports/2021-06-30/reports', {
    reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
    marketplaceIds: [options.marketplaceId],
    dataStartTime: `${options.startDate}T00:00:00Z`,
    dataEndTime: `${options.endDate}T23:59:59Z`,
    reportOptions: {
      reportPeriod: options.reportPeriod,
    },
  });

  return response.data.reportId;
}
```

### 2.3 Data Transformation

**Search Terms Report → Time Series:**
```typescript
interface SearchTermRecord {
  searchTerm: string;
  searchFrequencyRank: number;
  clickedAsin1: string;
  clickedAsin1ClickShare: number;
  // ... more fields
}

function transformToTimeSeries(
  records: SearchTermRecord[],
  date: string,
  searchTerm: string
): TimeSeriesPoint[] {
  const filtered = records.filter(r => r.searchTerm === searchTerm);

  return filtered.map(record => ({
    ds: date,
    y: record.searchFrequencyRank, // Lower = more popular
    // Or use click share as the metric
  }));
}
```

### 2.4 UI Components

**Import Modal - Brand Analytics Tab:**
```
┌────────────────────────────────────────────────────────────┐
│ Import from Brand Analytics                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Report Type: [Search Terms Report        ▼]               │
│                                                            │
│  Search Term: [_______________________________]            │
│               Filter to specific keyword                   │
│                                                            │
│  ASIN (optional): [__________]                             │
│                                                            │
│  Date Range: [2024-01-01] to [2025-01-01]                  │
│                                                            │
│  Granularity: ○ Daily  ● Weekly  ○ Monthly                 │
│                                                            │
│  Marketplace: [United States (ATVPDKIKX0DER) ▼]            │
│                                                            │
│                              [Cancel]  [Import Series]     │
└────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Data Kiosk Integration (GraphQL)

### 3.1 Seller Economics Dataset

**Unique Metrics Available:**
- `orderedProductSales` - Gross sales
- `shippedProductSales` - Fulfilled sales
- `totalAdSpend` - PPC costs
- `fbaFees` - Fulfillment fees
- `referralFees` - Amazon commission
- `otherFees` - Additional fees
- `offAmazonCosts` - User-input COGS
- `netProceeds` - **True profitability**

**GraphQL Query Example:**
```graphql
query SellerEconomics($startDate: Date!, $endDate: Date!, $asin: String) {
  analytics_salesAndTraffic_2024_Q1 {
    salesAndTraffic(
      startDate: $startDate
      endDate: $endDate
      aggregateBy: [DATE, ASIN]
      filter: { asin: { equals: $asin } }
    ) {
      date
      asin
      orderedProductSales { amount, currencyCode }
      totalAdSpend { amount, currencyCode }
      fbaFees { amount, currencyCode }
      referralFees { amount, currencyCode }
      netProceeds { amount, currencyCode }
    }
  }
}
```

### 3.2 Vendor Forecasting Dataset

**Unique Metrics:**
- `forecastedDemandMean` - Average expected demand
- `forecastedDemandP70` - 70th percentile
- `forecastedDemandP80` - 80th percentile
- `forecastedDemandP90` - 90th percentile
- Forecast horizon: **Weeks 0-47**

**GraphQL Query Example:**
```graphql
query VendorForecast($asin: String!) {
  analytics_vendorAnalytics_2024_09_30 {
    analytics(
      aggregateBy: [ASIN, WEEK]
      filter: { asin: { equals: $asin } }
    ) {
      asin
      weekStartDate
      forecastedDemandMean
      forecastedDemandP70
      forecastedDemandP80
      forecastedDemandP90
    }
  }
}
```

### 3.3 API Integration

**Endpoint:** `POST /datakiosk/2023-11-15/queries`

**Request Flow:**
```
1. createQuery()    → Submit GraphQL, get queryId
2. Subscribe to notification OR poll getQuery()
3. getDocument()    → Download JSONL results
4. Parse JSONL      → Extract time series
```

**Implementation:**
```typescript
// lib/amazon/data-kiosk.ts

interface DataKioskQuery {
  query: string;
  variables?: Record<string, unknown>;
}

async function executeDataKioskQuery(
  connection: AmazonConnection,
  graphqlQuery: DataKioskQuery
): Promise<string> {
  const client = await getSpApiClient(connection);

  const response = await client.post('/datakiosk/2023-11-15/queries', {
    query: graphqlQuery.query,
  });

  return response.data.queryId;
}

async function pollQueryResult(
  connection: AmazonConnection,
  queryId: string
): Promise<DataKioskResult> {
  const client = await getSpApiClient(connection);

  while (true) {
    const response = await client.get(`/datakiosk/2023-11-15/queries/${queryId}`);

    if (response.data.processingStatus === 'DONE') {
      const docId = response.data.dataDocumentId;
      const docResponse = await client.get(`/datakiosk/2023-11-15/documents/${docId}`);
      return downloadAndParseJSONL(docResponse.data.documentUrl);
    }

    if (response.data.processingStatus === 'FATAL') {
      throw new Error(`Query failed: ${response.data.errorDocumentId}`);
    }

    await sleep(5000); // Poll every 5 seconds
  }
}
```

### 3.4 JSONL Parsing

```typescript
// lib/amazon/jsonl-parser.ts

async function parseJSONLStream(url: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(url);
  const text = await response.text();

  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function transformEconomicsToTimeSeries(
  records: EconomicsRecord[],
  metric: 'netProceeds' | 'orderedProductSales' | 'totalAdSpend'
): TimeSeriesPoint[] {
  return records.map(record => ({
    ds: record.date,
    y: record[metric]?.amount ?? 0,
  }));
}
```

---

## Phase 4: Customer Feedback API (P2)

### 4.1 Available Operations

| Operation | Data | Use Case |
|-----------|------|----------|
| `getItemReviewTopics` | ASIN review themes | Sentiment trends |
| `getItemReviewTrends` | Month-on-month trends | Review velocity |
| `getBrowseNodeReviewTopics` | Category-level insights | Market sentiment |

### 4.2 Limitations

- **Marketplaces:** US, UK, FR, IT, DE, ES, JP only
- **Language:** English only
- **Refresh:** Weekly
- **Missing:** Full Product Opportunity Explorer data (niches, search terms)

### 4.3 Integration (Lower Priority)

```typescript
// lib/amazon/customer-feedback.ts

async function getReviewTrends(
  connection: AmazonConnection,
  asin: string
): Promise<ReviewTrend[]> {
  const client = await getSpApiClient(connection);

  const response = await client.get(
    `/customerFeedback/2024-06-01/items/${asin}/reviewTrends`
  );

  return response.data.trends;
}
```

---

## Phase 5: File Structure

```
apps/kairos/
├── lib/
│   └── amazon/
│       ├── client.ts              # SP-API client factory
│       ├── auth.ts                # OAuth token management
│       ├── brand-analytics.ts     # Reports API integration
│       ├── data-kiosk.ts          # Data Kiosk GraphQL
│       ├── customer-feedback.ts   # Customer Feedback API
│       ├── jsonl-parser.ts        # JSONL stream parser
│       └── types.ts               # TypeScript interfaces
├── app/
│   └── api/
│       └── v1/
│           └── amazon/
│               ├── connect/
│               │   └── route.ts   # OAuth initiation
│               ├── callback/
│               │   └── route.ts   # OAuth callback
│               ├── reports/
│               │   └── route.ts   # Brand Analytics imports
│               └── data-kiosk/
│                   └── route.ts   # Data Kiosk queries
├── components/
│   └── sources/
│       ├── data-sources-panel.tsx      # Main panel (existing)
│       ├── amazon-connect-button.tsx   # OAuth connect
│       ├── brand-analytics-form.tsx    # BA import form
│       └── data-kiosk-form.tsx         # DK import form
└── prisma/
    └── migrations/
        └── xxx_amazon_connections.sql
```

---

## Phase 6: UI/UX Design

### 6.1 Updated Source Selection Modal

```
┌────────────────────────────────────────────────────────────┐
│ ← Import Data Source                               [X]     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  📈              │  │  🔶              │                │
│  │  Google Trends   │  │  Brand Analytics │                │
│  │                  │  │                  │                │
│  │  Search interest │  │  Search terms,   │                │
│  │  over time       │  │  conversions     │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  💰              │  │  📊              │                │
│  │  Seller          │  │  Vendor          │                │
│  │  Economics       │  │  Forecasting     │                │
│  │                  │  │                  │                │
│  │  Profitability,  │  │  48-week demand  │                │
│  │  net proceeds    │  │  predictions     │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  💬              │  │  🌿              │                │
│  │  Customer        │  │  Jungle Scout    │                │
│  │  Feedback        │  │  Coming Soon     │                │
│  │                  │  │                  │                │
│  │  Review trends,  │  │  Product         │                │
│  │  sentiment       │  │  research        │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Amazon Connection Flow

```
┌────────────────────────────────────────────────────────────┐
│ Connect Amazon Account                             [X]     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│     ┌─────────────────────────────────────────┐            │
│     │                                         │            │
│     │           🔐 Amazon SP-API              │            │
│     │                                         │            │
│     │   Connect your Seller Central account   │            │
│     │   to import marketplace data            │            │
│     │                                         │            │
│     └─────────────────────────────────────────┘            │
│                                                            │
│  Requirements:                                             │
│  ✓ Active Seller Central account                          │
│  ✓ Brand Registry enrollment (for Brand Analytics)        │
│  ✓ Selling Partner Insights role (for Economics)          │
│                                                            │
│  Marketplace: [United States ▼]                            │
│                                                            │
│            [Connect with Amazon]                           │
│                                                            │
│  By connecting, you authorize Kairos to access your        │
│  Amazon selling data for forecasting purposes.             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Phase 7: Rate Limits & Error Handling

### 7.1 Rate Limits

| API | Rate Limit | Burst |
|-----|------------|-------|
| Reports API | 0.0222 req/sec | 10 |
| Data Kiosk | 0.0167 req/sec | 5 |
| Customer Feedback | 1 req/sec | 5 |

### 7.2 Error Handling

```typescript
// lib/amazon/errors.ts

class AmazonApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public retryAfter?: number
  ) {
    super(message);
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AmazonApiError) {
        if (error.code === 'QuotaExceeded' && error.retryAfter) {
          await sleep(error.retryAfter * 1000);
          continue;
        }
        if (error.code === 'Unauthorized') {
          await refreshAccessToken();
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Phase 8: Implementation Roadmap

### Sprint 1: Foundation (Week 1-2)
- [ ] Set up SP-API developer account
- [ ] Implement OAuth 2.0 flow
- [ ] Create database schema for connections
- [ ] Build `AmazonConnection` management UI

### Sprint 2: Brand Analytics (Week 3-4)
- [ ] Implement Reports API client
- [ ] Build Search Terms Report import
- [ ] Add Market Basket Report import
- [ ] Create Brand Analytics form in modal

### Sprint 3: Data Kiosk (Week 5-6)
- [ ] Implement Data Kiosk GraphQL client
- [ ] Build Seller Economics import
- [ ] Add Vendor Forecasting import (if vendor access)
- [ ] JSONL parsing and transformation

### Sprint 4: Polish & Testing (Week 7-8)
- [ ] Error handling and retry logic
- [ ] Rate limit management
- [ ] UI polish and loading states
- [ ] End-to-end testing
- [ ] Documentation

---

## Phase 9: Security Considerations

### 9.1 Token Storage
- Store `refresh_token` encrypted at rest
- Never log tokens
- Rotate tokens on suspected compromise

### 9.2 Data Access
- Request minimum required scopes
- Audit log all data imports
- Allow users to revoke access

### 9.3 Compliance
- Follow Amazon's Acceptable Use Policy
- Don't store PII beyond what's needed
- Implement data retention policies

---

## Phase 10: Cost Considerations

### 10.1 Amazon SP-API Pricing
- **Starting January 31, 2026:** $1,400 USD/year subscription fee
- Currently free during transition period

### 10.2 Infrastructure Costs
- Additional database storage for Amazon data
- Increased API call volume
- Background job processing for report polling

---

## Appendix A: Marketplace IDs

| Marketplace | ID | Region |
|-------------|-----|--------|
| United States | ATVPDKIKX0DER | NA |
| Canada | A2EUQ1WTGCTBG2 | NA |
| Mexico | A1AM78C64UM0Y8 | NA |
| Brazil | A2Q3Y263D00KWC | NA |
| United Kingdom | A1F83G8C2ARO7P | EU |
| Germany | A1PA6795UKMFR9 | EU |
| France | A13V1IB3VIYBER | EU |
| Italy | APJ6JRA9NG5V4 | EU |
| Spain | A1RKKUPIHCS9HS | EU |
| Japan | A1VC38T7YXB528 | FE |
| Australia | A39IBJ37TRP1C6 | FE |

---

## Appendix B: Required Roles

| Data Source | Required Role | How to Get |
|-------------|---------------|------------|
| Brand Analytics | Brand Analytics | Brand Registry enrollment |
| Seller Economics | Selling Partner Insights | Seller Central settings |
| Vendor Analytics | Brand Analytics | Vendor Central + Brand Registry |
| Customer Feedback | Brand Analytics OR Selling Partner Insights | Either role |

---

## References

- [SP-API Documentation](https://developer-docs.amazon.com/sp-api)
- [SP-API Endpoints](https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints)
- [Data Kiosk Guide](https://developer-docs.amazon.com/sp-api/docs/data-kiosk-api-v2023-11-15-use-case-guide)
- [Brand Analytics Reports](https://developer-docs.amazon.com/sp-api/docs/report-type-values-analytics)
- [Customer Feedback API](https://developer-docs.amazon.com/sp-api/docs/customer-feedback-api-v2024-06-01-use-case-guide)
- [GitHub SP-API Models](https://github.com/amzn/selling-partner-api-models)
