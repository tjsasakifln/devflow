# Adversarial Review Guide

> EPIC-TD-001 Story 2.8 — Document Adversarial Multi-Agent

## Overview

The adversarial review system examines your feature across 12 attack vectors. Instead of asking "is this good?", it asks "why should this be rejected?" — producing a rejection-focused assessment that surfaces issues optimistic review would miss.

## Quick Start

```bash
# Deterministic review (default)
devflow adversarial-review <feature-id>

# Experimental adversarial verification (3-lens)
devflow adversarial-review <feature-id> --verify-mode adversarial --experimental

# Auto-install missing tools
devflow adversarial-review <feature-id> --install-missing

# Non-interactive (CI)
devflow adversarial-review <feature-id> --non-interactive
```

## 12 Attack Vectors

| # | Vector | What it checks |
|---|--------|---------------|
| 1 | Hidden Coupling | Implicit dependencies between modules |
| 2 | Weak Tests | Decorative tests that don't verify real behavior |
| 3 | Abstraction Failure | Concrete deps where interfaces should exist |
| 4 | Layer Violation | Domain code importing infrastructure directly |
| 5 | Security | Hardcoded secrets, eval(), unsafe patterns |
| 6 | Spec-Code Gap | Requirements not reflected in tests or code |
| 7 | Uncovered Requirements | Functional requirements missing test coverage |
| 8 | Code Duplication | Duplicated logic that should be abstracted |
| 9 | State Tampering | State modified without gatekeep log entry |
| 10 | Log Forgery | Log entries missing required fields |
| 11 | False Completion | Actions marked done without log entries |
| 12 | Same-Actor Bypass | Same actor appearing with name variants |

## Experimental Mode (`--verify-mode adversarial`)

Uses in-process 3-lens verification (correctness, security, repro). Requires `--experimental` flag to acknowledge:
- This is NOT true multi-agent spawning
- No API keys, MCP servers, or agent-runner required
- Feature is under active development

## Interpreting Results

| Verdict | Meaning |
|---------|---------|
| **PASS** | No vulnerabilities found across all vectors |
| **FAIL** | One or more vulnerabilities detected |
| **INCONCLUSIVE** | Cannot determine (missing tools, insufficient data) |

## Common Issues

| Issue | Fix |
|-------|-----|
| "Tool missing" errors | Run with `--install-missing` |
| Vectors skipped | Install dependency-cruiser: `npm install --save-dev dependency-cruiser` |
| AI fallback warning | Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for AI-powered review |
