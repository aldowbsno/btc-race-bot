#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
kit_dir=${1:?Usage: bash scripts/repro.sh /absolute/path/to/official-kit [--engine-only]}
case "${2:-}" in ''|--engine-only) ;; *) echo 'Unknown option' >&2; exit 2 ;; esac
node --experimental-test-isolation=none --test tests/*.test.ts
node research/evaluate.ts "$kit_dir" reports/research.json
node research/verify.ts "$kit_dir" reports/repro
node main.ts < reports/repro/input.ndjson > reports/repro/run1.ndjson
node main.ts < reports/repro/input.ndjson > reports/repro/run2.ndjson
node scripts/compare-logs.ts reports/repro
if [[ ${2:-} != --engine-only ]]; then
  bash scripts/grade-local.sh "$kit_dir"
fi
