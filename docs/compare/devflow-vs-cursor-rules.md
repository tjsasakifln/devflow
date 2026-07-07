# Devflow vs Cursor Rules — Governance CLI vs AI Editor Configuration

> Devflow is a local-first AI coding governance CLI. Cursor Rules (.cursorrules) are configuration files that guide the behavior of Cursor's AI code generation. Rules steer the AI before it writes code; Devflow audits what the AI produces after it writes code. They are complementary layers: rules guide generation, Devflow governs the output.

## Positioning

Cursor Rules are instructions you place in your project to shape how Cursor's AI behaves during code generation. They define coding conventions ("use TypeScript strict mode"), architectural constraints ("all API routes must have input validation"), and behavioral guidelines ("never use `any`"). Rules are written in markdown and placed in `.cursorrules` or referenced in Cursor's project settings.

Cursor Rules are **advisory**. They influence the AI's output by providing context and constraints in the prompt, but they have no enforcement mechanism. The AI may ignore them, partially apply them, or apply them incorrectly. There is no audit log of whether rules were followed. There is no way to block code that violates rules.

Devflow is **enforcement**, not guidance. It does not tell the AI how to write code. It audits the code that **any** AI tool produces — Claude Code, Cursor, Copilot, or any other agent. After the AI generates changes, Devflow runs a battery of governance checks: do requirements exist? Was a test plan written? Was adversarial review performed? Was an independent gate approval recorded? Did the implementer approve their own change?

Cursor Rules are also **Cursor-specific**. If your team uses Cursor and Claude Code and Copilot, each tool needs its own configuration. Devflow provides a consistent governance layer across all AI tools. If you switch agents or your team uses multiple AI tools, Devflow applies the same governance standards regardless of which tool produced the code.

The core difference in a sentence: Cursor Rules try to **prevent** bad generation before it happens. Devflow **detects** what slips through after generation. You need both — rules to guide the AI, governance to catch when the AI strays.

### How Cursor Rules Work

Cursor Rules are markdown files placed in your project root (`.cursorrules`) or defined in Cursor's settings. When you ask Cursor to generate code in a file or via chat, the rules are injected into the AI's context as system instructions. They can reference project conventions, architectural decisions, library choices, and coding standards. Rules are written in natural language and interpreted by the AI model. There is no validation, no enforcement, and no reporting — the AI applies them as it sees fit.

### How Devflow Works

Devflow is a standalone CLI that runs independently of any editor or AI tool. After code is generated (by any tool), Devflow reads the project's governance artifacts and runs deterministic checks. It enforces a workflow with 15 states, verifies evidence completeness, performs adversarial review against 12 attack vectors, and records gate approvals with full audit trails. Devflow's output is structured, deterministic, and auditable.

## Comparison

| Dimension | Devflow | Cursor Rules |
|---|---|---|
| **What it does** | Audits AI-generated changes for governance compliance: evidence, workflow, review, approval | Guides AI code generation behavior with project-specific instructions |
| **When it acts** | Pre-commit, pre-push, pre-PR — after code is written | During code generation — before and while code is written |
| **Coverage** | Any AI tool: Claude Code, Cursor, Copilot, generic LLM agents, human-written code | Cursor editor only |
| **Enforcement mechanism** | Hard enforcement: can block commits via hooks, fail CI gates, reject PRs based on governance criteria | Soft advisory: AI may follow, partially follow, or ignore rules |
| **Audit trail** | Full audit log with content hashes (SHA-256), actor identity, timestamps, git context, decision rationale | None — no record of whether rules were followed |
| **Checks for evidence** | Yes — requirements, test plans, implementation logs, adversarial reviews, gate approvals | No — rules guide code generation, not evidence creation |
| **PR risk report** | Yes — `devflow review-pr` generates structured markdown/HTML report | No |
| **Adversarial review** | Yes — 12 attack vectors: bypass attempts, hallucination detection, prompt injection simulation, architecture boundary violations, dependency drift, spec deviation | No |
| **Workflow enforcement** | Yes — feature pipeline with 15 progression states; no code before `feature-coding-ready`; blocking transitions | No |
| **Constitution enforcement** | Yes — C1–C12 rules: implementer != approver (C12), CI mandates, evidence requirements | No |
| **Risk tolerance levels** | relaxed, moderate, strict — gates change from advisory to blocking based on mode | Single mode — rules are always advisory |
| **Multi-stack** | TypeScript, JavaScript, Python, Go, Rust, PHP, Java (stack-adaptive gates) | Language-agnostic (advisory text, no stack awareness) |
| **Configuration format** | `devflow config set key value` + `.devflow/config.json` | `.cursorrules` markdown file |
| **Code leaves machine** | Never | Never |
| **Requires specific editor** | No — standalone CLI, any editor | Yes — requires Cursor editor |
| **Works with other AI tools** | Yes — Claude Code, Copilot, any AI agent | No — Cursor only |
| **Setup time** | ~30 seconds (`npx @tjsasakinpm/devflow install`) | Minutes (writing and iterating `.cursorrules`) |
| **Pricing** | Free, open-source (MIT) | Included with Cursor editor subscription |
| **Can block PRs** | Yes — governance gates in CI | No |
| **Maintenance** | CLI updates via npm; configuration is version-controlled | Rules maintained in-project; no versioning or update mechanism |
| **Output format** | Structured reports, JSON audit logs, approval records | No output — rules are input only |
| **Deterministic** | Yes — same input always produces same governance result | No — AI model interpretation may vary |

## Common Misconceptions

- **"Cursor Rules are enough governance."** Cursor Rules guide code generation but provide no enforcement, no audit trail, and no verification after the fact. They cannot tell you whether requirements exist, whether adversarial review was performed, or whether an independent approval was recorded. Devflow provides these guarantees.

- **"Devflow replaces Cursor Rules."** Devflow does not influence code generation at all. It audits the output after it is produced. Cursor Rules are still valuable for shaping Cursor's output toward your conventions and reducing the issues Devflow needs to flag.

- **"If you have good Cursor Rules, you don't need Devflow."** Good rules reduce the likelihood of bad generation but cannot eliminate it. The AI may misinterpret rules, apply them inconsistently, or generate code that is syntactically correct but architecturally unsound. Devflow catches these failures.

- **"Devflow works the same way as Cursor Rules."** Cursor Rules are input-side configuration (guide the AI before generation). Devflow is output-side verification (audit the result after generation). They operate at opposite ends of the code generation pipeline.

## When to Use Each

### Use Devflow When

- You want to audit and enforce governance on AI-generated code **regardless of which AI tool produced it** — Cursor, Claude Code, Copilot, or any other agent.
- You need a verifiable evidence trail for every AI-generated feature: who planned it, who implemented it, who reviewed it, who approved it, with timestamps and content hashes.
- You want to block changes that lack engineering justification, not just changes with bad style or incorrect syntax.
- You need PR risk reports that document governance outcomes for human reviewers and compliance audits.
- Your team uses multiple AI coding tools and needs a consistent governance layer across all of them.
- You want to enforce workflow rules — AI agents should not write code before requirements and test plans are defined.
- You need adversarial review that stress-tests AI-generated output for bypass attempts, hallucinated APIs, architectural drift, and spec deviations.

### Use Cursor Rules When

- You want to shape Cursor's code generation to match your project's conventions and architectural patterns.
- You want to prevent common mistakes at generation time — before Devflow or any other tool audits the output.
- You are a Cursor-only team and want lightweight, in-editor guide rails on generated code.
- You want to encode project-specific knowledge (library choices, naming conventions, architectural patterns) into the AI's context so it produces more idiomatic code from the start.
- You want to reduce governance noise — good rules mean less for Devflow to flag.

### Use Both for Defense-in-Depth

Cursor Rules and Devflow operate at different times and serve different functions. Used together, they create a complete governance loop:

1. **Generation Time (Cursor Rules)**: Rules guide the AI toward good output. They prevent common mistakes, enforce naming conventions, and encode architectural constraints. This reduces the number of issues Devflow needs to flag.
2. **Post-Generation (Devflow)**: Devflow audits the output regardless of which AI produced it. It checks for evidence, workflow compliance, adversarial robustness, and gate approval — things that cursor rules cannot check.
3. **Pre-Push (Devflow)**: Devflow blocks pushes that lack governance evidence, regardless of how well the code was generated.
4. **CI (Devflow)**: Devflow's CI gate re-verifies governance for the final PR diff.

Cursor Rules reduce the noise Devflow needs to flag. Devflow provides the enforcement that Cursor Rules lack. Together they create a complete loop: guide at generation time, verify at governance time.

## Real-World Scenario

Your team uses Cursor with carefully written `.cursorrules` that specify:
- "Use TypeScript strict mode"
- "Never use `any`"
- "All API endpoints must have input validation with Zod"
- "Use the repository pattern for data access"

Cursor generates a new API feature that follows all these rules. The code looks clean. However:

- The rules said nothing about writing requirements first. There are none.
- The rules said nothing about test plans. The AI wrote tests alongside the code, but they only cover happy paths.
- The rules said nothing about adversarial review. The generated code uses an npm package that has a known supply-chain issue — no dependency validation was performed.
- The rules said nothing about gate approval. The developer who ran Cursor also approved the PR.

Cursor Rules produced well-styled code that follows the project's architectural patterns. But the governance artifacts — requirements, test plans, adversarial review, independent approval — are all missing. Devflow catches all four gaps.

## Quick Test

```bash
# Devflow governance audit — works on code from any AI tool
devflow audit

# Devflow install with governance hardening
devflow install

# Generate a PR risk report
devflow review-pr --format markdown

# Devflow full status
devflow status --verbose

# Devflow doctor — 16-point health check
devflow doctor

# Compare: view your Cursor Rules (if using Cursor)
cat .cursorrules

# Devflow works the same whether or not Cursor Rules exist
devflow audit --risk-tolerance strict
```

The practical difference: `.cursorrules` might instruct Cursor to "always use async/await" and "never use callbacks." Devflow checks whether the change has a requirements document, whether adversarial review was performed, and whether an independent gatekeeper approved the change. Cursor Rules influence how the code is written; Devflow ensures the process around the code is complete.

## Limitations

- Devflow does not influence code generation. It cannot prevent bad code from being written — it can only detect and block it after the fact.
- Cursor Rules do not provide enforcement. The AI can ignore them, apply them incorrectly, or produce code that violates rules without any alert.
- Devflow's governance checks are heuristic — they verify artifact existence, not artifact quality. A cursor rule might produce better code, but Devflow will not measure that improvement.
- Cursor Rules are scoped to one editor. If a developer uses Claude Code or Copilot, cursor rules have no effect. Devflow works across all tools.
- Neither tool replaces human judgment in architectural decisions or code review.

## Next Steps

- Read the main [README](../../README.md) for the full Devflow command reference and architecture.
- Try `devflow feature new my-feature` to start a governed feature workspace end-to-end.
- Run `devflow adversarial-review my-feature` to test AI-generated code against 12 attack vectors.
- Configure risk tolerance: `devflow config set riskTolerance strict` for maximum enforcement.
- See `devflow status --verbose` for a complete picture of your governance state.
