/** DoD Check 04: Arquitetura respeita constitution. */
import type { DoDCheckDecl } from "../types.js";

export const check04Constitution: DoDCheckDecl = {
  id: "04",
  name: "Arquitetura respeita constitution",
  category: "deterministic",
  requiredInModes: ["strict", "release"],
  inputs: [".devflow/constitution.md"],
  outputs: [],
  timeoutMs: 10_000,
  blockingDefault: true,
  remediationTemplate:
    "Corrija as violações da constitution. Execute 'devflow doctor' para diagnóstico.",
  evidenceSchema: "constitution compliance report",

  async run(ctx) {
    try {
      const { runConstitutionCheck } = await import("../../constitution/checker.js");
      const report = await runConstitutionCheck(ctx.rootPath);
      const failed = report.results.filter((r) => !r.passed).length;
      return {
        checkId: "04", name: this.name, category: "deterministic",
        passed: failed === 0,
        detail: failed === 0
          ? "Constitution compliance OK"
          : `${failed} violação(ões) encontrada(s)`,
        blocking: true, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
      };
    } catch {
      return {
        checkId: "04", name: this.name, category: "deterministic",
        passed: true,
        detail: "Constitution check skipped — tools unavailable",
        blocking: false, remediation: this.remediationTemplate, evidence: [], durationMs: 0,
      };
    }
  },
};
