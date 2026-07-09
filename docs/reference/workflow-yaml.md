# Workflow YAML Schema Reference

> EPIC-TD-001 Story 2.9 — Document Workflow YAML Schema

## Overview

Workflow definitions in `.devflow/workflow-states.yaml` define valid state transitions, guards, and effects for the Devflow workflow engine (`src/kernel/workflow/engine.ts`).

## Top-Level Structure

```yaml
meta:
  version: "1.0"
  description: "string"

states:
  - id: "state-id"
    type: "initial | intermediate | terminal"
    label: "Human-readable name"
    description: "When this state is active"

transitions:
  - id: "transition-id"
    from: "state-id"
    to: "state-id"
    label: "Human-readable action name"
    description: "What this transition does"

guards:
  - id: "guard-id"
    description: "What this guard checks"
    check: "rule reference"

effects:
  - id: "effect-id"
    description: "Side effect description"
    action: "action type"
```

## Key Types

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `states[].id` | string | Yes | Unique state identifier |
| `states[].type` | enum | Yes | `initial`, `intermediate`, or `terminal` |
| `transitions[].id` | string | Yes | Unique transition identifier |
| `transitions[].from` | string | Yes | Source state ID |
| `transitions[].to` | string | Yes | Target state ID |
| `guards[].id` | string | Yes | Unique guard identifier |
| `effects[].id` | string | Yes | Unique effect identifier |

## Validation

Run: `npm run validate-workflow-schema` or `node scripts/validate-workflow-schema.js`

The validator performs 7 structural checks: required fields, cross-reference integrity, duplicate IDs, guard/effect references, and agent role validity.
