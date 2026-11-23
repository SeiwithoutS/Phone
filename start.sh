#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  printf '%s\n' 'EPhone needs Node.js 22 or later and npm. In Termux, run: pkg install nodejs-lts' >&2
  exit 1
fi

exec node scripts/start.mjs --build "$@"
