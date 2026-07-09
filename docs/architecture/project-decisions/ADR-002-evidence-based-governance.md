# ADR-002: Evidence-Based Governance with Hash-Chained Audit Trail

- **Status:** Accepted
- **Date:** 2026-06-01
- **Deciders:** Devflow Architecture Team

## Context

AI-generated code changes require auditable governance. Without evidence trails, there is no way to verify what was reviewed, who approved it, and whether quality gates were enforced. The system needed a mechanism that is (a) cryptographically verifiable, (b) append-only, and (c) resistant to tampering.

## Decision

Implement evidence-based governance with:

1. **ExecutionMode** (local/experimental/strict/release) — controls which gates are blocking
2. **Explicit `--approve`/`--reject`** — approval and rejection must be explicit, never implicit
3. **Constitution C12** — actor segregation: implementer ≠ approver
4. **SHA-256 evidence hashing** — every approval package includes file hashes, commit SHA, actor identity, and rule reference

## Consequences

### Positive
- Every approval is an auditable package
- Impossible to forge or alter approval records without detection
- CI is the source of truth in strict/release modes

### Negative
- Additional ceremony for solo developers
- Requires discipline to maintain consistent evidence format

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Trust-based approval (no evidence) | Insufficient for regulated or team environments |
| Blockchain-based audit trail | Over-engineered; SHA-256 + git history sufficient |

## References

- Commits `3b99544`, `8f4cc56`: Evidence engine implementation
- Constitution C12: Actor segregation rule
