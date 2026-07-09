# Technology Stack

> EPIC-TD-001 Story 2.4 — Development Framework Documentation

## Runtime

- **Node.js:** 18+ (ESM modules)
- **Language:** TypeScript 5.x (strict mode)

## Core Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `commander` | CLI framework | ^12 |
| `picocolors` | Terminal colors | ^1 |
| `@clack/prompts` | Interactive prompts (optional) | ^0.x |

## Development Dependencies

| Tool | Purpose |
|------|---------|
| `vitest` | Test runner |
| `typescript` | Type checker + compiler |
| `eslint` | Linting |
| `@typescript-eslint/*` | TypeScript ESLint rules |

## AI Adapters (Optional)

| Provider | Package | Status |
|----------|---------|--------|
| Anthropic (Claude) | `@langchain/anthropic` | Dynamic import |
| OpenAI | `@langchain/openai` | Dynamic import |
| Ollama (local) | `@langchain/community` | Dynamic import |
| Google Gemini | `@langchain/google-genai` | Type declarations only |

## Architecture Layers

1. **CLI / Commands** — Commander.js command registration
2. **Kernel** — Core engine (workflow, discovery, state machine, DoD)
3. **Adapters** — External integrations (AI, git, process, stacks)
4. **Intelligence** — AI-powered analysis (LangGraph/RAG, scaffold)

## Output Formats

- Terminal (human-readable, colors via picocolors)
- JSON (pipe-safe, stdout)
- Markdown (PR reports)
- HTML (interactive dashboards)
