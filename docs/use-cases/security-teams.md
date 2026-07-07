# Devflow for Security Teams — Auditing AI-Generated Code for Security Risks

> AI coding agents can introduce security vulnerabilities that differ from human-introduced ones. They generate code that looks correct but contains eval-like patterns, hardcoded credentials, injection-prone constructs, and logic flaws that bypass typical human review. Devflow gives security teams automated, local-first tooling to catch these vulnerabilities before they reach production — without sending code to external AI services.

---

## The Challenge

**AI agents can introduce security vulnerabilities in unexpected ways.**

Unlike human developers, AI agents do not have an internal threat model. They generate code based on patterns in their training data, not on an understanding of your security posture. This leads to vulnerabilities that are distinct from human errors:

- **Eval and dynamic execution**: AI models are prone to generating `eval()` calls, dynamic imports, and string-to-code patterns — especially when the prompt describes flexible or configurable behavior.
- **Hardcoded secrets**: AI agents frequently inline API keys, database passwords, and tokens into code — because their training data contains examples where secrets are embedded.
- **Injection vulnerabilities**: AI-generated code often constructs SQL queries, shell commands, or file paths through string concatenation without sanitization.
- **Insecure defaults**: AI agents reach for default configurations (e.g., `cors({ origin: true })`, `DEBUG=True`) that are insecure in production.
- **Cryptography misuse**: AI models generate custom encryption, hashing, or random number generation that looks plausible but is cryptographically unsound.
- **Logic bypasses**: AI-generated authentication or authorization checks often have gaps — missing return statements, reversed conditions, or incomplete validation.

---

## What Devflow Provides

Devflow does not replace SAST or DAST tools. It provides a specialized governance layer for AI-generated code risks.

- **Dangerous pattern detection**: Scans code for known AI-introduced vulnerability patterns: `eval()`, `exec()`, hardcoded credentials, dynamic SQL construction, insecure deserialization, and cryptography anti-patterns. This check is built into `devflow feature complete`.
- **Security vector in adversarial review**: Vector 6 of the 12-vector adversarial review focuses specifically on security bypass and vulnerability introduction. Run `devflow adversarial-review <id>` and review the security vector output.
- **Secret scanning**: Detects inline secrets (API keys, tokens, passwords) in AI-generated code. Flagged as a blocking gate in `moderate` and `strict` risk tolerance modes.
- **Local-first threat detection**: All checks run locally. No code is sent to cloud services. The analysis is deterministic and reproducible.
- **Audit trail for compliance**: Every security check result is logged with content hashes and timestamps. Generate compliance-ready reports with `devflow review-pr`.

---

## Key Benefits

- **Catches AI-introduced vulnerabilities pre-commit**: Run `devflow audit` before commit to catch dangerous patterns before they enter the repository. The feedback cycle is seconds, not days.
- **Does not send code to the cloud**: No API keys, no external service calls. Your codebase stays on your machine. Essential for regulated environments, air-gapped setups, and organizations with strict data governance policies.
- **Audit trail for compliance**: Every security check is logged: what was checked, what was found, when, and by whom. Exportable for compliance reviews and security audits.
- **Heuristic coverage for known AI patterns**: The pattern library is built from observed AI-generated vulnerability categories — it covers what AI agents actually do wrong, not just generic SAST rules.
- **Configurable severity**: In `relaxed` mode, dangerous patterns are advisory. In `strict` mode, they block gate approval. Set per-project or per-feature.

---

## Recommended Flow

### Local (pre-commit)

```bash
# Pre-commit governance audit
devflow audit --risk-tolerance moderate

# If dangerous patterns found, review and fix
devflow feature complete <id>    # Check all 25 gates including security
```

### Pre-PR

```bash
# Generate a PR risk report with security findings
devflow review-pr --format markdown --output pr-security-report.md

# Adversarial review — pay attention to security vector
devflow adversarial-review <id>
```

### CI

```bash
# In GitHub Actions, run gates on every PR
# Security violations block the pipeline in strict mode
devflow feature complete <id>
devflow gatekeep <id> --approve --actor github-actions
```

---

## What You Get

| Artifact | Description |
|----------|-------------|
| Dangerous pattern report | Every flagged security anti-pattern with file location and severity |
| Security vector analysis | Adversarial review output specific to security bypass vectors |
| Secret scan result | Detected credentials, tokens, and secrets in AI-generated code |
| Compliance log | Timestamped, hashed record of all security checks performed |
| PR risk report | Consolidated security posture summary attached to the PR |

---

## Limitations

- **Heuristic only**: Devflow detects patterns, not vulnerabilities. A flagged `eval()` might be benign in a build script. A missing flag does not mean the code is secure.
- **Not a replacement for SAST/DAST**: Devflow does not perform data flow analysis, taint tracking, or dynamic scanning. Use it alongside existing SAST tools (Semgrep, CodeQL, SonarQube) and DAST tools for comprehensive coverage.
- **Adapter-dependent coverage**: Security checks are implemented in stack adapters. TypeScript/JavaScript has the richest coverage. Python, Go, Rust, PHP, and Java adapters have varying levels of security pattern completeness.
- **No network-layer analysis**: Devflow operates on static code. It does not analyze runtime behavior, network calls, or dependency supply chain risks.

---

> **Next**: [Guide: Security checks and dangerous pattern detection](../guides/security-checks-guide.md) (coming soon)
