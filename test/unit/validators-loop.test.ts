import { describe, it, expect, vi } from "vitest";
import {
  validateLoopSpec,
  scanActionsForLoops,
  validateLoopsInFeature,
  integrateIntoPipelineCheck,
  formatLoopRefusal,
  logLoopIteration,
  type LoopSpec,
} from "../../src/kernel/validators/loop.js";

describe("validateLoopSpec", () => {
  const validSpec: LoopSpec = {
    goal: "Implement feature X",
    input: "spec.md",
    output: "src/X.ts",
    action: "T001 — Implement X",
    stopCondition: "3 tests passing",
    maxIterations: 5,
    externalCheck: "npm test",
    evidenceLog: "log.jsonl",
    humanDecision: false,
  };

  it("returns valid for a complete spec", () => {
    const result = validateLoopSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("rejects empty goal", () => {
    const result = validateLoopSpec({ ...validSpec, goal: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Loop must have an explicit goal.");
  });

  it("rejects whitespace-only goal", () => {
    const result = validateLoopSpec({ ...validSpec, goal: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Loop must have an explicit goal.");
  });

  it("rejects empty action", () => {
    const result = validateLoopSpec({ ...validSpec, action: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Loop must have a named action.");
  });

  it("rejects empty stopCondition", () => {
    const result = validateLoopSpec({ ...validSpec, stopCondition: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Loop must have an explicit stop condition.");
  });

  it("rejects missing maxIterations (0)", () => {
    const result = validateLoopSpec({ ...validSpec, maxIterations: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Loop must specify maxIterations (>= 1).");
  });

  it("rejects negative maxIterations", () => {
    const result = validateLoopSpec({ ...validSpec, maxIterations: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Loop must specify maxIterations (>= 1).");
  });

  it("adds warning for high maxIterations (>10)", () => {
    const result = validateLoopSpec({ ...validSpec, maxIterations: 15 });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("maxIterations=15 is high");
  });

  it("rejects empty externalCheck", () => {
    const result = validateLoopSpec({ ...validSpec, externalCheck: "" });
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.includes("externalCheck"));
    expect(err).toBeTruthy();
  });

  it("rejects empty evidenceLog", () => {
    const result = validateLoopSpec({ ...validSpec, evidenceLog: "" });
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.includes("evidenceLog"));
    expect(err).toBeTruthy();
  });

  it("detects vague goal with 'melhorar o código' pattern", () => {
    const result = validateLoopSpec({
      ...validSpec,
      goal: "melhorar o código do modulo X",
      externalCheck: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("vague goal"))).toBe(true);
  });

  it("detects 'melhorar código' without external check", () => {
    const result = validateLoopSpec({
      ...validSpec,
      goal: "melhorar código",
      externalCheck: "",
    });
    expect(result.valid).toBe(false);
  });

  it("allows vague goal if external check is present", () => {
    const result = validateLoopSpec({
      ...validSpec,
      goal: "melhorar o código do modulo",
    });
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors simultaneously", () => {
    const result = validateLoopSpec({
      ...validSpec,
      goal: "",
      action: "",
      stopCondition: "",
      maxIterations: 0,
      externalCheck: "",
      evidenceLog: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe("scanActionsForLoops", () => {
  it("returns empty array for markdown without loop blocks", () => {
    const result = scanActionsForLoops("# No loops here");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty string", () => {
    const result = scanActionsForLoops("");
    expect(result).toHaveLength(0);
  });

  it("parses a single yaml loop block", () => {
    const md = `
\`\`\`yaml
loop:
  goal: Implement X
  input: spec.md
  output: src/X.ts
  action: T001
  stopCondition: tests pass
  maxIterations: 5
  externalCheck: npm test
  evidenceLog: loop.jsonl
  humanDecision: false
\`\`\`
`;
    const loops = scanActionsForLoops(md);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.goal).toBe("Implement X");
    expect(loops[0]!.action).toBe("T001");
    expect(loops[0]!.maxIterations).toBe(5);
    expect(loops[0]!.humanDecision).toBe(false);
  });

  it("parses 'yml' alias in code fence", () => {
    const md = `
\`\`\`yml
loop:
  goal: Analyze
  action: A001
  stopCondition: done
  maxIterations: 3
  externalCheck: check.sh
  evidenceLog: log.jsonl
  humanDecision: true
\`\`\`
`;
    const loops = scanActionsForLoops(md);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.humanDecision).toBe(true);
  });

  it("parses multiple loop blocks", () => {
    const md = `
\`\`\`yaml
loop:
  goal: First
  action: T001
  stopCondition: ok
  maxIterations: 3
  externalCheck: test
  evidenceLog: log.jsonl
  humanDecision: false
\`\`\`

Some text

\`\`\`yaml
loop:
  goal: Second
  action: T002
  stopCondition: done
  maxIterations: 5
  externalCheck: verify
  evidenceLog: log2.jsonl
  humanDecision: true
\`\`\`
`;
    const loops = scanActionsForLoops(md);
    expect(loops).toHaveLength(2);
    expect(loops[0]!.goal).toBe("First");
    expect(loops[1]!.goal).toBe("Second");
  });

  it("handles missing optional fields gracefully", () => {
    const md = `
\`\`\`yaml
loop:
  goal: Minimal
  action: T001
  stopCondition: done
  maxIterations: 3
  externalCheck: test
  evidenceLog: log.jsonl
  humanDecision: false
\`\`\`
`;
    const loops = scanActionsForLoops(md);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.input).toBe("");
    expect(loops[0]!.output).toBe("");
  });

  it("ignores non-loop yaml blocks", () => {
    const md = `
\`\`\`yaml
action:
  name: Some action
  target: src/x.ts
\`\`\`
`;
    const loops = scanActionsForLoops(md);
    expect(loops).toHaveLength(0);
  });
});

describe("validateLoopsInFeature", () => {
  it("returns valid when no loops present", () => {
    const result = validateLoopsInFeature("# No loops");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid when all loops are valid", () => {
    const md = `
\`\`\`yaml
loop:
  goal: Implement
  action: T001
  stopCondition: tests pass
  maxIterations: 5
  externalCheck: npm test
  evidenceLog: log.jsonl
  humanDecision: false
\`\`\`
`;
    const result = validateLoopsInFeature(md);
    expect(result.valid).toBe(true);
  });

  it("collects errors from invalid loops", () => {
    const md = `
\`\`\`yaml
loop:
  goal:
  action: T001
  stopCondition:
  maxIterations: 0
  externalCheck:
  evidenceLog:
  humanDecision: false
\`\`\`
`;
    const result = validateLoopsInFeature(md);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("Loop #1"))).toBe(true);
  });

  it("includes warnings from loops", () => {
    const md = `
\`\`\`yaml
loop:
  goal: Implement
  action: T001
  stopCondition: done
  maxIterations: 15
  externalCheck: npm test
  evidenceLog: log.jsonl
  humanDecision: false
\`\`\`
`;
    const result = validateLoopsInFeature(md);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("Loop #1"))).toBe(true);
  });
});

describe("integrateIntoPipelineCheck", () => {
  it("returns null when no loops found", () => {
    const result = integrateIntoPipelineCheck("# No loops");
    expect(result).toBeNull();
  });

  it("creates GuardCheck for valid loops", () => {
    const md = `
\`\`\`yaml
loop:
  goal: X
  action: T001
  stopCondition: done
  maxIterations: 3
  externalCheck: test
  evidenceLog: log.jsonl
  humanDecision: false
\`\`\`
`;
    const result = integrateIntoPipelineCheck(md);
    expect(result).not.toBeNull();
    expect(result!.checkId).toBe("loop-validation");
    expect(result!.passed).toBe(true);
    expect(result!.blocking).toBe(true);
    expect(result!.gateNumber).toBe(14);
    expect(result!.remediation).toBeTruthy();
  });

  it("creates GuardCheck for invalid loops", () => {
    const md = `
\`\`\`yaml
loop:
  goal:
  action: T001
  stopCondition:
  maxIterations: 0
  externalCheck:
  evidenceLog:
  humanDecision: false
\`\`\`
`;
    const result = integrateIntoPipelineCheck(md);
    expect(result).not.toBeNull();
    expect(result!.checkId).toBe("loop-validation");
    expect(result!.passed).toBe(false);
  });
});

describe("formatLoopRefusal", () => {
  it("formats a refusal message with errors", () => {
    const validation = {
      valid: false,
      errors: ["Missing goal", "Missing stopCondition"],
      warnings: [],
    };
    const msg = formatLoopRefusal(validation);
    expect(msg).toContain("Loop Recusado");
    expect(msg).toContain("Missing goal");
    expect(msg).toContain("Missing stopCondition");
    expect(msg).toContain("Estrutura Obrigatória");
  });

  it("includes warnings section when warnings present", () => {
    const validation = {
      valid: true,
      errors: [],
      warnings: ["High maxIterations"],
    };
    const msg = formatLoopRefusal(validation);
    expect(msg).toContain("Avisos");
    expect(msg).toContain("High maxIterations");
  });

  it("omits warnings section when no warnings", () => {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };
    const msg = formatLoopRefusal(validation);
    expect(msg).not.toContain("Avisos");
  });
});

describe("logLoopIteration", () => {
  it("returns a JSON entry string", () => {
    const entry = logLoopIteration(
      "/tmp/log.jsonl",
      1,
      "T001",
      "pass",
      "All tests passed",
    );
    const parsed = JSON.parse(entry);
    expect(parsed.iteration).toBe(1);
    expect(parsed.action).toBe("T001");
    expect(parsed.checkResult).toBe("pass");
  });

  it("truncates evidence to 1000 chars", () => {
    const longEvidence = "x".repeat(2000);
    const entry = logLoopIteration(
      "/tmp/log.jsonl",
      1,
      "T001",
      "pass",
      longEvidence,
    );
    const parsed = JSON.parse(entry);
    expect(parsed.evidence.length).toBe(1000);
  });

  it("includes ISO timestamp", () => {
    const entry = logLoopIteration("/tmp/log.jsonl", 1, "T001", "pass", "ok");
    const parsed = JSON.parse(entry);
    expect(parsed.ts).toBeDefined();
    expect(() => new Date(parsed.ts)).not.toThrow();
  });
});
