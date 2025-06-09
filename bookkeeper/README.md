# Bookkeeper Automation Module

This module provides automated transaction categorization for Xero based on centrally managed rules.

## Phase 1 Implementation (Current)

The current implementation provides:
- ✅ Fetches categorization rules from the main application API
- ✅ Initializes Xero client for read-only operations
- ✅ Demonstrates rule processing logic
- ✅ Safe, read-only operation mode

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` with your actual credentials.

3. **Run the automation script:**
   ```bash
   npm run run
   ```

## How It Works

1. The script fetches active categorization rules from `/api/v1/bookkeeping/rules`
2. It initializes a connection to Xero (if credentials are provided)
3. In Phase 1, it demonstrates how rules would be applied to transactions
4. All operations are read-only for safety

## Categorization Rules

Rules are managed through the web interface at `/bookkeeping/rules` and include:
- **Match criteria**: Field (description/payee/reference), type (contains/equals/etc), and value
- **Target**: Xero account code and tax type
- **Priority**: Higher priority rules are applied first

## Future Phases

Phase 2 will add:
- OAuth2 authentication flow for Xero
- Actual transaction fetching and categorization
- Write operations to update transactions in Xero
- Detailed logging and reporting