# Security Policy

Devflow is a local-first AI coding governance CLI. It scans code locally, generates reports, and never sends your code to any external service. This policy covers security vulnerabilities in the Devflow project itself.

---

## Reporting a Vulnerability

If you discover a security vulnerability in Devflow, please report it through one of the following channels:

1. **GitHub Security Advisory**: [Create a private advisory](https://github.com/tjsasakifln/devflow/security/advisories/new)
2. **Email**: Reach out to the repository maintainers via the contact information in the GitHub profile

We ask that you **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

### What to Include

- A clear description of the vulnerability
- Steps to reproduce (PoC or minimal example preferred)
- Affected versions (check with `devflow --version`)
- Potential impact
- Any suggested remediation (optional)

---

## Scope

### In Scope

- `src/` -- all source code, including core logic, CLI, adapters, renderers, and kernel
- `templates/` -- project templates shipped with the CLI
- `action.yml` -- the GitHub Action composite entry point
- Dependency vulnerabilities in production dependencies (`commander`, `@clack/prompts`, `picocolors`)

### Out of Scope

- `docs/` and `examples/` -- documentation and example files
- Third-party AI tools (Claude Code, Cursor, Copilot) -- vulnerabilities in those tools should be reported to their respective maintainers
- Code generated or audited by Devflow -- Devflow is a governance tool, not a security guarantee
- CI/CD pipeline configurations in consuming projects
- Theoretical attacks requiring physical access, social engineering, or modified dependencies

---

## Safe Harbor

We consider security research conducted in accordance with this policy as authorized conduct. We will not pursue legal action against researchers who:

- Report vulnerabilities in good faith
- Follow this disclosure policy
- Do not access or modify data beyond what is necessary to demonstrate the vulnerability
- Do not exploit a vulnerability beyond minimal proof of concept

---

## Known Limitations

Devflow is a CLI tool, not a sandbox. The following limitations are acknowledged:

- **No runtime isolation**: Devflow runs in the user's Node.js process. It cannot prevent deliberate bypass of its checks by a user who runs `--force` or modifies `.devflow/` state files directly.
- **Heuristic checks, not formal verification**: Pattern-based dangerous code detection has inherent false positive and false negative rates. It is a heuristic, not a formal proof of correctness or security.
- **No SAST/DAST integration yet**: Static and dynamic application security testing are future work. Devflow does not currently replace dedicated security scanning tools.
- **Dependency scanning**: Devflow does not scan for vulnerable dependencies. Use `npm audit`, `snyk`, or `Dependabot` for that purpose.
- **Token and secret detection**: The built-in pattern check for hardcoded secrets is basic. For production secret scanning, use dedicated tools like `truffleHog` or `git-secrets`.

---

## Dependencies

Devflow has minimal production dependencies:

| Package          | Version | Purpose                   |
|------------------|---------|---------------------------|
| `commander`      | ^12.1   | CLI argument parsing      |
| `@clack/prompts` | ^0.7    | Interactive prompts       |
| `picocolors`     | ^1.1    | Terminal color output     |

Supply chain risk is low -- all packages are well-maintained, widely used, and have small surface areas. DevDependencies (TypeScript, vitest, tsx, rimraf) are only required during development.

---

## Version Support

Only the **latest stable release** of Devflow receives security updates. Users are encouraged to stay current:

```bash
npm update -g @tjsasakinpm/devflow
```

| Version | Supported          |
|---------|--------------------|
| latest  | :white_check_mark: |
| older   | :x:                |

---

## Response Time

This is an open-source project maintained by volunteers. We make best-effort attempts to:

- Acknowledge receipt of a vulnerability report within **5 business days**
- Triage and provide an initial assessment within **10 business days**
- Release a fix within **30 days** for confirmed HIGH or CRITICAL findings

No formal SLA applies. If you have not received a response within these timeframes, please follow up on the original report.
