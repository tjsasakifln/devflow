import path from "node:path";
import { execSync } from "node:child_process";
import { atomicWrite } from "../utils/fs.js";
import pc from "picocolors";
import type { AdversarialVerificationResult } from "../kernel/orchestration/types.js";

type AttackVerdict = "pass" | "fail" | "inconclusive";

interface AttackResult {
  verdict: AttackVerdict;
  finding: string | null;
  reason?: string;
}

interface AttackVector {
  name: string;
  question: string;
  check: () => AttackResult;
}

interface AdversarialReviewOptions {
  /** When "adversarial", adds multi-agent verification layer on top of deterministic vectors. */
  verifyMode?: "deterministic" | "adversarial";
}

function inconclusive(reason: string): AttackResult {
  return { verdict: "inconclusive", finding: null, reason };
}

function pass(): AttackResult {
  return { verdict: "pass", finding: null };
}

function fail(finding: string): AttackResult {
  return { verdict: "fail", finding };
}

export async function adversarialReview(
  featureId: string,
  rootPath: string,
  options?: AdversarialReviewOptions,
): Promise<void> {
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);

  // Load execution mode
  let mode = "local";
  try {
    const { ConfigManager } = await import("../config/index.js");
    const configMgr = new ConfigManager(rootPath);
    const config = await configMgr.load();
    mode = config.executionMode || "local";
  } catch { /* use default */ }

  console.log(pc.bold(`\nDevflow Adversarial Review — ${featureId}`));
  console.log(pc.dim(`Mode: ${mode} | `) + pc.dim("Adversarial review: the reviewer tries to REJECT the feature.\n"));
  console.log(pc.dim("The question is not 'is this good?' but 'why should this be rejected?'\n"));

  const attackVectors: AttackVector[] = [];

  // ── Attack 1: Hidden coupling ──
  attackVectors.push({
    name: "Hidden Coupling",
    question: "Does this feature create implicit dependencies between modules?",
    check: () => {
      try {
        const output = execSync(
          "npx dependency-cruiser --config .devflow/dependency-cruiser.constitution.js src/ --output-type json 2>&1 || true",
          { cwd: rootPath, encoding: "utf-8", timeout: 30000 }
        );
        const result = JSON.parse(output);
        const violations = result.summary?.totalCruised > 0 ? (result.summary?.totalViolations || 0) : 0;
        return violations > 0 ? fail(`Found ${violations} dependency violations`) : pass();
      } catch {
        return inconclusive("dependency-cruiser not available — cannot verify hidden coupling");
      }
    },
  });

  // ── Attack 2: Weak tests ──
  attackVectors.push({
    name: "Weak Tests",
    question: "Are tests merely decorative (testing nothing) or do they verify real behavior?",
    check: () => {
      try {
        const output = execSync(
          "grep -r 'it(' src/ --include='*.test.ts' --include='*.spec.ts' | grep -v 'expect(' | head -20 || true",
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
        );
        if (output.trim()) {
          return fail(`Test cases without assertions found — decorative tests:\n${output.slice(0, 300)}`);
        }
        return pass();
      } catch {
        return inconclusive("grep not available — cannot verify test assertions");
      }
    },
  });

  // ── Attack 3: Abstraction failure ──
  attackVectors.push({
    name: "Abstraction Failure",
    question: "Are there concrete dependencies where interfaces should exist?",
    check: () => {
      try {
        const output = execSync(
          "grep -rn 'new ' src/ --include='*.ts' | grep -v 'new Error' | grep -v 'new Date' | grep -v 'node_modules' | head -10 || true",
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
        );
        if (output.trim()) {
          return fail(`Direct instantiation in potentially wrong layer:\n${output.slice(0, 300)}`);
        }
        return pass();
      } catch {
        return inconclusive("grep not available — cannot verify abstraction failures");
      }
    },
  });

  // ── Attack 4: Layer violation ──
  attackVectors.push({
    name: "Layer Violation",
    question: "Does domain code import infrastructure directly?",
    check: () => {
      try {
        const output = execSync(
          "grep -rn \"from.*infrastructure\" src/domain/ --include='*.ts' 2>/dev/null || true",
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
        );
        if (output.trim()) {
          return fail(`Domain imports infrastructure:\n${output.slice(0, 300)}`);
        }
        return pass();
      } catch {
        return inconclusive("grep not available — cannot verify layer violations");
      }
    },
  });

  // ── Attack 5: Security issues ──
  attackVectors.push({
    name: "Security",
    question: "Are there hardcoded secrets, eval(), or unsafe patterns?",
    check: () => {
      try {
        const output = execSync(
          "grep -rn \"eval(\\|process\\.env\\.\" src/ --include='*.ts' | grep -v 'process\\.env\\.CI' | grep -v 'process\\.env\\.USER' | grep -v 'process\\.env\\.NODE_ENV' | head -10 || true",
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
        );
        if (output.trim()) {
          return fail(`Potential security issue (eval or sensitive env access):\n${output.slice(0, 300)}`);
        }
        return pass();
      } catch {
        return inconclusive("grep not available — cannot verify security patterns");
      }
    },
  });

  // ── Attack 6: Spec-code inconsistency ──
  attackVectors.push({
    name: "Spec-Code Gap",
    question: "Are there requirements not reflected in tests or code?",
    check: () => {
      const reqPath = path.join(featureDir, "requirements.md");
      if (!reqPath) return inconclusive("requirements.md not found — cannot check spec-code gap");
      try {
        const reqContent = execSync(`cat "${reqPath}"`, { encoding: "utf-8", timeout: 5000 });
        const rfMatches = reqContent.match(/RF\d+/g);
        if (!rfMatches || rfMatches.length === 0) {
          return pass(); // No functional requirements defined = nothing to gap-check
        }
        // Check if RF IDs appear in source code or test-plan
        const srcDir = path.join(rootPath, "src");
        let foundCount = 0;
        for (const rf of [...new Set(rfMatches)]) {
          try {
            const grepResult = execSync(
              `grep -rl "${rf}" "${srcDir}/" "${featureDir}/" 2>/dev/null || true`,
              { encoding: "utf-8", timeout: 10000 }
            );
            if (grepResult.trim()) foundCount++;
          } catch { /* skip */ }
        }
        const uniqueRFs = [...new Set(rfMatches)];
        if (foundCount < uniqueRFs.length) {
          return fail(`${uniqueRFs.length - foundCount}/${uniqueRFs.length} functional requirements not referenced in code or test-plan`);
        }
        return pass();
      } catch {
        return inconclusive("Could not verify spec-code gap — file access error");
      }
    },
  });

  // ── Attack 7: Requirements ignored ──
  attackVectors.push({
    name: "Uncovered Requirements",
    question: "Are any functional requirements missing test coverage?",
    check: () => {
      const reqPath = path.join(featureDir, "requirements.md");
      if (!reqPath) return inconclusive("requirements.md not found");
      try {
        const output = execSync(
          `grep -c "RF\\d+" "${reqPath}" 2>/dev/null || echo "0"`,
          { cwd: rootPath, encoding: "utf-8", timeout: 5000 }
        );
        const rfCount = parseInt(output.trim(), 10);
        if (rfCount > 0) {
          const tpPath = path.join(featureDir, "test-plan.md");
          try {
            const testOutput = execSync(
              `grep -c "RF\\d+" "${tpPath}" 2>/dev/null || echo "0"`,
              { cwd: rootPath, encoding: "utf-8", timeout: 5000 }
            );
            const testRfCount = parseInt(testOutput.trim(), 10);
            if (testRfCount < rfCount) {
              return fail(`${rfCount} functional requirements in requirements.md, but only ${testRfCount} referenced in test-plan.md`);
            }
          } catch {
            return inconclusive("test-plan.md not found — cannot verify RF coverage");
          }
        }
        return pass();
      } catch {
        return inconclusive("Could not verify requirement coverage — file access error");
      }
    },
  });

  // ── Attack 8: Duplication ──
  attackVectors.push({
    name: "Code Duplication",
    question: "Is there duplicated logic that should be abstracted?",
    check: () => {
      try {
        const output = execSync(
          "npx jscpd src/ --min-lines 5 --min-tokens 50 --silent --format console 2>&1 || true",
          { cwd: rootPath, encoding: "utf-8", timeout: 30000 }
        );
        if (output.includes("Found") && !output.includes("Found 0")) {
          return fail(`Code duplication detected:\n${output.slice(0, 300)}`);
        }
        return pass();
      } catch {
        return inconclusive("jscpd not available — cannot check code duplication");
      }
    },
  });

  // ── Attack 9: Devflow bypass — State tampering ──
  attackVectors.push({
    name: "State Tampering",
    question: "Has state.json been modified without a corresponding gatekeep log entry?",
    check: () => {
      try {
        const statePath = path.join(rootPath, ".devflow", "state.json");
        const gatekeepLogPath = path.join(rootPath, ".devflow", "audits", "gatekeep-log.jsonl");
        if (!statePath) return inconclusive("state.json not found");
        const stateStat = execSync(`stat -c %Y "${statePath}" 2>/dev/null || echo "0"`, { encoding: "utf-8" }).trim();
        const hasGatekeepLog = execSync(`test -f "${gatekeepLogPath}" && echo "yes" || echo "no"`, { encoding: "utf-8" }).trim();
        if (hasGatekeepLog === "no" && stateStat !== "0") {
          return fail("state.json exists but no gatekeep-log.jsonl found — potential manual state manipulation");
        }
        return pass();
      } catch {
        return inconclusive("Could not verify state tampering — file access error");
      }
    },
  });

  // ── Attack 10: Devflow bypass — Log forgery ──
  attackVectors.push({
    name: "Log Forgery",
    question: "Are implementation-log.jsonl entries missing required fields?",
    check: () => {
      const logPath = path.join(featureDir, "implementation-log.jsonl");
      try {
        if (!logPath) return inconclusive("implementation-log.jsonl not found");
        const raw = execSync(`cat "${logPath}" 2>/dev/null || echo ""`, { encoding: "utf-8" }).trim();
        if (!raw) return fail("implementation-log.jsonl is empty");
        const lines = raw.split("\n").filter(l => l.trim());
        const invalidLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          try {
            const entry = JSON.parse(lines[i]!);
            if (!entry.timestamp || !entry.actionId || !entry.status) {
              invalidLines.push(`Line ${i + 1}: missing required fields (timestamp, actionId, status)`);
            }
          } catch { invalidLines.push(`Line ${i + 1}: invalid JSON`); }
        }
        if (invalidLines.length > 0) {
          return fail(`Log forgery detected:\n${invalidLines.slice(0, 5).join("\n")}`);
        }
        return pass();
      } catch {
        return inconclusive("Could not verify log integrity");
      }
    },
  });

  // ── Attack 11: Devflow bypass — False completion ──
  attackVectors.push({
    name: "False Completion",
    question: "Are actions marked [X] without corresponding implementation-log entries?",
    check: () => {
      try {
        const actionsPath = path.join(featureDir, "actions.md");
        const logPath = path.join(featureDir, "implementation-log.jsonl");
        const actionsContent = execSync(`cat "${actionsPath}" 2>/dev/null || echo ""`, { encoding: "utf-8" }).trim();
        if (!actionsContent) return inconclusive("actions.md not found");
        const completedActions = (actionsContent.match(/\[x\]/gi) || []).length;
        if (completedActions === 0) return pass();
        const logContent = execSync(`cat "${logPath}" 2>/dev/null || echo ""`, { encoding: "utf-8" }).trim();
        const logEntries = logContent.split("\n").filter(l => l.trim()).length;
        if (completedActions > 0 && logEntries === 0) {
          return fail(`${completedActions} actions marked [X] but implementation-log.jsonl is empty — possible false completion`);
        }
        if (completedActions > logEntries * 2) {
          return fail(`${completedActions} actions completed but only ${logEntries} log entries — possible false completion`);
        }
        return pass();
      } catch {
        return inconclusive("Could not verify action completion integrity");
      }
    },
  });

  // ── Attack 12: Devflow bypass — Same-actor variants ──
  attackVectors.push({
    name: "Same-Actor Bypass",
    question: "Is the same actor appearing with name variants to bypass segregation?",
    check: () => {
      try {
        const gatekeepLogPath = path.join(rootPath, ".devflow", "audits", "gatekeep-log.jsonl");
        const gatekeepContent = execSync(`cat "${gatekeepLogPath}" 2>/dev/null || echo ""`, { encoding: "utf-8" }).trim();
        if (!gatekeepContent) return pass(); // No prior gatekeeps
        const actors = new Set<string>();
        for (const line of gatekeepContent.split("\n")) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.gatekeeper) actors.add(entry.gatekeeper.toLowerCase().trim());
            if (entry.implementer) actors.add(entry.implementer.toLowerCase().trim());
          } catch { /* skip */ }
        }
        // Check for extremely similar actor names (Levenshtein-like)
        const actorList = [...actors];
        for (let i = 0; i < actorList.length; i++) {
          for (let j = i + 1; j < actorList.length; j++) {
            const a = actorList[i]!;
            const b = actorList[j]!;
            if (a !== b && (a.includes(b) || b.includes(a) || a.replace(/[^a-z]/g, "") === b.replace(/[^a-z]/g, ""))) {
              return fail(`Suspicious actor name similarity: "${actorList[i]}" and "${actorList[j]}" — possible bypass attempt`);
            }
          }
        }
        return pass();
      } catch {
        return inconclusive("Could not verify actor uniqueness");
      }
    },
  });

  // ── Run all attacks ──
  const results: Array<{ attack: AttackVector; result: AttackResult }> = [];
  let failCount = 0;
  let inconclusiveCount = 0;

  for (const attack of attackVectors) {
    console.log(`  🔍 ${pc.bold(attack.name)}: ${attack.question}`);
    const result = attack.check();
    results.push({ attack, result });

    if (result.verdict === "fail") {
      console.log(`    ${pc.red("✖")} FAIL: ${result.finding?.slice(0, 150)}`);
      failCount++;
    } else if (result.verdict === "inconclusive") {
      console.log(`    ${pc.yellow("?")} INCONCLUSIVE: ${result.reason}`);
      inconclusiveCount++;
    } else {
      console.log(`    ${pc.green("✓")} PASS`);
    }
  }

  // ── Overall verdict ──
  const strictMode = mode === "strict" || mode === "release";
  let overallVerdict: "PASS" | "FAIL" | "INCONCLUSIVE";

  if (failCount > 0) {
    overallVerdict = "FAIL";
  } else if (inconclusiveCount > 0 && strictMode) {
    overallVerdict = "INCONCLUSIVE";
  } else if (inconclusiveCount > 0) {
    overallVerdict = "PASS"; // In local/experimental, inconclusive doesn't block
  } else {
    overallVerdict = "PASS";
  }

  // ── Adversarial verification (if enabled) — may override verdict ──
  let adversarialResult: AdversarialVerificationResult | null = null;

  if (options?.verifyMode === "adversarial") {
    console.log(
      pc.bold("\n── Adversarial Verify (Multi-Agent) ──"),
    );
    console.log(
      pc.dim(
        "Running 3 independent verifiers per finding (correctness, security, repro)...\n",
      ),
    );

    // Collect failed findings as verification input
    const failedFindings = results
      .filter((r) => r.result.verdict === "fail")
      .map((r) => ({
        file: "",
        line: 0,
        severity: "critical" as const,
        message: r.result.finding ?? `[${r.attack.name}] Failed`,
        dimension: r.attack.name,
      }));

    if (failedFindings.length === 0) {
      console.log(
        pc.green("  No failed findings to verify — adversarial step skipped\n"),
      );
    } else {
      try {
        const { AdversarialVerifier } = await import(
          "../kernel/orchestration/adversarial-verify.js"
        );
        const verifier = new AdversarialVerifier(rootPath);
        adversarialResult = await verifier.verify(
          failedFindings,
          undefined,
          featureId,
        );

        // Display adversarial results
        for (const result of adversarialResult.allResults) {
          const outcomeIcon =
            result.outcome === "survived"
              ? pc.green("✓")
              : result.outcome === "refuted"
                ? pc.dim("✖")
                : pc.yellow("?");

          console.log(
            `  ${outcomeIcon} ${pc.bold(result.finding.dimension)}: ${result.summary}`,
          );
        }

        console.log(
          pc.dim(
            `\n  Adversarial summary: ${adversarialResult.summary}`,
          ),
        );

        // Flag disputed findings for human review
        if (adversarialResult.disputed.length > 0) {
          console.log(
            pc.yellow(
              `\n  ${adversarialResult.disputed.length} finding(s) DISPUTED — human review required`,
            ),
          );
          console.log(
            pc.dim(
              `  See .devflow/disputed-findings.json for details`,
            ),
          );

          // Adjust overall verdict: disputed findings in strict mode still block
          if (strictMode) {
            overallVerdict = "FAIL";
            console.log(
              pc.yellow(
                "  Strict mode: disputed findings treated as failures",
              ),
            );
          }
        }

        // If all findings were refuted, downgrade to PASS
        if (
          failCount > 0 &&
          adversarialResult.refuted.length ===
            adversarialResult.totalFindings
        ) {
          overallVerdict = "PASS";
          console.log(
            pc.green(
              "\n  All findings were refuted by adversarial verification — verdict downgraded to PASS",
            ),
          );
        }

        console.log("");
      } catch (err) {
        console.log(
          pc.yellow(
            `  Adversarial verification error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        console.log(
          pc.dim(
            "  Continuing with deterministic result only\n",
          ),
        );
      }
    }
  }

  const verdictColor = overallVerdict === "PASS" ? pc.green : overallVerdict === "FAIL" ? pc.red : pc.yellow;
  console.log(pc.bold(`\nAdversarial Review Verdict: ${verdictColor(overallVerdict)}`));
  console.log(pc.dim(`  Pass: ${attackVectors.length - failCount - inconclusiveCount} | Fail: ${failCount} | Inconclusive: ${inconclusiveCount}`));
  if (strictMode && overallVerdict === "INCONCLUSIVE") {
    console.log(pc.yellow(`  Mode '${mode}' requires all vectors verifiable. Inconclusive results block.\n`));
  }
  console.log();

  // ── Generate report ──
  const reportPath = path.join(rootPath, ".devflow", "audits", featureId, "adversarial-review.md");
  const auditDir = path.dirname(reportPath);

  try {
    execSync(`mkdir -p "${auditDir}"`, { encoding: "utf-8" });
  } catch { /* ok */ }

  const now = new Date().toISOString();
  const findingsList = results
    .filter(r => r.result.verdict === "fail")
    .map(r => `[${r.attack.name}] ${r.result.finding}`);

  const reportContent = `# Adversarial Review — ${featureId}

> **Date:** ${now}
> **Verdict:** ${overallVerdict}
> **Mode:** ${mode}
> **Reviewer:** Adversarial Reviewer Agent
${options?.verifyMode === "adversarial" ? `> **Verify Mode:** Multi-Agent Adversarial (3 lenses per finding)\n` : ""}
## Attack Vectors Checked

${results.map(({ attack, result }) => {
  const icon = result.verdict === "pass" ? "✓" : result.verdict === "fail" ? "✖" : "?";
  const detail = result.verdict === "fail" ? `\n  - Finding: ${result.finding}` : result.verdict === "inconclusive" ? `\n  - Reason: ${result.reason}` : "";
  return `- ${icon} **${attack.name}**: ${attack.question}${detail}`;
}).join("\n")}

${findingsList.length > 0 ? `## Findings\n\n${findingsList.map((f, i) => `${i + 1}. ${f}`).join("\n")}` : ""}

${adversarialResult ? `## Adversarial Verification (Multi-Agent)

**Summary:** ${adversarialResult.summary}
**Duration:** ${adversarialResult.durationMs}ms

| Outcome | Count |
|---------|-------|
| Survived | ${adversarialResult.survived.length} |
| Refuted | ${adversarialResult.refuted.length} |
| Disputed | ${adversarialResult.disputed.length} |

${adversarialResult.disputed.length > 0 ? `> **Note:** ${adversarialResult.disputed.length} finding(s) are DISPUTED — human review required. See \`.devflow/disputed-findings.json\` for details.` : ""}
\n` : ""}

**Overall:** ${overallVerdict}${overallVerdict === "INCONCLUSIVE" ? " — unverifiable vectors found, blocking in strict/release mode" : ""}
`;

  await atomicWrite(reportPath, reportContent);

  if (overallVerdict === "PASS") {
    console.log(pc.green("Adversarial review passed. Feature survived all attack vectors."));
    console.log(pc.dim(`Report: ${reportPath}`));
    console.log(pc.bold("\nNext Step: Run `devflow gatekeep " + featureId + " --approve --actor <reviewer>`"));
  } else if (overallVerdict === "INCONCLUSIVE") {
    console.log(pc.yellow(`Adversarial review inconclusive — ${inconclusiveCount} vector(s) could not be verified.`));
    console.log(pc.dim(`Report: ${reportPath}`));
    console.log(pc.bold("\nNext Step: Install missing tools or switch to --mode local, then re-run."));
  } else {
    console.log(pc.red(`Adversarial review failed — ${failCount} finding(s). Fix before proceeding.`));
    console.log(pc.dim(`Report: ${reportPath}`));
    console.log(pc.bold("\nNext Step: Fix findings above, then re-run `devflow adversarial-review " + featureId + "`"));
  }
  console.log();
}
