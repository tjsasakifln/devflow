# Architecture Decision Records (ADRs)

> EPIC-TD-001 Story 2.3 — Establish ADR Process

## What are ADRs?

Architecture Decision Records capture significant architectural decisions with context, rationale, and consequences. Each ADR documents one decision that affects the system's structure, non-functional characteristics, or dependencies.

## When to Create an ADR

| Trigger | Severity |
|---------|----------|
| New technology stack component | MUST |
| Architecture layer addition/removal | MUST |
| API contract change | MUST |
| Data model migration | SHOULD |
| Security pattern change | MUST |
| Performance optimization affecting architecture | SHOULD |
| Deprecation of a supported pattern | SHOULD |
| Build/CI infrastructure change | MAY |

## How to Use

1. Copy `template.md` to `ADR-{NNN}-{kebab-case}.md`
2. Fill all sections
3. Submit for review
4. Once accepted, update status to "Accepted" and add to index below

## Naming Convention

```
ADR-001-short-description.md
ADR-002-another-decision.md
```

## Status Lifecycle

```
Proposed → Accepted → (Deprecated | Superseded)
```

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Three-Layer Architecture (Kernel/Intelligence/Adapters) | Accepted |
| ADR-002 | Evidence-Based Governance with Hash-Chained Audit Trail | Accepted |
| ADR-003 | Multi-Agent Orchestration with Adversarial Verification | Accepted |
| ADR-007 | Intelligence Module Scope & Contract | Accepted |
