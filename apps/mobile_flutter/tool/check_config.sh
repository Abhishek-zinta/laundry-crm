#!/usr/bin/env bash
# Validates config/<env>.json before a build, so a missing or template API URL
# fails the build instead of the app at startup.
# Usage: tool/check_config.sh development|staging|production
set -euo pipefail
cd "$(dirname "$0")/.."
env="${1:?usage: tool/check_config.sh development|staging|production}"
file="config/$env.json"
if [[ ! -f "$file" ]]; then
  if [[ "$env" == development ]]; then hint="run tool/dev_config.sh"; else hint="copy config/$env.example.json to $file and set the real API URL"; fi
  echo "error: $file not found ($hint)" >&2; exit 1
fi
python3 - "$file" "$env" <<'PY'
import json, sys
from urllib.parse import urlparse
path, env = sys.argv[1], sys.argv[2]
cfg = json.load(open(path))
url = cfg.get("API_BASE_URL", "")
errors = []
if cfg.get("APP_ENV") != env: errors.append(f'APP_ENV must be "{env}" (got {cfg.get("APP_ENV")!r})')
u = urlparse(url)
if not url or not u.scheme or not u.netloc: errors.append("API_BASE_URL is missing or not a URL")
if "<" in url or ">" in url: errors.append("API_BASE_URL is still the template value")
if env != "development" and u.scheme != "https": errors.append("API_BASE_URL must use https:// outside development")
if errors:
    print(f"error: {path}: " + "; ".join(errors), file=sys.stderr); sys.exit(1)
print(f"{path}: OK ({url})")
PY
