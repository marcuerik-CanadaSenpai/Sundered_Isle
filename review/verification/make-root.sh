#!/usr/bin/env bash
# Builds the folder layout these scripts expect and prints the WL_ROOT to use:
#   root/boot.js, root/mock-claude.js   the harness from test/
#   root/src/    the published build that was reviewed (review/published)
#   root/main/   the build under test (windlass/)
# Usage from the repo root:  bash review/verification/make-root.sh && export WL_ROOT=$PWD/review/verification/root NODE_PATH=$PWD/test/node_modules
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"; root="$here/root"
rm -rf "$root"; mkdir -p "$root"
cp "$repo/test/boot.js" "$repo/test/mock-claude.js" "$root/"
cp -r "$repo/review/published" "$root/src"
cp -r "$repo/windlass" "$root/main"; rm -f "$root/main/FINDINGS.md"
echo "WL_ROOT=$root"
