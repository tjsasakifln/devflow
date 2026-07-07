#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Devflow AI PR Governance Demo
# ─────────────────────────────────────────────────────────────
# Demonstrates the full Devflow pipeline from install to PR risk
# report in under 10 minutes. No API keys needed.
#
# Usage: bash run-demo.sh [--keep] [--devflow-path ../..]
#   --keep          Don't delete the demo project at the end
#   --devflow-path  Path to devflow repo (default: ../..)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

KEEP=false
DEVFLOW_PATH="../.."

for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=true ;;
    --devflow-path) DEVFLOW_PATH="${2:-../..}"; shift ;;
  esac
  shift 2>/dev/null || true
done

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="$(mktemp -d /tmp/devflow-demo-XXXXXX)"
cleanup() {
  if [ "$KEEP" = false ]; then
    rm -rf "$WORK_DIR"
  else
    echo ""
    echo "Demo project kept at: $WORK_DIR"
  fi
}
trap cleanup EXIT

echo "═══════════════════════════════════════════════════════════════"
echo "  Devflow — AI PR Governance Demo"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Working dir: $WORK_DIR"
echo ""

# ── Step 0: Build devflow (if needed) ──
DEVFLOW_BIN=""
if [ -f "$DEVFLOW_PATH/dist/main.js" ]; then
  DEVFLOW_BIN="node $DEVFLOW_PATH/dist/main.js"
elif command -v devflow &>/dev/null; then
  DEVFLOW_BIN="devflow"
else
  echo "Building Devflow from $DEVFLOW_PATH..."
  (cd "$DEVFLOW_PATH" && npm run build >/dev/null 2>&1) || {
    echo "ERROR: Could not build devflow. Run 'npm run build' in $DEVFLOW_PATH first."
    exit 1
  }
  DEVFLOW_BIN="node $DEVFLOW_PATH/dist/main.js"
fi

# ── Step 1: Create clean project ──
echo "━━━ Step 1: Create project ━━━"
cd "$WORK_DIR"

cat > package.json <<'PKGJSON'
{
  "name": "demo-health-check",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test src/*.test.js",
    "typecheck": "echo 'no types'",
    "lint": "echo 'clean'"
  }
}
PKGJSON

mkdir -p src
cat > src/index.ts <<'SRC'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet("World"));
SRC

echo "✅ Project created (package.json + src/index.ts)"
echo ""

# ── Step 2: Install Devflow ──
echo "━━━ Step 2: Install Devflow ━━━"
$DEVFLOW_BIN install --yes --review-mode solo-hardened 2>&1 || {
  echo "ERROR: devflow install failed"
  exit 1
}
echo ""

# ── Step 3: Create feature ──
echo "━━━ Step 3: Create feature workspace ━━━"
$DEVFLOW_BIN feature new "add-health-check" --non-interactive 2>&1
echo ""

# ── Step 4: Fill artifacts ──
echo "━━━ Step 4: Fill feature artifacts ━━━"
FEATURE_DIR="_devflow/features/001-add-health-check"

cat > "$FEATURE_DIR/requirements.md" <<'REQ'
# Requirements: Health Check Endpoint

## Executive Summary
Add a /health endpoint returning service status.

## Functional Requirements
- RF-01: GET /health returns { status: "ok", uptime: <seconds> }
- RF-02: Response includes timestamp in ISO 8601 format
- RF-03: Status is always "ok" while process is running

## Acceptance Criteria (Gherkin)
- Given service is running, When GET /health, Then returns 200 with status "ok"
- Given service started 10s ago, When GET /health, Then uptime is approximately 10

## Negative Scope
- No database health checks
- No external service probes
- No authentication on /health

## Doubts
- [x] Format: JSON only — confirmed
- [x] Status codes: always 200 while alive — confirmed
REQ

cat > "$FEATURE_DIR/roadmap.md" <<'ROADMAP'
# Architecture Roadmap: Health Check

## Approach Summary
Minimal health endpoint returning process status. No external dependencies.

## Technical Decisions
- Pure function in src/health.ts
- No framework dependency — uses Node.js built-in http
- Tested with node:test

## Architecture Layers
- src/health.ts — health check logic (domain)
- src/health.test.ts — unit tests
ROADMAP

cat > "$FEATURE_DIR/actions.md" <<'ACTIONS'
# Implementation Actions

## Preparation
- [X] T001: Create src/health.ts with getHealth() function
- [X] T002: Create src/health.test.ts with acceptance tests

## Core
- [X] T003: Implement uptime tracking via process.startTime
- [X] T004: Wire /health route (if http server exists)

## Verification
- [X] T005: Run tests, verify all Gherkin scenarios pass
ACTIONS

cat > "$FEATURE_DIR/test-plan.md" <<'TESTPLAN'
# Test Plan: Health Check

## Test Strategy
Unit tests for getHealth() covering all acceptance criteria.

## Test Cases
- Returns { status: "ok" } format
- Returns numeric uptime field
- Returns ISO 8601 timestamp
- Uptime increases between calls

## Verification Commands
npm test
TESTPLAN

echo "✅ Artifacts filled (requirements, roadmap, actions, test-plan)"
echo ""

# ── Step 5: Generate implementation prompt ──
echo "━━━ Step 5: Generate AI implementation prompt ━━━"
$DEVFLOW_BIN feature prompt 001-add-health-check --preview 2>&1 | head -30
echo "..."
echo "✅ Prompt generated"
echo ""

# ── Step 6: Simulate implementation ──
echo "━━━ Step 6: Simulate AI implementation ━━━"

cat > src/health.ts <<'HEALTH'
/**
 * Health check response.
 * Returns service status and uptime in seconds.
 */
export interface HealthResponse {
  status: "ok";
  uptime: number;
  timestamp: string;
}

const START_TIME = Date.now();

export function getHealth(): HealthResponse {
  return {
    status: "ok",
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
  };
}
HEALTH

cat > src/health.test.ts <<'HEALTHTEST'
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getHealth } from "./health.js";

describe("getHealth()", () => {
  it("returns status ok", () => {
    const result = getHealth();
    assert.equal(result.status, "ok");
  });

  it("returns numeric uptime", () => {
    const result = getHealth();
    assert.equal(typeof result.uptime, "number");
    assert.ok(result.uptime >= 0);
  });

  it("returns ISO 8601 timestamp", () => {
    const result = getHealth();
    assert.ok(result.timestamp.endsWith("Z") || result.timestamp.includes("+") || result.timestamp.includes("-"));
  });

  it("uptime increases between calls", async () => {
    const first = getHealth();
    await new Promise((r) => setTimeout(r, 1100));
    const second = getHealth();
    assert.ok(second.uptime >= first.uptime + 1, `Expected ${second.uptime} >= ${first.uptime} + 1`);
  });
});
HEALTHTEST

# Append implementation log
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$FEATURE_DIR/implementation-log.jsonl" <<LOGENTRIES
{"timestamp":"$NOW","actor":"demo-agent","actionId":"T001","action":"Create src/health.ts with getHealth()","filesChanged":["src/health.ts"],"status":"completed","notes":"Health check function with uptime tracking"}
{"timestamp":"$NOW","actor":"demo-agent","actionId":"T002","action":"Create src/health.test.ts","filesChanged":["src/health.test.ts"],"status":"completed","notes":"4 tests covering all acceptance criteria"}
{"timestamp":"$NOW","actor":"demo-agent","actionId":"T003","action":"Implement uptime via process.startTime","filesChanged":["src/health.ts"],"status":"completed","notes":"Uses Date.now() for uptime calculation"}
{"timestamp":"$NOW","actor":"demo-agent","actionId":"T005","action":"Run tests, verify all scenarios","filesChanged":["src/health.test.ts"],"status":"completed","notes":"All 4 tests pass"}
LOGENTRIES

echo "✅ Implementation simulated (2 source files, 4 log entries)"
echo ""

# ── Step 7: Feature complete ──
echo "━━━ Step 7: Run feature complete (25 DoD checks) ━━━"
$DEVFLOW_BIN feature complete 001-add-health-check 2>&1 || true
echo ""

# ── Step 8: Adversarial review ──
echo "━━━ Step 8: Run adversarial review (12 attack vectors) ━━━"
$DEVFLOW_BIN adversarial-review 001-add-health-check 2>&1 || true
echo ""

# ── Step 9: Gatekeep ──
echo "━━━ Step 9: Gatekeep approval ━━━"
$DEVFLOW_BIN gatekeep 001-add-health-check --approve --actor "demo-reviewer" --reason "All checks pass. Demo approval." 2>&1 || true
echo ""

# ── Step 10: PR risk report ──
echo "━━━ Step 10: Generate PR risk report ━━━"
REPORT_FILE="$DEMO_DIR/pr-risk-report.md"
$DEVFLOW_BIN review-pr --output "$REPORT_FILE" 2>&1
echo ""
echo "✅ PR risk report written to: examples/ai-pr-governance-demo/pr-risk-report.md"
echo ""

# ── Summary ──
echo "═══════════════════════════════════════════════════════════════"
echo "  Demo Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "What happened:"
echo "  1. Created a minimal Node.js project"
echo "  2. Installed Devflow (solo-hardened mode)"
echo "  3. Created feature 'add-health-check'"
echo "  4. Filled requirements, roadmap, actions, test-plan"
echo "  5. Generated AI implementation prompt"
echo "  6. Simulated AI agent implementing the code"
echo "  7. Ran 25 Definition of Done checks"
echo "  8. Ran adversarial review (12 attack vectors)"
echo "  9. Gatekeep approved (self-approval in solo mode)"
echo "  10. Generated PR risk report"
echo ""
echo "The PR risk report at:"
echo "  examples/ai-pr-governance-demo/pr-risk-report.md"
echo ""
echo "This report can be pasted into any PR description"
echo "as evidence of AI code governance."
echo ""

if [ "$KEEP" = true ]; then
  echo "Demo project kept at: $WORK_DIR"
fi
