#!/bin/bash
set -euo pipefail

FCC_DIR="${FCC_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$FCC_DIR"
npx tsx scripts/refresh-all-balance-sheet-data.ts
