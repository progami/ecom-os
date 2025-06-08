# WMS Automation Module

This directory contains the headless automation script for warehouse management background tasks.

## Purpose

The `run.ts` script is designed to:
- Generate daily "low stock" reports
- Consume APIs from the main ecom_os application
- Run as a scheduled job or on-demand

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Configure your API key and settings in `.env`

## Usage

Run the daily report:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Scheduling

To run as a daily cron job:
```bash
# Add to crontab
0 9 * * * cd /path/to/ecom_os/warehouse_management && npm start >> /var/log/wms-daily-report.log 2>&1
```

## Architecture Note

This is a headless automation script that consumes the main application's API. All UI and API routes for WMS functionality are located in the main Next.js application at the root level.