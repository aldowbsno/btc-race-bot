#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
kit_dir=${1:?Usage: bash scripts/grade-local.sh /absolute/path/to/official-kit}
mkdir -p reports/official
set +e
node "$kit_dir/cli/makefun.mjs" grade-local --kit "$kit_dir" \
  --bot "$PWD" --worktree --driver process --save "$PWD/reports/official/artifacts" --json \
  > reports/official/summary.json 2> reports/official/stderr.txt
grade_exit=$?
set -e
node scripts/record-grade.ts "$grade_exit"
