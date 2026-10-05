#!/usr/bin/env bash
# Applies committed Prisma migrations to a remote database (e.g. Neon) using a
# connection string typed interactively, so it never lands in .env, shell
# history, process arguments or logs. Never seeds.
#
#   npm run db:deploy:remote            (from the repo root or apps/api)
#
# - Input is hidden; the URL lives only in this script's memory and in the
#   environment of the Prisma processes it starts.
# - The local .env is NOT loaded: Prisma is called directly (no dotenv-cli), and
#   the script checks the host Prisma reports before changing anything.
# - A Neon pooled host (-pooler) is switched to the direct host, as migrations
#   need a direct connection.
# - Output is saved to a log with the password and full URL redacted.
# ALLOW_LOCAL_TARGET=1 permits a localhost URL (only for testing this script).
set -euo pipefail
cd "$(dirname "$0")/.."

PRISMA="../../node_modules/.bin/prisma"
[[ -x "$PRISMA" ]] || { echo "error: Prisma CLI not found at $PRISMA (run npm install at the repo root)" >&2; exit 1; }

LOG="${TMPDIR:-/tmp}/rinseops-migrate-remote-$(date +%Y%m%d-%H%M%S).log"
cleanup() {
  unset RAW_URL DIRECT_URL DB_PASSWORD DATABASE_URL PARSED || true
}
trap cleanup EXIT INT TERM

# Never use a DATABASE_URL inherited from the calling shell.
unset DATABASE_URL

if [[ -t 0 ]]; then
  read -rsp "Database URL (input hidden, not saved): " RAW_URL
  echo
else
  IFS= read -r RAW_URL # piped input, for automated checks
fi
[[ -n "${RAW_URL:-}" ]] || { echo "error: no URL entered" >&2; exit 1; }

# Parse and normalise in Node; the URL is passed through the environment, never argv.
PARSED=$(RAW_URL="$RAW_URL" node -e '
  let u;
  try { u = new URL(process.env.RAW_URL.trim()); } catch { console.log("ERR\tnot a valid URL"); process.exit(0); }
  if (!/^postgres(ql)?:$/.test(u.protocol)) { console.log("ERR\tnot a postgres:// or postgresql:// URL"); process.exit(0); }
  const host = u.hostname;
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && process.env.ALLOW_LOCAL_TARGET !== "1") {
    console.log("ERR\tthat is a local database; this command is for the remote (Neon) database"); process.exit(0);
  }
  let note = "";
  const labels = host.split(".");
  if (labels[0].endsWith("-pooler")) {
    labels[0] = labels[0].slice(0, -"-pooler".length);
    u.hostname = labels.join(".");
    note = "pooled (-pooler) host switched to the direct host for migrations";
  }
  if (!u.searchParams.has("sslmode") && process.env.ALLOW_LOCAL_TARGET !== "1") u.searchParams.set("sslmode", "require");
  const db = decodeURIComponent(u.pathname.replace(/^\//, "")) || "(default)";
  console.log(["OK", u.toString(), u.hostname, db, decodeURIComponent(u.username), decodeURIComponent(u.password), u.searchParams.get("sslmode") ?? "", note].join("\t"));
')
IFS=$'\t' read -r STATUS DIRECT_URL TARGET_HOST TARGET_DB TARGET_USER DB_PASSWORD SSLMODE NOTE <<<"$PARSED"
unset RAW_URL PARSED
if [[ "$STATUS" != "OK" ]]; then echo "error: ${DIRECT_URL}" >&2; exit 1; fi

# Redacts the password and the full URL from anything we print or log.
redact() {
  if [[ -n "${DB_PASSWORD:-}" ]]; then
    PW="$DB_PASSWORD" URL="$DIRECT_URL" node -e '
      const pw = process.env.PW, url = process.env.URL;
      let s = require("fs").readFileSync(0, "utf8");
      if (url) s = s.split(url).join("<connection string redacted>");
      if (pw) { s = s.split(pw).join("****"); s = s.split(encodeURIComponent(pw)).join("****"); }
      process.stdout.write(s);'
  else
    cat
  fi
}
say() { echo "$*" | tee -a "$LOG"; }
run() { # run a command with the target URL; tee redacted output to the log
  local out rc
  set +e
  out=$(DATABASE_URL="$DIRECT_URL" "$@" 2>&1)
  rc=$?
  set -e
  printf '%s\n' "$out" | redact | tee -a "$LOG"
  return $rc
}

: >"$LOG"
chmod 600 "$LOG"
say "Target:   ${TARGET_USER}@${TARGET_HOST} / database \"${TARGET_DB}\" (sslmode=${SSLMODE:-unset})"
[[ -n "$NOTE" ]] && say "Note:     $NOTE"

if [[ -t 0 ]]; then
  read -rp "Apply pending migrations to this database? Seeding is never run. [y/N] " ANSWER
  [[ "$ANSWER" =~ ^[Yy]$ ]] || { say "Cancelled; nothing changed."; exit 1; }
fi

say ""
say "== 1/4 Connection check"
run node -e '
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  p.$queryRawUnsafe("select current_database() as db, current_user as usr, inet_server_addr() is not null as remote, split_part(version(), chr(32), 2) as pg")
    .then(([r]) => console.log(`Connected: database=${r.db} user=${r.usr} postgres=${r.pg}`))
    .catch((e) => { console.error(`Connection failed: ${e.message.split("\n").slice(-2).join(" ").trim()}`); process.exitCode = 1; })
    .finally(() => p.$disconnect());' || { say "Aborted: could not connect."; exit 1; }

say ""
say "== 2/4 Migration status before"
STATUS_OUT=$(run "$PRISMA" migrate status || true)
printf '%s\n' "$STATUS_OUT"
# Prisma prints the datasource it is about to use; refuse if it is not the host typed above.
if ! grep -q "at \"${TARGET_HOST}" <<<"$STATUS_OUT"; then
  say "Aborted: Prisma reported a different database than the one entered (is a .env overriding it?)."
  exit 1
fi

say ""
say "== 3/4 prisma migrate deploy"
run "$PRISMA" migrate deploy || { say "Aborted: migrate deploy failed."; exit 1; }

say ""
say "== 4/4 Migration status after"
FINAL=$(run "$PRISMA" migrate status || true)
printf '%s\n' "$FINAL"
if grep -q "Database schema is up to date" <<<"$FINAL"; then
  APPLIED=$(ls -d prisma/migrations/*/ | wc -l | tr -d ' ')
  say ""
  say "RESULT: all ${APPLIED} migrations are applied to ${TARGET_HOST}/${TARGET_DB}. No seed was run."
else
  say ""
  say "RESULT: migrations are NOT fully applied; see above."
  exit 1
fi
say "Log (password and URL redacted): $LOG"
