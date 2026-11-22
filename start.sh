#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  printf '%s\n' 'EPhone needs Node.js 22 or later and npm. In Termux, run: pkg install nodejs-lts' >&2
  exit 1
fi

node -e 'if (+process.versions.node.split(".")[0] < 22) { console.error("EPhone needs Node.js 22 or later."); process.exit(1) }'
npm ci --include=dev --no-audit --no-fund
npm run build
exec node build/server/index.js "$@"
