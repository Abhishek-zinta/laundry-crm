#!/usr/bin/env bash
# Writes config/development.json pointing at this machine's current LAN IP,
# so a phone or emulator can reach the local NestJS API on port 4000.
# Usage: tool/dev_config.sh [port]
set -euo pipefail
cd "$(dirname "$0")/.."
port="${1:-4000}"
ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')"
if [[ -z "$ip" ]] && command -v ipconfig >/dev/null; then ip="$(ipconfig getifaddr en0 || true)"; fi
if [[ -z "$ip" ]]; then echo "Could not detect the LAN IP; edit config/development.json by hand." >&2; exit 1; fi
cat > config/development.json <<JSON
{
  "APP_ENV": "development",
  "API_BASE_URL": "http://$ip:$port/api/v1"
}
JSON
echo "config/development.json -> http://$ip:$port/api/v1"
