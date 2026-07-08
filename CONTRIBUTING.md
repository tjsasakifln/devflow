# Contributing to Devflow

Thank you for considering contributing to Devflow — the local AI coding governance CLI. Devflow helps teams audit AI-generated code, enforce evidence-driven workflows, and generate PR risk reports. Every contribution strengthens the engineering standards of the AI-assisted development ecosystem.

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/tjsasakifln/devflow.git
cd devflow

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run type checking
npm run typecheck
```

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9
- A GitHub account for pull requests

---

## Development Workflow

1. **Branch**: Create a branch from `main` named after your change:

   ```bash
   git checkout -b feat/add-stack-adapter
   ```

2. **Code**: Write TypeScript with strict types. All imports use `.js` extensions (ESM). See [Code Style](#code-style).

3. **Test**: Add or update tests for your change. Run `npm test` before committing. See [Testing Requirements](#testing-requirements).

4. **Commit**: Use [conventional commits](#commit-conventions).

5. **Push and PR**: Push your branch and open a pull request against `main`.

---

## Code Style

- **Language**: TypeScript with `strict: true` in tsconfig.json. No `any` unless unavoidable and annotated.
- **Module system**: ESM (`"type": "module"` in package.json). All local imports must include the `.js` extension:
  ```typescript
  import { runAudit } from "./core/audit-engine.js";   // correct
  ```
- **Formatting**: No Prettier dependency. Use common sense — consistent indentation (2 spaces), meaningful variable names, and JSDoc comments on exported functions.
- **No unused locals or parameters**: The `noUnusedLocals` and `noUnusedParameters` flags are on.
- **No fallthrough**: `noFallthroughCasesInSwitch` is enforced.
- **Declaration files**: Public API exports must have `.d.ts` declarations generated via `tsconfig.build.json`.

Run `npm run typecheck` to verify.

---

## Testing Requirements

- **Framework**: [vitest](https://vitest.dev) v2. All tests live under `test/` with the same directory structure as `src/`.
- **New features must include tests**. Minimum coverage: unit tests for core logic, integration tests for CLI commands.
- Run the full suite before pushing:
  ```bash
  npm test          # run all tests
  npm run test:coverage  # check coverage
  ```
- Test files should mirror the source file name, e.g., `test/unit/core/audit-engine.test.ts`.
- For CLI commands, use vitest's `spy` or `mock` to avoid side effects on the filesystem. Use fixtures from `test/fixtures/` where needed.

---

## Commit Conventions

This project uses **conventional commits**. Every commit message must be structured as:

```
<type>: <short description>

[optional body]
```

Allowed types:

| Type     | Usage                                        |
|----------|----------------------------------------------|
| `feat:`  | A new feature or command                     |
| `fix:`   | A bug fix                                    |
| `chore:` | Build, CI, dependencies, tooling             |
| `docs:`  | Documentation only (README, ARCHITECTURE.md) |
| `refactor:` | Code change that neither fixes nor adds   |
| `test:`  | Adding or fixing tests                       |
| `style:` | Code style changes (formatting, no logic)    |
| `perf:`  | Performance improvement                      |

Examples:

```
feat: add Rust stack adapter with cargo test/lint/typecheck
fix: handle empty diff in audit-engine when no changes detected
docs: add CONTRIBUTING.md and ARCHITECTURE.md
chore: bump commander to 12.1.0
```

---

## Pull Request Process

1. Open a PR against `main` using the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
2. Ensure all CI checks pass (tests, typecheck, build).
3. A maintainer will review your PR. Address all feedback.
4. At least one approval from a project maintainer is required before merging.
5. Squash-merge into `main` with a clean conventional commit message.

---

## Areas Needing Contribution

- **Stack adapters** (`src/adapters/stacks/`): Implement the `StackAdapter` interface for additional languages (Ruby, PHP, Java, C#, Swift, Kotlin, Elixir).
- **Integrations** (`src/adapters/integration/`): Add support for additional AI coding tools beyond Claude Code.
- **Documentation**: Improve how-to guides, use-case pages, and comparison docs.
- **Examples**: Add real-world example workflows under `examples/`.
- **Security scanning**: Extend dangerous pattern detection in `src/adapters/stacks/typescript/dangerous-patterns.ts` and stack adapters.
- **Monorepo support**: Enhance `src/kernel/detection/stack.ts` to detect package-level changes.
- **Workflow engine**: Extend `src/kernel/workflow/engine.ts` with new task types and workflow patterns.
- **Multi-agent orchestration**: Contribute new orchestration patterns in `src/kernel/orchestration/`.
- **Brownfield discovery**: Add new analysis phases in `src/kernel/discovery/`.
- **Test coverage**: Help us reach 90%+ coverage across core modules.

---

## CLAUDE.md

This repository includes a `CLAUDE.md` file that provides instructions for AI agents (Claude Code, Cursor, etc.). If you contribute code that affects how agents interact with the project — such as new commands, workflow changes, or agent-facing configurations — please update `CLAUDE.md` to reflect those changes.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE) that covers this project.
