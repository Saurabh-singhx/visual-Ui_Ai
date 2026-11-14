#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_ROOT}"

echo "========================================================"
echo "  Visual UI E2E Test Suite Runner"
echo "  Directory: ${PROJECT_ROOT}"
echo "  Config:    vitest.e2e.config.ts"
echo "========================================================"

export VITE_CONFIG_NATIVE_IGNORE_WARNING=true

# Locate vitest binary
if [ -x "./server/node_modules/.bin/vitest" ]; then
  VITEST_CMD=("./server/node_modules/.bin/vitest")
elif [ -x "./node_modules/.bin/vitest" ]; then
  VITEST_CMD=("./node_modules/.bin/vitest")
else
  VITEST_CMD=("npx" "vitest")
fi

echo "Using Vitest: ${VITEST_CMD[*]}"
echo "Running test suite..."

START_TIME=$(date +%s)

set +e
if [ "$#" -eq 0 ]; then
  "${VITEST_CMD[@]}" run --config vitest.e2e.config.ts
else
  "${VITEST_CMD[@]}" run --config vitest.e2e.config.ts "$@"
fi
EXIT_CODE=$?
set -e

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "========================================================"
if [ "${EXIT_CODE}" -eq 0 ]; then
  echo "  E2E Test Run PASSED (${DURATION}s)"
else
  echo "  E2E Test Run FAILED (${DURATION}s) with exit code ${EXIT_CODE}"
fi
echo "========================================================"

exit "${EXIT_CODE}"
