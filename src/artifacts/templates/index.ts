import type { TemplateId, TemplatePayload } from "../../types/artifacts.js";
import { requirementsTemplate } from "./requirements.js";
import { clarificationTemplate } from "./clarification.js";
import { qualityAuditTemplate } from "./quality-audit.js";
import { roadmapTemplate } from "./roadmap.js";
import { actionsTemplate } from "./actions.js";
import { qaReportTemplate } from "./qa-report.js";
import { legacyImpactTemplate } from "./legacy-impact.js";
import { regressionWatchTemplate } from "./regression-watch.js";
import { investigationTemplate } from "./investigation.js";
import { dataDeltaTemplate } from "./data-delta.js";
import { constitutionTemplate } from "./constitution.js";
import { testPlanTemplate } from "./test-plan.js";

type TemplateFn = (payload: TemplatePayload) => string;

const templateRegistry: Record<TemplateId, TemplateFn> = {
  requirements: requirementsTemplate,
  clarification: clarificationTemplate,
  "quality-audit": qualityAuditTemplate,
  roadmap: roadmapTemplate,
  actions: actionsTemplate,
  "qa-report": qaReportTemplate,
  "legacy-impact": legacyImpactTemplate,
  "regression-watch": regressionWatchTemplate,
  investigation: investigationTemplate,
  "data-delta": dataDeltaTemplate,
  constitution: constitutionTemplate,
  "test-plan": testPlanTemplate,
};

export function renderTemplate(id: TemplateId, payload: TemplatePayload): string {
  const renderer = templateRegistry[id];
  if (!renderer) {
    throw new Error(`Unknown template: ${id}`);
  }
  return renderer(payload);
}

export function getTemplateIds(): TemplateId[] {
  return Object.keys(templateRegistry) as TemplateId[];
}
