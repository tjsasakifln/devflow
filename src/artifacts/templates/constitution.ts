import type { TemplatePayload } from "../../types/artifacts.js";
import { CONSTITUTION_MARKDOWN_TEMPLATE } from "../../constitution/defaults.js";

export function constitutionTemplate(payload: TemplatePayload): string {
  const projectName = (payload.featureName ||
    payload.projectName ||
    "project") as string;
  const timestamp = payload.timestamp || new Date().toISOString();
  return CONSTITUTION_MARKDOWN_TEMPLATE.replace(
    /\{\{PROJECT_NAME\}\}/g,
    projectName
  ).replace(/\{\{TIMESTAMP\}\}/g, timestamp);
}
