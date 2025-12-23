#!/usr/bin/env bash
set -euo pipefail

# macOS-focused watchdog for Cloudflare Tunnel (cloudflared).
# It checks the local /ready endpoint (served on the metrics port) and restarts
# the launchd service if the tunnel has 0 ready connections.

LAUNCHD_LABEL="${CLOUDFLARED_LABEL:-homebrew.mxcl.cloudflared}"
LAUNCHD_DOMAIN="gui/$(id -u)"

READY_PORTS_CSV="${CLOUDFLARED_READY_PORTS:-20241,20242,20243,20244,20245}"
COOLDOWN_SECONDS="${CLOUDFLARED_RESTART_COOLDOWN_SECONDS:-90}"

log() {
  printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

lock_dir="${TMPDIR:-/tmp}/cloudflared-watchdog.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT

restart_stamp="${TMPDIR:-/tmp}/cloudflared-watchdog.last_restart"

kickstart_cloudflared() {
  if ! command -v launchctl >/dev/null 2>&1; then
    log "launchctl not available; cannot restart ${LAUNCHD_DOMAIN}/${LAUNCHD_LABEL}"
    return 1
  fi
  launchctl kickstart -k "${LAUNCHD_DOMAIN}/${LAUNCHD_LABEL}" || true
}

restart_cloudflared() {
  local reason="${1:-unknown}"
  local now last
  now="$(date +%s)"
  last="0"
  if [[ -f "$restart_stamp" ]]; then
    last="$(cat "$restart_stamp" 2>/dev/null || echo 0)"
  fi
  if [[ "$last" =~ ^[0-9]+$ ]] && (( now - last < COOLDOWN_SECONDS )); then
    log "skip restart (cooldown ${COOLDOWN_SECONDS}s): ${reason}"
    return 0
  fi

  printf '%s' "$now" >"$restart_stamp"
  log "restarting cloudflared: ${reason}"
  kickstart_cloudflared
}

if ! pgrep -f "cloudflared tunnel run" >/dev/null 2>&1; then
  restart_cloudflared "cloudflared process not running"
  exit 0
fi

ready_ports=()
IFS=',' read -r -a ready_ports <<<"$READY_PORTS_CSV"

ready_json=""
ready_port=""
for port in "${ready_ports[@]}"; do
  port="$(printf '%s' "$port" | tr -d '[:space:]')"
  [[ -z "$port" ]] && continue
  if ready_json="$(curl -fsS --max-time 2 "http://127.0.0.1:${port}/ready" 2>/dev/null)"; then
    ready_port="$port"
    break
  fi
done

if [[ -z "$ready_port" ]]; then
  restart_cloudflared "no /ready endpoint on ports (${READY_PORTS_CSV})"
  exit 0
fi

ready_connections="$(printf '%s' "$ready_json" | sed -nE 's/.*"readyConnections":([0-9]+).*/\1/p')"
if [[ -z "$ready_connections" ]]; then
  restart_cloudflared "could not parse /ready response on port ${ready_port}"
  exit 0
fi

if [[ "$ready_connections" -lt 1 ]]; then
  restart_cloudflared "readyConnections=${ready_connections} (port ${ready_port})"
fi

