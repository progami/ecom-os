# Bookkeeper Automation Script

This TypeScript automation script fetches categorization rules from the Ecom OS API and applies them to Xero transactions.

## Phase 1 - Read-Only Mode

Currently, this script operates in read-only mode:
- Fetches active categorization rules from the API
- Simulates connection to Xero API
- Processes mock transactions and shows which rules would apply
- Does NOT make any changes to Xero

## Setup

1. Install dependencies:
   ```bash
   cd bookkeeper
   npm install
   ```

2. Configure environment variables in the parent `.env` file:
   ```
   XERO_CLIENT_ID=your_xero_client_id
   XERO_CLIENT_SECRET=your_xero_client_secret
   API_BASE_URL=http://localhost:3000
   ```

## Usage

Run the automation script:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## How It Works

1. **Fetch Rules**: Retrieves active categorization rules from `/api/v1/bookkeeping/rules`
2. **Connect to Xero**: Establishes connection (simulated in Phase 1)
3. **Fetch Transactions**: Gets uncategorized transactions (mock data in Phase 1)
4. **Apply Rules**: Matches transactions against rules based on:
   - Match Field: description, payee, or reference
   - Match Type: contains, equals, startsWith, or endsWith
   - Rules are applied in priority order (highest first)

## Example Output

```
Starting Bookkeeper Automation...
=================================

Fetching categorization rules from API...
Fetched 2 active rules
Connecting to Xero API...
Xero connection established (simulation - Phase 1 read-only)
Fetching uncategorized transactions from Xero...
Found 2 transactions to process

Applying categorization rules...

Processing transaction mock-001:
  Description: Office Supplies - Staples
  Payee: Staples Inc.
  Amount: $125.5
  ✓ Matched rule: "Office Supplies"
    → Account Code: 6110
    → Tax Type: BASEXCLUDED

Processing transaction mock-002:
  Description: Cloud Hosting Services
  Payee: AWS
  Amount: $250
  ✗ No matching rules found

=================================
Bookkeeper Automation completed successfully

Note: Phase 1 is read-only. No changes were made to Xero.
```

## Future Phases

### Phase 2 - Write Mode
- OAuth2 authentication with Xero
- Actually update transactions in Xero
- Handle API rate limiting and retries
- Error handling and logging

### Phase 3 - Advanced Features
- Batch processing
- Scheduled runs
- Webhook integration
- Machine learning suggestions