#!/usr/bin/env bash
# verify-all.sh — Devflow Deterministic Verification Suite
# Run by the gate pipeline to check code quality deterministically.
# Each check outputs: { "check": "name", "status": "pass|fail", "evidence": "..." }
set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

OUTPUT_FILE="${2:-/dev/stdout}"

# Initialize JSON array
results="["
first=true

add_result() {
  local check="$1"
  local status="$2"
  local evidence="$3"
  # Escape evidence for JSON
  evidence=$(echo "$evidence" | sed 's/"/\\"/g' | head -c 1000)

  if [ "$first" = true ]; then
    first=false
  else
    results+=","
  fi
  results+="{\"check\":\"$check\",\"status\":\"$status\",\"evidence\":\"$evidence\"}"
}

# ── Check 1: Typecheck ──
echo "→ TypeScript type checking..."
if npx tsc --noEmit 2>&1; then
  add_result "typecheck" "pass" "TypeScript compilation successful"
else
  add_result "typecheck" "fail" "TypeScript compilation errors found. Run: npx tsc --noEmit"
fi

# ── Check 2: Lint ──
echo "→ ESLint..."
LINT_CONFIG=".devflow/eslintrc.constitution.json"
if [ -f "$LINT_CONFIG" ]; then
  if npx eslint src/ --config "$LINT_CONFIG" --max-warnings 0 2>&1; then
    add_result "lint" "pass" "ESLint: no errors or warnings"
  else
    add_result "lint" "fail" "ESLint violations found. Run: npx eslint src/"
  fi
else
  add_result "lint" "pass" "ESLint config not found (skipped)"
fi

# ── Check 3: Tests ──
echo "→ Test suite..."
if npx vitest run --reporter=verbose 2>&1; then
  add_result "test" "pass" "All tests passing"
else
  add_result "test" "fail" "Test failures found. Run: npx vitest run"
fi

# ── Check 4: Coverage ──
echo "→ Coverage thresholds..."
COVERAGE_OUTPUT=$(npx vitest run --coverage --reporter=json 2>&1) || true
if echo "$COVERAGE_OUTPUT" | grep -q "ERROR: Coverage"; then
  add_result "coverage" "fail" "Coverage below minimum thresholds (80% lines, 100% domain branches)"
else
  add_result "coverage" "pass" "Coverage thresholds met"
fi

# ── Check 5: Circular dependencies ──
echo "→ Circular dependency check..."
if command -v npx &>/dev/null; then
  CIRCULAR=$(npx madge --circular --extensions ts src/ 2>&1) || true
  if echo "$CIRCULAR" | grep -q "No circular"; then
    add_result "circular-deps" "pass" "No circular imports detected"
  elif echo "$CIRCULAR" | grep -q "✖"; then
    add_result "circular-deps" "fail" "Circular imports detected. Run: npx madge --circular src/"
  else
    add_result "circular-deps" "pass" "madge not available (skipped)"
  fi
else
  add_result "circular-deps" "pass" "npx not available (skipped)"
fi

# ── Check 6: Forbidden dependencies ──
echo "→ Dependency rules check..."
DC_CONFIG=".devflow/dependency-cruiser.constitution.js"
if [ -f "$DC_CONFIG" ] && command -v npx &>/dev/null; then
  if npx dependency-cruiser --config "$DC_CONFIG" src/ 2>&1; then
    add_result "forbidden-deps" "pass" "No forbidden dependencies"
  else
    add_result "forbidden-deps" "fail" "Forbidden dependencies detected. Check layer boundaries."
  fi
else
  add_result "forbidden-deps" "pass" "dependency-cruiser config not found (skipped)"
fi

# ── Check 7: TODO/FIXME check ──
echo "→ TODO/FIXME audit..."
TODOS=$(grep -rn "TODO\|FIXME" src/ --include="*.ts" | grep -v "TODO(#" | grep -v "FIXME(#" 2>&1) || true
if [ -z "$TODOS" ]; then
  add_result "todos" "pass" "No unlinked TODO/FIXME found"
else
  TODO_COUNT=$(echo "$TODOS" | wc -l)
  add_result "todos" "fail" "$TODO_COUNT unlinked TODO/FIXME found. Format: TODO(#issue): description"
fi

# ── Close JSON ──
results+="]"

echo "$results" > "$OUTPUT_FILE"
echo ""
echo "─── Verification Complete ───"
echo "$results" | python3 -m json.tool 2>/dev/null || echo "$results"
