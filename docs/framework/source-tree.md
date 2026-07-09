# Source Tree Guide

> EPIC-TD-001 Story 2.4 — Development Framework Documentation

```
src/
├── adapters/          # External integrations
│   ├── crew/          # AI agent runner
│   ├── git/           # Git operations, diff model, exclusion rules
│   ├── integration/   # Claude Code, CLI commands
│   ├── models/        # AI providers (Anthropic, OpenAI, Ollama) + retry
│   ├── process/       # Safe subprocess runner
│   ├── project/       # Feature detection, file scanner, inspector
│   └── stacks/        # Language adapters (TypeScript, Python, Go, Rust)
├── cli/               # Commander.js command registration + audit/review-pr entry
├── commands/          # Individual command implementations (~24 commands)
├── core/              # Audit engine, DoD engine, evidence engine, policy engine
├── errors/            # Error remediation
├── intelligence/      # AI-powered analysis (RAG, LangGraph — scaffold)
├── kernel/            # Core kernel
│   ├── actions/       # Next-action recommender
│   ├── artifacts/     # Artifact manager, generator, validator, templates
│   ├── audit/         # Audit chain verifier + generator
│   ├── checks/        # Sanity score, stage filter, tool verifier
│   ├── ci/            # CI status verifier
│   ├── cockpit/       # DEVFLOW.md generator
│   ├── config/        # Config manager
│   ├── constants/     # Path constants (FEATURES_DIR, AUDITS_DIR, etc.)
│   ├── constitution/  # Constitution checker + loader
│   ├── detection/     # Project type + stack detection
│   ├── discovery/     # Brownfield pipeline (scout, archaeologist, architect, detective, writer, renderers)
│   ├── dod/           # Definition of Done checks (8 modules)
│   ├── errors/        # Error definitions
│   ├── evidence/      # Evidence gatherer + confidence scorer
│   ├── guards/        # Pipeline, pre-action, refusal guards
│   ├── hooks/         # Pre-command hook system + warnings
│   ├── orchestration/ # Parallel spawner, adversarial verify, completeness critic
│   ├── renderers/     # Severity icons
│   ├── state/         # State detector + transition table
│   ├── tracking/      # Bypass detector
│   ├── types/         # Shared TypeScript interfaces
│   ├── utils/         # FS, git-context, hash, logger, markdown, prompts, CLI resolver, version
│   ├── validators/    # Loop, OO, semantic, structural validators
│   └── workflow/      # Workflow engine, loader, handoff, persistence, types
└── renderers/         # Output formatters (markdown, HTML, JSON, badges)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | CLI entry point |
| `src/kernel/constants/paths.ts` | Centralized path constants |
| `src/kernel/utils/logger.ts` | Unified logging abstraction |
| `src/kernel/workflow/engine.ts` | Universal workflow engine |
