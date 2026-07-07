# Devflow vs Claude Code — Governance Layer vs AI Coding Agent

> Devflow is a local-first AI coding governance CLI. Claude Code is Anthropic's AI coding agent that reads, writes, and refactors code in your terminal. Claude Code generates code; Devflow audits it. They are designed to work together — Devflow's `--agent claude` option hardens CLAUDE.md with governance rules, and `devflow audit` reviews Claude Code's output before it becomes a PR.

## Positioning

Claude Code is an agentic AI coding tool that operates in your terminal alongside your editor. It can read your entire codebase, generate implementations from prompts, write and refactor code, run tests, and commit changes. It is powerful and autonomous — designed to accelerate development by letting the AI handle implementation while the developer focuses on architecture and review.

The power of Claude Code creates a governance problem. When an autonomous agent makes changes rapidly, how do you ensure those changes are traceable, evidence-backed, and independently reviewed? How do you prevent the agent from writing code before requirements are defined? How do you create an audit trail that a human reviewer can trust?

Devflow answers these questions by wrapping Claude Code in a governance framework. Before Claude Code writes code, Devflow ensures that requirements and test plans exist. After Claude Code produces changes, Devflow audits them for evidence: was adversarial review performed? Was the implementation log completed? Did a different actor approve the change? Devflow generates PR risk reports that document exactly what Claude Code produced, what governance checks were run, and what passed or failed.

The integration is bidirectional. Devflow's `--agent claude` option generates a hardened CLAUDE.md that includes explicit governance rules — telling Claude Code itself to respect the governance workflow. When Claude Code reads CLAUDE.md, it sees instructions like "Do not write code before `feature-coding-ready` state" and "Ensure requirements exist before implementation." This means Claude Code becomes a governed agent by default, not by afterthought.

## Comparison

| Dimension | Devflow | Claude Code |
|---|---|---|
| **Role** | Gatekeeper — audits, verifies, approves, generates governance evidence | Implementer — reads, writes, refactors, tests, and commits code |
| **What it produces** | Governance reports, audit logs, PR risk reports, approval decisions, evidence records | Code, implementations, refactors, tests, documentation |
| **What it checks** | Evidence: requirements, test plans, adversarial reviews, gate approvals, spec compliance, implementation log integrity, constitution adherence | Code output at generation time (limited self-verification based on CLAUDE.md instructions) |
| **When it acts** | Pre-commit, pre-push, pre-PR — audit and governance gates | During development session — on user request |
| **Enforces workflow** | Yes — no code before `feature-coding-ready` state; 15-state feature pipeline with blocking transitions | Respects CLAUDE.md instructions if present; no built-in workflow enforcement |
| **Adversarial review** | Yes — 12 deterministic attack vectors: bypass attempts, hallucination detection, prompt injection simulation, architecture boundary violations, dependency drift, spec deviation | No — does not adversarially test its own output |
| **PR risk report** | Yes — `devflow review-pr` generates standalone markdown or HTML report with full governance context | No |
| **Evidence trail** | Full audit log with content hashes (SHA-256), actor identity, timestamps, git context per decision | Session logs with transcript of interactions; no structured audit trail |
| **Constitution enforcement** | Yes — C1–C12: implementer != approver, CI mandates, evidence requirements, spec compliance | No — follows instructions but has no independent enforcement |
| **Requires API** | No — fully local, no cloud dependencies | Yes — requires Anthropic API key for AI model access |
| **Code leaves machine** | Never | Never (local agent; API calls send context to Anthropic) |
| **How they integrate** | `devflow install --agent claude` hardens CLAUDE.md; `devflow audit` checks Claude's output; `devflow feature prompt` generates structured prompts for Claude | Reads CLAUDE.md as governance context; implements within defined boundaries |
| **Multi-stack support** | TypeScript, JavaScript, Python, Go, Rust, PHP, Java (stack-adaptive pipeline gates) | Multi-language (model's training data; proficiency varies by language) |
| **Configuration** | `devflow config set reviewMode / executionMode / riskTolerance` | CLAUDE.md, `.claude/settings.json`, MCP server configuration |
| **Pricing** | Free, open-source (MIT) | API usage (Anthropic; token-based pricing) |
| **Setup time** | ~30 seconds | ~5 minutes (API key, install, authentication) |
| **User interface** | CLI with structured output, reports, status checks | Terminal-based chat and command interface |
| **Autonomy level** | Deterministic rule engine — no AI dependency | Autonomous AI agent — makes decisions, writes code, runs commands |

## How They Work Together: The Governed Development Loop

Devflow and Claude Code are designed as a pair. The integration creates a governed development loop where Claude Code implements within boundaries that Devflow defines and enforces.

### The 9-Step Governed Loop

1. **Initialize Governance**: `devflow install --agent claude` creates governance artifacts and hardens CLAUDE.md with rules that Claude Code reads on startup. This includes the constitution (C1–C12), workflow states, and coding constraints.

2. **Plan the Feature**: `devflow feature new my-feature` creates a feature workspace with directories for requirements, design, test plans, and logs. Devflow tracks state progression.

3. **Define Requirements**: The developer (or Claude Code, in a governed session) fills in requirements. Devflow verifies they exist before allowing code.

4. **Generate Implementation Prompt**: `devflow feature prompt my-feature --save` produces a structured implementation prompt that includes governance constraints, requirements references, and test plan expectations. Claude Code reads this prompt to understand both the feature and the governance boundaries.

5. **Implement with Claude Code**: Claude Code reads the prompt and CLAUDE.md, then implements the feature. Governance rules in CLAUDE.md tell it not to skip steps, not to modify governance artifacts, and to maintain the evidence trail.

6. **Audit Output**: `devflow audit` scans Claude Code's changes. It checks for evidence compliance, compares the implementation log against actual changes, and reports governance status.

7. **Verify Completeness**: `devflow feature complete my-feature` runs 25 Definition of Done checks — including stack-adaptive pipeline gates, evidence verification, and adversarial review status.

8. **Adversarial Review**: `devflow adversarial-review my-feature` tests Claude Code's output against 12 deterministic attack vectors: bypass attempts, hallucination detection, architectural drift, dependency spoofing, and more.

9. **Gate Approval and Report**: `devflow gatekeep my-feature --approve --actor reviewer` records independent approval (implementer != approver per C12). `devflow review-pr --format markdown` generates the final PR risk report documenting the complete governance trail.

## When to Use Each

### Use Devflow When

- You use Claude Code (or any AI agent) and want governance guardrails around its output — evidence requirements, workflow enforcement, adversarial review.
- You need an auditable trail showing that AI-generated code was planned, tested, adversarially reviewed, and independently approved — with content hashes and timestamps for each stage.
- You want to block AI-generated changes that lack requirements, test plans, adversarial review, or gate approval.
- You need a PR risk report that documents the governance status of AI-generated changes for human reviewers.
- You want to enforce constitutional rules: implementer != approver (C12), CI requirements, evidence mandates.
- You want a consistent governance layer that works regardless of which AI agent produced the code.

### Use Claude Code When

- You want an AI agent to implement features, write tests, refactor code, and run terminal commands autonomously.
- You need an agent that understands your full codebase context across multiple files and languages.
- You want to accelerate development by delegating implementation to AI while you focus on architecture and review.
- You are willing to pair Claude Code with Devflow for governance, rather than using it as an ungoverned agent.

### Use Both for a Complete Governance Loop

Devflow without Claude Code is a governance framework that requires manual implementation. Claude Code without Devflow is a powerful agent without guardrails. Together they create a system where:

- Devflow defines the governance boundaries; Claude Code implements within them.
- Devflow enforces the workflow; Claude Code accelerates the implementation.
- Devflow audits the output; Claude Code fixes what Devflow flags.
- Devflow records the evidence; Claude Code generates the code.

The loop repeats for each feature: govern -> implement -> audit -> fix -> approve -> merge.

## Quick Test

```bash
# Install Devflow with Claude Code integration
devflow install --agent claude

# Audit any recent changes — from Claude Code or any other tool
devflow audit

# Generate a PR risk report
devflow review-pr --format markdown --output claude-pr-report.md

# Full governance pipeline for a feature
devflow feature new my-ai-feature
devflow next

# After implementing with Claude Code:
devflow feature complete my-ai-feature
devflow adversarial-review my-ai-feature

# Independent gate approval (requires different actor than implementer)
devflow gatekeep my-ai-feature --approve --actor "human-reviewer"

# Final PR risk report
devflow review-pr --format markdown

# Verify governance health
devflow status --verbose
devflow doctor
```

## Limitations

- Devflow does not run inside Claude Code's process. It is a separate CLI that audits Claude Code's output after generation. It cannot prevent Claude Code from writing bad code — it can only detect and block it after the fact.
- Devflow's governance checks are deterministic and heuristic, not AI-powered. They verify the presence and structure of evidence artifacts, not the semantic quality of Claude Code's output. A requirements file containing "TODO" passes the requirements check.
- Claude Code may produce code that passes all Devflow governance checks but still contains bugs, security vulnerabilities, or architectural issues. Devflow does not replace human code review.
- Devflow cannot prevent a developer from bypassing the governance workflow entirely — skipping `devflow audit` and committing directly. CI-based Devflow gates catch this but run after the push.
- Claude Code's API usage sends code context to Anthropic's servers. Devflow itself does not require any network access, but Claude Code does.

## Next Steps

- Read the main [README](../../README.md) for the full Devflow command reference and architecture.
- Follow the **[Quick Start](../../README.md#quick-start)** to run the end-to-end governance pipeline with Claude Code.
- Configure risk tolerance: `devflow config set riskTolerance relaxed` for solo use, `strict` for release-grade enforcement.
- Integrate Devflow into CI using the [GitHub Action](../../action.yml) for pre-merge governance on Claude Code-generated PRs.
- Run `devflow doctor` to verify your governance setup is healthy across 16 dimensions.
