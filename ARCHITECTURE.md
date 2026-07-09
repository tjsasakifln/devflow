# Devflow Architecture — Executive Summary

> Local AI Coding Governance with workflow engine, multi-agent orchestration, and brownfield discovery pipeline.

## Quick Reference

- **Language:** TypeScript (ESM, Node.js 18+)
- **CLI Framework:** Commander.js
- **Testing:** Vitest
- **Package:** `@tjsasakinpm/devflow`

## Architecture Layers

| Layer | Directory | Responsibility |
|-------|-----------|----------------|
| **CLI / Commands** | `src/cli/`, `src/commands/` | User-facing command registration and orchestration |
| **Kernel** | `src/kernel/` | Core engine: workflow, discovery, DoD checks, evidence, state machine |
| **Adapters** | `src/adapters/` | External integrations: AI models, git, process, stacks, project |
| **Intelligence** | `src/intelligence/` | AI-powered analysis (RAG, LangGraph — Phase 1 scaffold) |

## Source Tree

```
src/
├── adapters/     # AI models, git, process, stacks, integrations
├── cli/          # Commander.js command registration
├── commands/     # Individual command implementations
├── core/         # Audit, DoD, evidence, policy engines
├── errors/       # Error remediation
├── intelligence/ # AI analysis module
├── kernel/       # Core kernel (workflow, discovery, state, types, utils)
└── renderers/    # Output formatters (markdown, HTML, JSON, badges)
```

## Full Architecture Documentation

The complete, detailed architecture reference is maintained at:

📖 **[docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)**

This executive summary provides a high-level overview. Refer to the linked document for:
- Detailed layer descriptions and module maps
- Data flow diagrams and integration patterns
- C4 architecture diagrams
- Technology stack details and rationale
- Extension points and plugin architecture

---

*Last updated: 2026-07-08 — Story 1.7 (Architecture Consolidation)*
