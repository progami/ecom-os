#!/usr/bin/env bash
set -euo pipefail

PLIST_PATH="${HOME}/Library/LaunchAgents/com.targonglobal.cloudflared-watchdog.plist"
SCRIPT_PATH="${CLOUDFLARED_WATCHDOG_BIN_DIR:-$HOME/bin}/cloudflared-watchdog.sh"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH"
rm -f "$SCRIPT_PATH"

echo "Removed cloudflared watchdog:"
echo "- LaunchAgent: ${PLIST_PATH}"
echo "- Script: ${SCRIPT_PATH}"

