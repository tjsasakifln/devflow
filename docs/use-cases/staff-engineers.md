# Devflow for Staff Engineers — Defining Engineering Standards for AI-Assisted Development

> Staff Engineers define the standards that shape how engineering organizations build software. As AI-assisted development becomes the norm, the question is no longer "should we use AI coding tools?" but "what does good look like when we do?" Devflow gives Staff Engineers the tools to codify, enforce, and evolve engineering standards for AI-generated code.

---

## The Challenge

**Setting org-wide standards for AI-generated code.**

Every team in the organization uses AI differently. Some have strict rules about what AI can generate. Others have no rules at all. As a Staff Engineer, you need to establish standards that:

- Work across teams with different risk tolerances and maturity levels.
- Are enforceable, not aspirational — developers must be able to check compliance locally.
- Evolve with the team's understanding of AI-generated code risks.
- Do not slow down teams that already ship well-governed code.

Without codified standards, each team reinvents the wheel. Some adopt grudgingly permissive policies. Others adopt suffocating restrictions. Neither serves the organization.

---

## What Devflow Provides

Devflow is an engineering governance framework. It provides the scaffolding to define and enforce what "well-governed AI-generated code" means in your organization.

- **Constitution (C1-C12)**: Twelve codified engineering principles that govern AI-generated code. These cover evidence requirements, implementer-approver separation (C12), CI gates, state progression rules, and more. The constitution is checked programmatically on every feature.
- **Definition of Done checks (25 gates)**: Each gate enforces a specific standard — type safety, test evidence, coverage thresholds, integrity consolidation, artifact completeness.
- **Evidence requirements**: Standards are only as good as their evidence. Devflow requires that every governance claim be backed by artifacts with content hashes, timestamps, and actor identity.
- **Configuration as policy**: `riskTolerance`, `executionMode`, and `reviewMode` map to organizational tiers — internal tools get relaxed, critical services get strict.
- **Stack adapters**: Language-specific governance rules for TypeScript, JavaScript, Python, Go, Rust, PHP, and Java.

---

## Key Benefits

- **Codifies "what good looks like"**: The constitution and DoD checks translate abstract engineering principles into machine-enforceable gates. Every developer, regardless of experience, knows what is expected.
- **Makes standards enforceable**: Standards that live in a wiki are suggestions. Standards that are checked by `devflow feature complete` and `devflow gatekeep` are enforced.
- **Creates shared vocabulary**: Teams across the organization discuss "C12 violations" and "adversarial review vectors" rather than vague concerns about "AI quality." This accelerates cross-team collaboration.
- **Reduces onboarding burden**: New team members learn the organization's engineering standards by running `devflow status` and reading the constitution, not by reading a 50-page onboarding document.
- **Evolvable standards**: The constitution is a file (`.devflow/constitution.md`) that can be customized per project or team. Standards evolve through config changes, not process inertia.

---

## Recommended Flow

```
1. Audit current standards:  cat .devflow/constitution.md
2. Customize for team:       Edit .devflow/constitution.md to add org-specific rules
3. Set risk profile:         devflow config set riskTolerance <level>
4. Roll out to team:         devflow install on each repo
5. Integrate in CI:          Add devflow checks to GitHub Actions workflow
6. Monitor adoption:         devflow status --json to surface metrics
```

---

## What You Get

| Artifact | Description |
|----------|-------------|
| Codified constitution | C1-C12 rules with team-specific customizations — checked programmatically |
| DoD check matrix | 25 gates mapped to specific evidence requirements — machine-verifiable |
| Risk profile | Per-team or per-project riskTolerance mapping — from relaxed to strict |
| Adoption metrics | Confidence scores, state progression, gate fulfillment across repos |
| Traceable standards | Every standard has a C-number, an enforcement mechanism, and an evidence requirement |

---

## Constitution Highlights (C1–C12)

| Rule | Description |
|------|-------------|
| C1 | All AI-generated code must have traceable requirements |
| C2 | Evidence must accompany every governance claim |
| C3 | Tests must exist and pass before gate approval |
| C4 | Architecture boundaries must be preserved |
| C5 | Security patterns must be verified |
| C6 | Dangerous patterns are blocked at gate level |
| C7 | Spec-code alignment is verified |
| C8 | Implementation must follow state progression |
| C9 | CI gates are mandatory in strict mode |
| C10 | Adversarial review runs on every feature |
| C11 | Risk tolerance is explicit, not implicit |
| C12 | Implementer and approver must be different actors |

---

## Limitations

- The constitution is a heuristic framework. It enforces what can be expressed as a check — not every aspect of engineering judgment.
- Customizing the constitution requires git operations and team coordination. It is not a zero-effort process.
- Stack adapters provide language-specific checks but do not replace language-level tooling (linters, type checkers, SAST).

---

> **Next**: [Guide: Customizing the Devflow Constitution](../guides/customizing-constitution.md) (coming soon)
