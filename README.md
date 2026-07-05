# Devflow

> State-aware workflow operating system for AI-assisted software development

[![npm version](https://img.shields.io/npm/v/@devflow/cli)](https://www.npmjs.com/package/@devflow/cli)
[![node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Devflow** detects your project state (greenfield, brownfield, spec-driven, feature-in-progress), runs guard rails, and recommends the next best action — integrates natively with Claude Code.

## Quick Start

```bash
npx @devflow/cli init
devflow status
devflow next
```

## Commands

| Command | Description |
|---------|-------------|
| `devflow init` | Initialize Devflow in the current directory |
| `devflow status` | Show current project state and evidence |
| `devflow next` | Recommend the next best action |
| `devflow feature new <name>` | Create a feature workspace |
| `devflow doctor` | Diagnose and fix issues |
| `devflow update-cockpit` | Regenerate DEVFLOW.md |

## Project States (20-state engine)

| Category | States |
|----------|--------|
| **Greenfield** | `greenfield-empty`, `greenfield-with-readme`, `greenfield-with-prd` |
| **Brownfield** | `brownfield-no-specs`, `brownfield-specs-exist`, `brownfield-sdd-exists` |
| **Feature** | `feature-requirements`, `feature-clarify`, `feature-plan`, `feature-to-do`, `feature-coding`, `feature-review`, `feature-complete`, `feature-archived` |
| **Meta** | `unknown`, `needs-init`, `blocked`, `error`, `idle`, `migration-in-progress` |

## Installation

```bash
npm install -g @devflow/cli
# or
npx @devflow/cli init
```

Requires Node.js >= 18.

## Output Files

| File | Purpose |
|------|---------|
| `.devflow/` | Internal state (state.json, config.json) |
| `_devflow/` | Output artifacts |
| `DEVFLOW.md` | Project cockpit — current state, next action, history |
| `CLAUDE.md` | Devflow section appended for Claude Code integration |
| `.claude/settings.json` | `/devflow` slash command config |

## Development

```bash
git clone https://github.com/devflow/devflow
cd devflow
npm install
npm run build
npm test
```

## License

MIT — see [LICENSE](LICENSE).
