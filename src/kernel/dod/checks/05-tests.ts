/** DoD Check 05: Testes passam. */
import type { DoDCheckDecl } from "../types.js";

export const check05Tests: DoDCheckDecl = {
  id: "05",
  name: "Testes passam",
  category: "deterministic",
  requiredInModes: ["local", "experimental", "strict", "release"],
  inputs: ["test/**/*.test.ts"],
  outputs: [],
  timeoutMs: 60_000,
  blockingDefault: true,
  remediationTemplate:
    "Execute 'npm test' e corrija todos os testes falhos. Coverage mínimo: 80%.",
  evidenceSchema: "test runner output",

  async run(ctx) {
    const { runProcess } = await import("../../../adapters/process/safe-runner.js");
    const result = await runProcess({
      command: "npx",
      args: ["vitest", "run"],
      cwd: ctx.rootPath,
      timeout: this.timeoutMs,
    });
    return {
      checkId: "05", name: this.name, category: "deterministic",
      passed: result.exitCode === 0,
      detail: result.exitCode === 0 ? "Todos os testes passaram" : `Testes falharam: ${result.stderr.slice(0, 200)}`,
      blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
    };
  },
};
