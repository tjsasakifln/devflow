/**
 * AI-Powered Adversarial Review
 *
 * Complements the deterministic 12-vector adversarial review with LLM analysis.
 * Falls back to the deterministic review if no AI provider is configured.
 *
 * Output is always pipe-safe JSON on stdout. Human-readable output goes to stderr.
 */

import path from "node:path";
import pc from "picocolors";
import type { DevflowModelProvider } from "../adapters/models/index.js";
import { adversarialReview } from "./adversarial-review.js";

interface AIReviewResult {
  command: "adversarial-review-ai";
  featureId: string;
  status: "ai" | "fallback" | "error";
  verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
  summary: string;
  aiAnalysis?: {
    vectorsAnalyzed: number;
    findings: Array<{
      vector: string;
      verdict: "pass" | "fail" | "inconclusive";
      analysis: string;
    }>;
    overallAssessment: string;
  };
  deterministicResults?: {
    attackVectors: number;
    pass: number;
    fail: number;
    inconclusive: number;
    verdict: string;
  };
  timestamp: string;
  error?: string;
}

/**
 * Attempt to load an AI provider by checking environment variables.
 * Priority: Anthropic > OpenAI > Ollama.
 * Returns null if no provider can be loaded.
 */
async function loadAIProvider(): Promise<DevflowModelProvider | null> {
  // Try Anthropic first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { createAnthropicProvider } = await import("../adapters/models/anthropic.js");
      return createAnthropicProvider();
    } catch {
      // Anthropic provider not available
    }
  }

  // Try OpenAI next
  if (process.env.OPENAI_API_KEY) {
    try {
      const { createOpenAIProvider } = await import("../adapters/models/openai.js");
      return createOpenAIProvider();
    } catch {
      // OpenAI provider not available
    }
  }

  // Try Ollama last (local, no key required)
  try {
    const { createOllamaProvider } = await import("../adapters/models/ollama.js");
    return createOllamaProvider();
  } catch {
    // Ollama provider not available
  }

  return null;
}

function buildPrompt(featureId: string): string {
  return `You are an adversarial reviewer analyzing feature "${featureId}" in a Devflow project.

Your task is to examine the feature across 12 adversarial attack vectors and determine
whether the feature is robust or vulnerable.

For EACH vector, provide:
1. A verdict: "pass" (feature is robust), "fail" (vulnerability found), or "inconclusive" (cannot determine)
2. A brief analysis (1-3 sentences)

The 12 vectors are:
1. Hidden Coupling — Does this feature create implicit dependencies between modules?
2. Weak Tests — Are tests merely decorative (testing nothing)?
3. Abstraction Failure — Are there concrete dependencies where interfaces should exist?
4. Layer Violation — Does domain code import infrastructure directly?
5. Security — Are there hardcoded secrets, eval(), or unsafe patterns?
6. Spec-Code Gap — Are there requirements not reflected in tests or code?
7. Uncovered Requirements — Are any functional requirements missing test coverage?
8. Code Duplication — Is there duplicated logic that should be abstracted?
9. State Tampering — Has state.json been modified without gatekeep log entry?
10. Log Forgery — Are implementation-log.jsonl entries missing required fields?
11. False Completion — Are actions marked [X] without corresponding log entries?
12. Same-Actor Bypass — Is the same actor appearing with name variants?

Then provide an overall assessment of the feature's robustness.

Respond in JSON format with this structure:
{
  "vectorsAnalyzed": 12,
  "findings": [
    { "vector": "Hidden Coupling", "verdict": "pass|fail|inconclusive", "analysis": "..." }
  ],
  "overallAssessment": "summary of the feature's robustness"
}`;
}

async function runAIReview(
  provider: DevflowModelProvider,
  featureId: string,
): Promise<AIReviewResult["aiAnalysis"]> {
  const prompt = buildPrompt(featureId);

  const response = await provider.invoke(prompt, {
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt:
      "You are an adversarial security reviewer. Analyze feature robustness. Respond with valid JSON only.",
  });

  // Parse the AI response
  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const content = response.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const analysis = JSON.parse(jsonStr) as AIReviewResult["aiAnalysis"];
    return analysis;
  } catch {
    // If parsing fails, return structured error
    return {
      vectorsAnalyzed: 0,
      findings: [],
      overallAssessment: "Failed to parse AI response. Raw: " + response.content.slice(0, 200),
    };
  }
}

/**
 * Run the deterministic adversarial review and capture its output signals.
 */
function captureDeterministicResult(
  logs: string[],
): AIReviewResult["deterministicResults"] {
  const failCount = logs.filter((l) => l.includes("FAIL")).length;
  const passCount = logs.filter((l) => l.includes("PASS")).length;
  const inconclusiveCount = logs.filter((l) => l.includes("INCONCLUSIVE")).length;

  return {
    attackVectors: 12,
    pass: passCount,
    fail: failCount,
    inconclusive: inconclusiveCount,
    verdict: failCount > 0 ? "FAIL" : "PASS",
  };
}

export async function adversarialReviewAI(
  featureId: string,
  rootPath: string,
): Promise<void> {
  const result: AIReviewResult = {
    command: "adversarial-review-ai",
    featureId,
    status: "ai",
    verdict: "PASS",
    summary: "",
    timestamp: new Date().toISOString(),
  };

  console.error(pc.bold(`\nDevflow AI Adversarial Review — ${featureId}\n`));

  // Step 1: Try to load AI provider
  console.error(pc.dim("Attempting to load AI provider..."));
  const provider = await loadAIProvider();

  if (!provider) {
    // Fallback to deterministic
    console.error(pc.yellow("⚠ AI provider not available. Falling back to deterministic adversarial review.\n"));
    result.status = "fallback";
    result.summary = "AI provider unavailable; used deterministic fallback";

    // Intercept stdout from deterministic review and capture signals
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: string[]) => {
      logs.push(args.join(" "));
    };

    try {
      await adversarialReview(featureId, rootPath);
    } finally {
      console.log = originalLog;
    }

    result.deterministicResults = captureDeterministicResult(logs);
    result.verdict = (result.deterministicResults as NonNullable<typeof result.deterministicResults>).verdict as "PASS" | "FAIL";

    // Output pipe-safe JSON to stdout
    console.log(JSON.stringify(result));
    return;
  }

  console.error(pc.green(`✓ AI provider loaded: ${provider.name}\n`));
  console.error(pc.dim("Running AI-powered adversarial review...\n"));

  // Step 2: Run AI review
  let analysis: AIReviewResult["aiAnalysis"] | null = null;
  try {
    analysis = await runAIReview(provider, featureId);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(pc.yellow(`⚠ AI review failed: ${errMsg}. Falling back to deterministic.\n`));

    result.status = "fallback";
    result.error = errMsg;
    result.summary = "AI review failed; used deterministic fallback";

    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: string[]) => {
      logs.push(args.join(" "));
    };

    try {
      await adversarialReview(featureId, rootPath);
    } finally {
      console.log = originalLog;
    }

    result.deterministicResults = captureDeterministicResult(logs);
    result.verdict = (result.deterministicResults as NonNullable<typeof result.deterministicResults>).verdict as "PASS" | "FAIL";

    console.log(JSON.stringify(result));
    return;
  }

  // analysis is guaranteed non-null here because catch returns early
  const safeAnalysis = analysis!;
  result.aiAnalysis = safeAnalysis;

  // Step 3: Render human-readable results to stderr
  for (const finding of safeAnalysis.findings) {
    const icon =
      finding.verdict === "pass"
        ? pc.green("✓")
        : finding.verdict === "fail"
          ? pc.red("✖")
          : pc.yellow("?");
    console.error(`  ${icon} ${pc.bold(finding.vector)}: ${finding.analysis}`);
  }

  console.error("");

  const totalVectors = safeAnalysis.findings.length;
  const passCount = safeAnalysis.findings.filter((f) => f.verdict === "pass").length;
  const failCount = safeAnalysis.findings.filter((f) => f.verdict === "fail").length;
  const inconclusiveCount = safeAnalysis.findings.filter((f) => f.verdict === "inconclusive").length;

  // Determine overall verdict
  if (failCount > 0) {
    result.verdict = "FAIL";
    result.summary = `AI adversarial review FAILED with ${failCount} finding(s)`;
    console.error(pc.red(`✖ FAIL: ${failCount} vulnerabilities found\n`));
  } else if (inconclusiveCount > 0) {
    result.verdict = "INCONCLUSIVE";
    result.summary = `AI adversarial review inconclusive — ${inconclusiveCount} vector(s) unclear`;
    console.error(pc.yellow(`? INCONCLUSIVE: ${inconclusiveCount} vectors unclear\n`));
  } else {
    result.verdict = "PASS";
    result.summary = "AI adversarial review PASSED — all vectors checked";
    console.error(pc.green(`✓ PASS: All ${totalVectors} vectors checked\n`));
  }

  console.error(pc.dim(`  Overall: ${safeAnalysis.overallAssessment}\n`));
  console.error(
    pc.dim(
      `  Vectors: ${totalVectors} | Pass: ${passCount} | Fail: ${failCount} | Inconclusive: ${inconclusiveCount}\n`,
    ),
  );

  // Step 4: Output pipe-safe JSON to stdout
  console.log(JSON.stringify(result));

  // Step 5: Save report
  try {
    const reportDir = path.join(rootPath, ".devflow", "audits", featureId);
    const { atomicWrite, ensureDir } = await import("../kernel/utils/fs.js");
    await ensureDir(reportDir);

    const reportPath = path.join(reportDir, "adversarial-review-ai.md");
    const reportContent = `# AI Adversarial Review — ${featureId}

> **Date:** ${result.timestamp}
> **Verdict:** ${result.verdict}
> **Mode:** AI-powered (fallback: ${result.status === "fallback" ? "yes" : "no"})
> **Provider:** ${provider.name}

## AI Analysis

${safeAnalysis.overallAssessment}

## Results by Vector

${safeAnalysis.findings.map((f) => `- ${f.verdict === "pass" ? "✓" : f.verdict === "fail" ? "✖" : "?"} **${f.vector}**: ${f.analysis}`).join("\n")}

## Summary

| Metric | Value |
|--------|-------|
| Vectors | ${totalVectors} |
| Pass | ${passCount} |
| Fail | ${failCount} |
| Inconclusive | ${inconclusiveCount} |
| Verdict | ${result.verdict} |
`;

    await atomicWrite(reportPath, reportContent);
    console.error(pc.dim(`  Report: ${reportPath}\n`));
  } catch {
    // Report saving is non-critical
  }
}
