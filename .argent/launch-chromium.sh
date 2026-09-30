#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
test -x "$chrome" || { echo 'Google Chrome is required for this Argent flow.' >&2; exit 1; }
mkdir -p "$repo_root/.tmp"
profile=$(mktemp -d "$repo_root/.tmp/argent-qa.XXXXXX")

# Fresh task-owned storage keeps the disclosure banner and input defaults repeatable.
exec "$chrome" --headless=new --window-size=375,812 \
  --app=http://localhost:3117/dashboard/generator --user-data-dir="$profile" \
  --disable-crashpad-for-testing --disable-crash-reporter \
  --no-first-run --no-default-browser-check "$@"
