# How to Use Devflow with FastAPI

## The Problem

You use FastAPI with AI-generated endpoints. An AI agent writes a route in seconds — but did it validate input? Did it inject SQL? Did it set `debug=True` in production? Did it write tests? FastAPI's speed makes it the perfect companion for AI coding and the perfect vector for AI-generated mistakes. You need a governance layer that understands Python patterns and catches FastAPI-specific dangers before deployment.

## The Solution: Devflow with Python Stack Detection

Devflow auto-detects your Python/FastAPI stack and adapts its checks accordingly. The same `devflow review-pr` and `devflow adversarial-review` commands work, but they check Python-specific failure modes.

```bash
# Audit FastAPI changes before PR
devflow review-pr --base main

# Run adversarial review with Python-specific checks
devflow adversarial-review 001-add-payment-endpoint

# Verify full Definition of Done
devflow feature complete 001-add-payment-endpoint
```

## Step-by-Step

### 1. Install Devflow in your FastAPI project

```bash
npx @tjsasakinpm/devflow install --yes
```

Devflow detects your Python stack automatically — it will configure checks for pytest instead of vitest.

### 2. Create a feature for your endpoint

```bash
devflow feature new billing-endpoint
```

Fill in `requirements.md` with endpoint specifications, input validation rules, and error scenarios.

### 3. Generate the AI prompt

```bash
devflow feature prompt 001-billing-endpoint --save
```

The prompt tells the AI agent to log its work and produce evidence.

### 4. Let the AI agent implement the endpoint

The AI creates your FastAPI route with logging.

### 5. Audit the changes

```bash
devflow review-pr --base main
```

Devflow's stack profile detects Python/FastAPI and adjusts evidence checks accordingly.

## Python-Specific Dangerous Patterns

Devflow's adversarial review and DoD checks catch FastAPI-specific issues:

### Bare except blocks

```python
# Dangerous — catches everything, hides errors
try:
    process_payment(data)
except:
    return {"status": "ok"}
```

Devflow's constitution check flags bare except clauses as architecture violations.

### Debug mode in production

```python
# Dangerous — exposes stack traces and reloader
app = FastAPI(debug=True)
```

The security attack vector catches `debug=True` patterns.

### SQL injection via raw queries

```python
# Dangerous — string interpolation in SQL
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
```

The adversarial review security vector scans for unsafe string formatting in database operations.

### Hardcoded secrets

```python
# Dangerous — secret in source code
API_KEY = "sk_live_abc123"
```

The security scan detects hardcoded API keys and secrets in source files.

## Example FastAPI Audit Output

```
📋 Devflow PR Review

Comparing feature-billing-endpoint against main...

# PR Risk Report — feature-billing-endpoint → main

> **Generated:** 2026-07-07T17:00:00.000Z | **Stack:** Python (FastAPI)

## Verdict: 🚫 BLOCKED

> Security findings. Missing test plan. No implementation log.

## What Changed

| Status | File |
|--------|------|
| ➕ added | src/api/billing.py |
| ➕ added | src/api/schemas/billing.py |
| ➕ added | src/tests/test_billing.py |
| ✏️ modified | src/database/queries.py |

## Risks Remaining

- 🔴 Security: `debug=True` detected in src/api/billing.py
- 🔴 Security: Raw SQL string formatting in src/database/queries.py
- 🔴 Missing test-plan.md — no Gherkin scenarios for endpoint validation
- 🔴 No implementation log entries — cannot verify what was done
```

## Stack-Adaptive DoD Checks

When Devflow detects Python/FastAPI, it adjusts its Definition of Done:

| Check | Python Adaptation |
|-------|------------------|
| Tests | `python -m pytest` instead of vitest |
| Coverage | `pytest --cov=src/ --cov-fail-under=80` |
| Type checking | `mypy src/` or `pyright` (if configured) |
| Circular imports | Skipped (Python handles circular imports differently) |
| Lint | `ruff check src/` or `pylint` (if configured) |
| OO metrics | Python-specific coupling analysis |

## Configuration for FastAPI Projects

After installation, edit `.devflow/config.json` to set up Python-specific deterministic gates:

```json
{
  "deterministicGates": {
    "typecheck": true,
    "lint": true,
    "test": true,
    "coverage": true,
    "circularDeps": false
  }
}
```

Configure your test command:

```bash
# Devflow auto-detects pytest. If you need custom config:
devflow config set testCommand "python -m pytest --cov=src/ -v"
```

## Complete FastAPI Workflow

```bash
npx @tjsasakinpm/devflow install --yes                           # install
devflow feature new payment-endpoint                              # create feature
devflow feature prompt 001-payment-endpoint --save                # generate prompt
# ... AI implements the endpoint ...
devflow review-pr --base main                                     # audit
devflow adversarial-review 001-payment-endpoint                   # security check
devflow feature complete 001-payment-endpoint                     # DoD
devflow gatekeep 001-payment-endpoint --approve --actor reviewer  # approve
```

## Next Steps

- Set up `pytest` and `pytest-cov` if not already configured — Devflow uses these for test and coverage gates.
- Add `mypy` or `pyright` for type checking Python code.
- Configure `ruff` or `pylint` for lint enforcement.
- Integrate Devflow into your CI pipeline (see GitHub Actions guide).
- Run `devflow discover` for brownfield analysis if you are inheriting an existing FastAPI project.

Devflow is local-first. Python type hints, FastAPI validation, and Devflow governance form a three-layer safety net for AI-generated endpoints. No cloud dependency. No API keys.
