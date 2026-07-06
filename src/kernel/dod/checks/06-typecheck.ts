/** DoD Check 06: Typecheck passa. */
import type { DoDCheckDecl } from "../types.js";

export const check06Typecheck: DoDCheckDecl = {
  id: "06",
  name: "Typecheck passa",
  category: "deterministic",
  requiredInModes: ["local", "experimental", "strict", "release"],
  inputs: ["src/**/*.ts"],
  outputs: [],
  timeoutMs: 30_000,
  blockingDefault: true,
  remediationTemplate:
    "Execute 'npx tsc --noEmit' e corrija todos os erros de tipo.",
  evidenceSchema: "tsc --noEmit output",

  async run(ctx) {
    const { runProcess } = await import("../../../adapters/process/safe-runner.js");
    const result = await runProcess({
      command: "npx",
      args: ["tsc", "--noEmit"],
      cwd: ctx.rootPath,
      timeout: this.timeoutMs,
    });
    return {
      checkId: "06", name: this.name, category: "deterministic",
      passed: result.exitCode === 0,
      detail: result.exitCode === 0 ? "Typecheck passou" : "Erros de tipo encontrados",
      blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
    };
  },
};
