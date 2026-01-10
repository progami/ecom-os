#!/bin/bash
set -euo pipefail

FCC_DIR="${FCC_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$FCC_DIR"
npx tsx scripts/fetch-all-historical-balance-sheets.ts
