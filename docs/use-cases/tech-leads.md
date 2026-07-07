# Devflow for Tech Leads — Preventing AI-Generated Regressions

> Tech Leads are responsible for architectural integrity, code quality, and preventing regressions. AI-generated code introduces a new class of risk: code that works in isolation but violates architecture boundaries, bypasses established patterns, or introduces subtle regressions. Devflow gives Tech Leads the tooling to catch these issues before they reach production.

---

## The Challenge

**Large AI-generated PRs, architecture violations, and regressions.**

AI coding agents do not carry the team's architectural context. They optimize locally — generating the code that satisfies the prompt — without understanding why certain patterns exist, why a particular abstraction was chosen, or what the system's architectural boundaries are.

Common failure modes Tech Leads observe:

- **Architecture boundary violations**: AI generates direct database access from a view layer because the prompt lacked context about clean architecture rules.
- **Pattern-breaking code**: The existing codebase uses repository pattern consistently, but AI generates a new implementation using raw queries — because the prompt described the "what" without the "how."
- **Missing error handling**: AI generates the happy path perfectly but omits error states, retry logic, and edge cases that a human domain expert would include.
- **Over-engineering**: AI adds abstractions, factories, and design patterns that the codebase does not use — solving problems the project does not have.
- **Silent regressions**: The code compiles and passes its own tests but breaks existing behavior, because the AI had no visibility into the full test suite.

---

## What Devflow Provides

Devflow helps Tech Leads operationalize architectural governance.

- **Adversarial review across 12 vectors**: Detects bypass attempts, hallucination patterns, architecture boundary violations, spec drift, and more. Run `devflow adversarial-review <id>` to generate a per-vector report.
- **Architecture checks**: The code analysis engine compares generated code against project patterns — type consistency, layer isolation, naming conventions, and structural alignment.
- **Dangerous pattern detection**: Flags eval usage, dynamic imports, insecure deserialization, hardcoded secrets, and other anti-patterns common in AI-generated code.
- **Spec-code gap analysis**: Compares AI-generated output against the requirements and design artifacts in the feature workspace. Flags missing implementations, over-implementations, and deviations from spec.
- **Evidence requirements**: Every feature must include test evidence, design documentation, and an implementation log before gate approval is possible.

---

## Key Benefits

- **Catches what code review misses**: Human reviewers cannot spot every architecture violation in a large AI-generated diff. Adversarial review systematically checks 12 vectors.
- **Enforces architecture boundaries**: Customize checks per stack adapter. TypeScript/JavaScript, Python, Go, Rust, PHP, and Java adapters provide language-specific governance.
- **Prevents "it works but breaks everything else"**: The 25 Definition of Done checks include integrity consolidation — verifying that new code does not silently break existing tests or introduce module-level regressions.
- **Reduces review burden**: Adversarial review catches the majority of architecture violations before human review, letting you focus on design tradeoffs rather than basic pattern enforcement.
- **Configurable specificity**: Set `riskTolerance strict` for critical paths (payment processing, auth, data pipelines) and `relaxed` for internal tooling.

---

## Recommended Flow

```
1. Feature creation: devflow feature new <name>
2. Complete checks:  devflow feature complete <id>    → 25 DoD checks
3. Adversarial:      devflow adversarial-review <id>  → 12 vectors
4. Gatekeep:         devflow gatekeep <id> --approve  → independent review
5. PR report:        devflow review-pr --format markdown
```

---

## What You Get

| Artifact | Description |
|----------|-------------|
| Per-vector adversarial report | 12 attack vectors — bypass, hallucination, boundary, spec drift, and more |
| Architecture violation log | Patterns, layers, naming conventions that break project standards |
| Dangerous pattern inventory | Every flagged anti-pattern across the feature workspace |
| Spec-code gap analysis | Requirements-to-implementation traceability report |
| Evidence completeness | Which artifacts exist, which are missing, and which failed validation |

---

## Practical Use Cases

**Preventing direct DB access from UI code**: The adversarial review checks layer isolation. If a feature introduces a data access call from a presentation-layer module, it is flagged — even if the code compiles and passes tests.

**Detecting copy-paste AI patterns**: If the AI generates code that mirrors an open-source snippet verbatim (potential license violation or untuned pattern), the review flags it as a hallucination vector.

**Enforcing test coverage for AI-generated logic**: If the feature passes its DoD checks but has no unit tests for the AI-generated business logic, gatekeep blocks approval until evidence is added.

---

## Limitations

- Architecture checks are heuristic — they examine structure and patterns, not runtime behavior. A violation that manifests only under specific runtime conditions will not be caught.
- Adversarial review is deterministic. It checks known attack vectors, not novel or context-specific ones. Human review remains essential for nuanced architecture decisions.
- Spec-code gap analysis depends on the quality of requirements and design artifacts. Thin artifacts produce thin analysis.

---

> **Next**: [Guide: Adversarial review for Tech Leads](../guides/adversarial-review-guide.md) (coming soon)
