# ADR-001: Three-Layer Architecture (Kernel/Intelligence/Adapters)

- **Status:** Accepted
- **Date:** 2026-05-15
- **Deciders:** Devflow Architecture Team

## Context

The original codebase had a flat `src/` structure with 15 directories, including 7 deprecated wrapper directories. Module boundaries were unclear, imports crossed layers bidirectionally, and there was no clear separation between core business logic, external integrations, and AI-powered features.

## Decision

Split the system into three strict layers with unidirectional dependency flow:

1. **Kernel** (`src/kernel/`) — Core engine: workflow, discovery, DoD checks, evidence, state machine, configuration, types, utilities. No external dependencies beyond Node.js stdlib.
2. **Adapters** (`src/adapters/`) — External integrations: AI models, git, process, stacks, project. May depend on Kernel but never the reverse.
3. **Intelligence** (`src/intelligence/`) — AI-powered analysis (RAG, LangGraph). May depend on Kernel types but is loaded dynamically. Considered a first-class architecture layer subject to ADR-007.

## Consequences

### Positive
- Clear module boundaries enable independent testing
- Import paths unambiguously indicate layer membership
- Kernel can be extracted as a standalone package

### Negative
- Some Kernel utilities (logger, fs) are re-exported by Adapters which creates a thin indirection
- Intelligence module is scaffold only (Phase 1) — investment required for full implementation

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Flat monolith with no layers | Already proven unmaintainable (7 deprec dirs, bidirectional imports) |
| Hexagonal Architecture (ports/adapters) | Over-engineered for CLI tool; port abstractions would create unnecessary ceremony |
| Microservices | Not applicable — Devflow is a local CLI tool |

## References

- Commit `8157308`: Initial kernel extraction
- `ARCHITECTURE.md`: Layer diagram and source tree
- `ADR-007`: Intelligence module scope
