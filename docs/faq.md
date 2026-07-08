# Frequently Asked Questions

> Common questions about Devflow — how it works, what it does and does not do, and how it fits into your development workflow.

---

### 1. Is Devflow a replacement for CodeRabbit?

No, they are complementary. CodeRabbit reviews code inline on pull requests — it analyzes diffs for logic errors, style issues, and anti-patterns, then posts inline comments. Devflow audits governance **before** the PR — it checks whether AI-generated changes have evidence, requirements, test coverage, adversarial review, and gate approval. CodeRabbit inspects the code; Devflow inspects the process around the code. Many teams use both: Devflow for pre-PR governance, CodeRabbit for post-PR code review.

---

### 2. Does Devflow send code to the cloud?

No. Devflow is fully local. Every check runs on your machine. No API keys are required. No telemetry is sent. No code ever leaves your environment. This is by design — Devflow is built for teams that cannot or will not send proprietary code to third-party AI services. It works in air-gapped environments, regulated industries, and offline setups.

---

### 3. Can Devflow review Cursor-generated code?

Yes. Devflow audits code regardless of which AI agent generated it. The governance checks operate on the working tree and examine the code for evidence quality, dangerous patterns, architecture violations, and spec compliance — not for which tool produced it. Cursor, Claude Code, Copilot, and manual code are all treated identically.

---

### 4. Can Devflow audit Claude Code output?

Yes. Devflow is designed to work alongside Claude Code. When you run `devflow install --agent claude`, it hardens your CLAUDE.md with governance rules that Claude Code reads before generating code. This ensures Claude Code respects your project's constitution, evidence requirements, and state progression rules. Devflow then audits the output against those same rules.

---

### 5. How is this different from a linter?

Linters check syntax and style — formatting, unused variables, common anti-patterns defined by rulesets. Devflow checks **governance**: whether evidence exists for claims, whether adversarial review has been run, whether requirements trace to implementation, whether the implementer and approver are different actors, and whether the feature has passed gate approval. A linter answers "does this code look right?" Devflow answers "was this code produced responsibly?"

---

### 6. Can I use Devflow before opening a pull request?

Yes — that is the primary use case. Devflow is designed to run pre-commit and pre-PR. `devflow audit` scans your working tree for governance issues before anything is pushed. `devflow review-pr` generates a risk report that you attach to the PR description. This is a core design principle: governance should happen **before** code reaches a reviewer, not after.

---

### 7. Does Devflow work with legacy codebases?

Yes. The `devflow discover` command performs brownfield analysis, generating four reports that document the existing codebase structure, patterns, dependencies, and conventions. Heuristic checks in the code analysis engine adapt to existing project patterns — they learn from how the codebase is structured rather than enforcing blanket rules. Configuration options like `riskTolerance relaxed` help teams introducing governance to legacy codebases without blocking everything.

---

### 8. Can solo developers use Devflow without a reviewer?

Yes. Solo-hardened mode (`devflow config set reviewMode solo-hardened`) allows self-approval — the implementer can also be the approver — but requires compensating controls: adversarial review must pass, dangerous patterns must be addressed, and evidence must be complete. This gives solo developers automated governance guardrails without requiring a second person to review every change.

---

### 9. Does Devflow require API keys?

No. Devflow requires no API keys, no SaaS accounts, and no cloud services. All checks are deterministic and run locally. AI-powered features (`ai-init`, `adversarial-review-ai`, `actions-generate`) are available but fully opt-in — they require explicit configuration and a model provider (Anthropic, OpenAI, or Ollama for fully local). No data is sent to any service unless you configure it to do so.

---

### 10. Can Devflow run in CI?

Yes. Devflow integrates with GitHub Actions via the `action.yml` file in the repository root. The same commands (`devflow feature complete`, `devflow adversarial-review`, `devflow gatekeep`, `devflow review-pr`) work identically in local and CI environments. See [docs/guides/how-to-use-devflow-with-github-actions.md](guides/how-to-use-devflow-with-github-actions.md) for setup instructions.

---

### 11. What languages does Devflow support?

Devflow has first-class support for TypeScript and JavaScript, with stack adapters for Python, Go, Rust, Ruby, PHP, and Java. Each adapter provides language-specific checks: type safety validation, dependency analysis, pattern detection, and test framework integration. Adapter coverage varies — TypeScript and JavaScript have the richest set of checks available.

---

### 12. Does Devflow guarantee bug-free code?

No. Devflow catches dangerous patterns and governance gaps — missing tests, missing evidence, implementer-approver conflicts, architecture violations, and known anti-patterns common in AI-generated code. It does not perform formal verification, runtime analysis, or exhaustive bug detection. Human code review, testing, and QA processes remain essential. Devflow increases confidence in the governance process, not in the absence of bugs.

---

### 13. Can I customize the checks?

Yes. The `riskTolerance` setting (relaxed, moderate, strict) controls which gates are advisory versus blocking. The `executionMode` setting controls CI requirements. The `.devflowignore` file supports exclusions. The constitution is defined in `.aiox-core/constitution.md` and can be customized per project. Stack adapters can be extended with project-specific checks. See `devflow config set --help` for available options.

---

### 14. Is Devflow open source?

Yes. Devflow is released under the MIT license. The source code is available at [github.com/tjsasakifln/devflow](https://github.com/tjsasakifln/devflow). Contributions, forks, and custom deployments are welcome and explicitly permitted by the license.

---

### 15. How do I contribute?

See the CONTRIBUTING.md file in the repository root. The project is especially looking for contributions in: **stack adapters** (adding governance checks for additional languages), **integrations** (CI platforms beyond GitHub Actions, editor plugins), **orchestration patterns** (new multi-agent patterns in `src/kernel/orchestration/`), **brownfield discovery** (analysis phases for new frameworks), and **documentation** (guides, use cases, translations). Pull requests and issues are welcome.

---

> **Still have questions?** Open an issue at [github.com/tjsasakifln/devflow/issues](https://github.com/tjsasakifln/devflow/issues)
