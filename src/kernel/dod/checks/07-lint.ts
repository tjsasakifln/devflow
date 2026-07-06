/** DoD Check 07: Lint passa. */
import type { DoDCheckDecl } from "../types.js";

export const check07Lint: DoDCheckDecl = {
  id: "07",
  name: "Lint passa",
  category: "deterministic",
  requiredInModes: ["strict", "release"],
  inputs: ["src/**/*.ts"],
  outputs: [],
  timeoutMs: 30_000,
  blockingDefault: true,
  remediationTemplate:
    "Execute 'npx eslint src/' e corrija todos os warnings e erros.",
  evidenceSchema: "eslint output",

  async run(ctx) {
    const { runProcess } = await import("../../../adapters/process/safe-runner.js");
    const result = await runProcess({
      command: "npx",
      args: ["eslint", "src/", "--max-warnings=0"],
      cwd: ctx.rootPath,
      timeout: this.timeoutMs,
    });
    return {
      checkId: "07", name: this.name, category: "deterministic",
      passed: result.exitCode === 0,
      detail: result.exitCode === 0 ? "Lint passou" : "Erros de lint encontrados",
      blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
    };
  },
};
