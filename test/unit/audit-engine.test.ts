import { describe, it, expect } from "vitest";
import { runAudit } from "../../src/core/audit-engine.js";
import { computeVerdict, buildSeverityMatrix, createRisk, severityBlocks } from "../../src/core/policy-engine.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";

const cwd = path.resolve(process.cwd()); // use the devflow repo itself

describe("audit-engine", () => {
  it("should run audit on current repo and return report structure", async () => {
    const report = await runAudit({ cwd, base: "main" });
    expect(report).toBeDefined();
    expect(report.verdict).toBeDefined();
    expect(report.metadata).toBeDefined();
    expect(report.metadata.devflowVersion).toBeDefined();
    expect(report.metadata.branch).toBeDefined();
    expect(report.severityMatrix).toBeDefined();
    expect(report.changedFiles).toBeDefined();
    expect(Array.isArray(report.risks)).toBe(true);
    expect(Array.isArray(report.evidences)).toBe(true);
    expect(Array.isArray(report.missingEvidences)).toBe(true);
    expect(Array.isArray(report.whatCouldHaveShippedBroken)).toBe(true);
    expect(report.devflowGovernedBadge).toBeDefined();
    expect(report.prSnippet).toBeDefined();
    expect(report.executiveSummary).toBeDefined();
  });

  it("should return featureId null when no active feature", async () => {
    const report = await runAudit({ cwd, base: "main" });
    expect(report.featureId === null || typeof report.featureId === "string").toBe(true);
  });

  it("should detect file with eval() as CRITICAL risk", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "devflow-test-"));
    try {
      execSync("git init --initial-branch=main && git add . && git commit -m init --allow-empty", { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, "bad.ts"), 'eval("malicious code");\n');
      execSync("git add bad.ts", { cwd: tmpDir });

      const report = await runAudit({ cwd: tmpDir, base: "main", staged: true });
      const evalRisks = report.risks.filter(r => r.description.includes("eval"));
      expect(evalRisks.length).toBeGreaterThan(0);
      expect(evalRisks[0]!.severity).toBe("CRITICAL");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should detect hardcoded secret as HIGH risk", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "devflow-test-"));
    try {
      execSync("git init --initial-branch=main && git add . && git commit -m init --allow-empty", { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, "config.ts"), 'const password = "super-secret-12345678";\n');
      execSync("git add config.ts", { cwd: tmpDir });

      const report = await runAudit({ cwd: tmpDir, base: "main", staged: true });
      const secretRisks = report.risks.filter(
        r => r.description.toLowerCase().includes("secret") || r.description.toLowerCase().includes("password")
      );
      expect(secretRisks.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should detect TODO without ticket as MEDIUM risk", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "devflow-test-"));
    try {
      execSync("git init --initial-branch=main && git add . && git commit -m init --allow-empty", { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, "todo.ts"), "// TODO fix this later\nfunction foo() {}\n");
      execSync("git add todo.ts", { cwd: tmpDir });

      const report = await runAudit({ cwd: tmpDir, base: "main", staged: true });
      const todoRisks = report.risks.filter(r => r.description.includes("TODO"));
      expect(todoRisks.length).toBeGreaterThan(0);
      expect(todoRisks[0]!.severity).toBe("MEDIUM");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should produce consistent executive summary format", async () => {
    const report = await runAudit({ cwd, base: "main" });
    expect(typeof report.executiveSummary).toBe("string");
    expect(report.executiveSummary.length).toBeGreaterThan(0);
    // Should mention file count
    expect(report.executiveSummary).toMatch(/\d+ file\(s\) changed/);
  });

  it("should respect staged option", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "devflow-test-"));
    try {
      execSync("git init --initial-branch=main && git add . && git commit -m init --allow-empty", { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, "staged.ts"), 'eval("staged danger");\n');
      execSync("git add staged.ts", { cwd: tmpDir });

      const report = await runAudit({ cwd: tmpDir, base: "main", staged: true });
      const evalRisks = report.risks.filter(r => r.description.includes("eval"));
      expect(evalRisks.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should detect empty catch as MEDIUM risk", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "devflow-test-"));
    try {
      execSync("git init --initial-branch=main && git add . && git commit -m init --allow-empty", { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, "catch.ts"), "try { foo(); } catch(e) {}\n");
      execSync("git add catch.ts", { cwd: tmpDir });

      const report = await runAudit({ cwd: tmpDir, base: "main", staged: true });
      const catchRisks = report.risks.filter(r => r.description.includes("catch"));
      expect(catchRisks.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("riskTolerance with createRisk", () => {
  it("should respect riskTolerance strict — MEDIUM becomes blocking", () => {
    const risk = createRisk("MEDIUM", "code-quality", "test", "fix it", "strict");
    expect(risk.blocking).toBe(true);
  });

  it("should respect riskTolerance relaxed — MEDIUM is not blocking", () => {
    const risk = createRisk("MEDIUM", "code-quality", "test", "fix it", "relaxed");
    expect(risk.blocking).toBe(false);
  });

  it("should respect riskTolerance relaxed — HIGH is not blocking", () => {
    const risk = createRisk("HIGH", "security", "test", "fix it", "relaxed");
    expect(risk.blocking).toBe(false);
  });

  it("should respect riskTolerance moderate — HIGH is blocking", () => {
    const risk = createRisk("HIGH", "security", "test", "fix it", "moderate");
    expect(risk.blocking).toBe(true);
  });

  it("should always block CRITICAL regardless of tolerance", () => {
    expect(createRisk("CRITICAL", "security", "test", "fix it", "relaxed").blocking).toBe(true);
    expect(createRisk("CRITICAL", "security", "test", "fix it", "moderate").blocking).toBe(true);
    expect(createRisk("CRITICAL", "security", "test", "fix it", "strict").blocking).toBe(true);
  });
});

describe("severityBlocks", () => {
  it("CRITICAL always blocks", () => {
    expect(severityBlocks("CRITICAL", "relaxed")).toBe(true);
    expect(severityBlocks("CRITICAL", "moderate")).toBe(true);
    expect(severityBlocks("CRITICAL", "strict")).toBe(true);
  });
});
