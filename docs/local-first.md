# Local-First Privacy — Devflow

## How Devflow Runs

Devflow is a CLI tool that runs on your machine. It does not have a SaaS backend.
All governance checks — audit, review, adversarial analysis — execute locally.

## What Devflow Does NOT Do

- Does NOT send code to LLM providers (OpenAI, Anthropic, Google, etc.)
- Does NOT send code to third-party review services
- Does NOT collect telemetry or usage data
- Does NOT require API keys for core functionality
- Does NOT have a cloud backend or database

## What Devflow Reads

- Project source files (for analysis)
- Git history (for diff computation)
- package.json, tsconfig.json, pyproject.toml, etc. (for stack detection)
- .devflow/ and _devflow/ directories (for feature/artifact state)
- .gitignore and .devflowignore (for exclusion rules)

## What Devflow Writes

- .devflow/ — internal state, config, audit logs
- _devflow/ — feature artifacts, discovery reports
- DEVFLOW.md — auto-generated project cockpit
- Report files (.md, .html, .json) — only where you specify (--output flag)

## GitHub Actions

When run in GitHub Actions:
- Code is processed inside the GitHub Actions CI runner
- No code is sent to Devflow servers (there are none)
- No code is sent to LLM providers
- Artifact upload (optional) stores the risk report on GitHub's servers
- Artifact retention is controlled by your workflow configuration

## User Responsibility

- CI configuration: you control which workflows run and what artifacts are uploaded
- Runner security: GitHub-hosted runners are managed by GitHub; self-hosted runners are managed by you
- Secrets: Devflow scans for hardcoded secrets as a heuristic check, not a replacement for a secrets manager
- Future AI features: optional AI-assisted features (when available) will require explicit opt-in and provider configuration

## Limits of This Promise

- Devflow cannot prevent a user from copying code and sending it elsewhere
- Devflow cannot prevent a malicious dependency from exfiltrating data
- Devflow's heuristic checks are not formal security verification
- If you configure CI to upload artifacts, those artifacts live on GitHub's infrastructure

## Verification

You can verify Devflow's behavior:
- Source code is open (MIT license): https://github.com/tjsasakifln/devflow
- Network requests: use a firewall or proxy to confirm no outbound requests during audit
- Dependencies: npm list --production shows only commander, @clack/prompts, picocolors
