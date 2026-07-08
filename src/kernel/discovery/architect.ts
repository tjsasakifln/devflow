/**
 * Discovery Phase 4: Architect
 *
 * Architecture reconstruction — C4 diagrams (Mermaid), ERD generation,
 * integration mapping.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { safeReadFile } from "../utils/fs.js";
import { extractSchema } from "./schema-extractor.js";
import type { StackProfile } from "../detection/stack.js";

export interface ModuleInfo {
  name: string;
  path: string;
  imports: string[];
  exportedItems: string[];
}

export interface Integration {
  name: string;
  evidence: string;
  type: "external-api" | "database" | "internal-module" | "file-system" | "message-queue";
}

export interface ArchitectReport {
  c4ContextDiagram: string;
  c4ContainerDiagram: string;
  integrations: Integration[];
  modules: ModuleInfo[];
  erd: string | null;
  hasSchema: boolean;
  markdown: string;
}

export interface SchemaReport {
  hasSchema: boolean;
  schemaMarkdown: string;
}

/**
 * Run the Architect phase.
 */
export async function runArchitect(rootPath: string, stack: StackProfile): Promise<{ report: ArchitectReport; schemaReport: SchemaReport }> {
  const modules = await extractModuleStructure(rootPath, stack);
  const integrations = await detectIntegrations(rootPath, stack);
  const schema = await extractSchema(rootPath);
  const erd = schema?.mermaidERD ?? null;

  const c4ContextDiagram = buildC4ContextDiagram(modules, integrations);
  const c4ContainerDiagram = buildC4ContainerDiagram(modules, stack);

  const markdown = buildArchitectMarkdown(c4ContextDiagram, c4ContainerDiagram, integrations, modules, erd);

  const schemaMarkdown = schema
    ? buildSchemaMarkdown(schema.tables, schema.relationships)
    : "# SCHEMA.md\n\n_No database schema detected in this project._\n";

  const hasSchema = schema !== null;

  return {
    report: { c4ContextDiagram, c4ContainerDiagram, integrations, modules, erd, hasSchema, markdown },
    schemaReport: { hasSchema, schemaMarkdown },
  };
}

/**
 * Extract module structure — imports/exports per source file.
 */
async function extractModuleStructure(
  rootPath: string,
  stack: StackProfile,
): Promise<ModuleInfo[]> {
  const modules: ModuleInfo[] = [];
  const sourceDir = stack.sourceDir || "src";

  // Focus on TypeScript/JavaScript for import analysis
  if (stack.language !== "typescript" && stack.language !== "javascript") {
    // Generic file listing
    try {
      const ext = stack.language === "python" ? "py" : stack.language === "go" ? "go" : null;
      if (ext) {
        const out = execSync(
          `find ${sourceDir}/ -name "*.${ext}" -type f 2>/dev/null | head -30`,
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
        );
        for (const file of out.trim().split("\n").filter(Boolean)) {
          modules.push({
            name: path.basename(file, `.${ext}`),
            path: file,
            imports: [],
            exportedItems: [],
          });
        }
      }
    } catch { /* ignore */ }
    return modules;
  }

  // TypeScript/JavaScript import analysis
  try {
    const out = execSync(
      `find ${sourceDir}/ -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | head -40`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );

    for (const file of out.trim().split("\n").filter(Boolean)) {
      const content = await safeReadFile(path.join(rootPath, file));
      if (!content) continue;

      // Extract imports
      const imports: string[] = [];
      const importRegex = /(?:import|require)\s*(?:[^"']*?)\s*(?:from\s+)?["']([^"']+)["']/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1]) imports.push(match[1]);
      }

      // Extract exports
      const exportedItems: string[] = [];
      const exportRegex = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|let|var)\s+(\w+)/g;
      let exportMatch;
      while ((exportMatch = exportRegex.exec(content)) !== null) {
        if (exportMatch[1]) exportedItems.push(exportMatch[1]);
      }

      modules.push({
        name: path.basename(file).replace(/\.(ts|tsx|js|jsx)$/, ""),
        path: file,
        imports: imports.slice(0, 15),
        exportedItems: exportedItems.slice(0, 10),
      });
    }
  } catch { /* ignore */ }

  return modules;
}

/**
 * Detect integrations — external APIs, databases, message queues, etc.
 */
async function detectIntegrations(
  rootPath: string,
  stack: StackProfile,
): Promise<Integration[]> {
  const integrations: Integration[] = [];

  // Check package.json for dependencies that indicate integrations
  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        const allDeps: Record<string, string> = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        const depNames = Object.keys(allDeps);

        const integrationPatterns: Array<{ name: string; type: Integration["type"]; patterns: string[] }> = [
          { name: "REST API Client", type: "external-api", patterns: ["axios", "got", "node-fetch", "superagent", "request"] },
          { name: "GraphQL API", type: "external-api", patterns: ["graphql", "apollo-client", "@apollo/client", "urql", "relay"] },
          { name: "Database ORM", type: "database", patterns: ["prisma", "typeorm", "sequelize", "mongoose", "knex", "drizzle-orm"] },
          { name: "Database Driver", type: "database", patterns: ["pg", "mysql2", "sqlite3", "redis", "ioredis", "mongodb"] },
          { name: "Message Queue", type: "message-queue", patterns: ["bull", "bullmq", "amqplib", "kafkajs", "mqtt", "nats"] },
          { name: "File Storage", type: "file-system", patterns: ["multer", "fs-extra", "sharp", "aws-sdk", "@aws-sdk/client-s3"] },
        ];

        for (const ip of integrationPatterns) {
          const matches = depNames.filter((d) => ip.patterns.some((p) => d.toLowerCase().includes(p)));
          if (matches.length > 0) {
            integrations.push({
              name: ip.name,
              evidence: `Dependencies: ${matches.slice(0, 3).join(", ")}`,
              type: ip.type,
            });
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Source-level API URL detection
  const sourceDir = stack.sourceDir || "src";
  try {
    const urlMatches = execSync(
      `grep -rn "https\\?://[a-zA-Z0-9.-]\\+\\.\\w\\+" ${sourceDir}/ 2>/dev/null | grep -v "node_modules" | grep -v "example.com" | grep -v "localhost" | awk -F: '{print $1}' | sort -u | head -10`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    if (urlMatches.trim()) {
      for (const file of urlMatches.trim().split("\n").filter(Boolean)) {
        if (!integrations.some((i) => i.name.includes("External API") && i.evidence.includes(file))) {
          integrations.push({
            name: "External API (URL references)",
            evidence: `Referenced in: ${file}`,
            type: "external-api",
          });
        }
      }
    }
  } catch { /* ignore */ }

  return integrations;
}

/**
 * Build C4 Context diagram (Mermaid).
 */
function buildC4ContextDiagram(_modules: ModuleInfo[], integrations: Integration[]): string {
  const lines: string[] = [];
  lines.push("C4Context");
  lines.push("  title System Context Diagram — Auto-generated by Devflow Discovery");
  lines.push("");

  // System boundary
  lines.push("  System_Boundary(project, \"Project\", \"The analyzed system\") {");
  lines.push("    System(project_core, \"Core Application\", \"Main application logic\")");
  lines.push("  }");
  lines.push("");

  // External integrations
  const extApis = integrations.filter((i) => i.type === "external-api");
  const databases = integrations.filter((i) => i.type === "database");
  const queues = integrations.filter((i) => i.type === "message-queue");

  if (extApis.length > 0) {
    for (const api of extApis) {
      const safeName = api.name.replace(/[^a-zA-Z0-9]/g, "_");
      lines.push(`  System_Ext(${safeName}, "${api.name}", "External System")`);
    }
    lines.push("");
  }

  if (databases.length > 0) {
    for (const db of databases) {
      const safeName = "Database_" + db.name.replace(/[^a-zA-Z0-9]/g, "_");
      lines.push(`  System_Ext(${safeName}, "${db.name}", "Database")`);
    }
    lines.push("");
  }

  if (queues.length > 0) {
    lines.push("  System_Ext(MessageQueue, \"Message Queue\", \"Async messaging\")");
    lines.push("");
  }

  // Relationships
  if (extApis.length > 0) {
    for (const api of extApis) {
      const safeName = api.name.replace(/[^a-zA-Z0-9]/g, "_");
      lines.push(`  Rel(project_core, ${safeName}, "uses", "HTTPS/REST")`);
    }
  }
  if (databases.length > 0) {
    for (const db of databases) {
      const safeName = "Database_" + db.name.replace(/[^a-zA-Z0-9]/g, "_");
      lines.push(`  Rel(project_core, ${safeName}, "reads/writes", "SQL/ORM")`);
    }
  }
  if (queues.length > 0) {
    lines.push('  Rel(project_core, MessageQueue, "publishes/subscribes", "async")');
  }

  lines.push("");

  // Fallback: if no integrations detected, use a simplified view
  if (extApis.length === 0 && databases.length === 0 && queues.length === 0) {
    lines.push("  UpdateLayoutConfig($c4ShapeInRow=\"2\", $c4BoundaryInRow=\"1\")");
  }

  return lines.join("\n");
}

/**
 * Build C4 Container diagram (Mermaid).
 */
function buildC4ContainerDiagram(modules: ModuleInfo[], stack: StackProfile): string {
  const lines: string[] = [];
  lines.push("C4Container");
  lines.push("  title Container Diagram — Module Structure");
  lines.push("");

  // Categorize modules by directory
  const categorized = new Map<string, string[]>();
  for (const mod of modules) {
    const dir = path.dirname(mod.path).split("/")[0] ?? "root";
    if (!categorized.has(dir)) categorized.set(dir, []);
    categorized.get(dir)?.push(mod.name);
  }

  lines.push(`  System_Boundary(app, "Application", "${stack.language}") {`);
  let containerIdx = 1;
  for (const [dir, names] of categorized) {
    const containerId = `container_${containerIdx}`;
    const label = dir || "root";
    const items = names.slice(0, 8).join(", ");
    lines.push(`    Container(${containerId}, "${label}", "Module", "Contains: ${items}")`);
    containerIdx++;
  }
  lines.push("  }");
  lines.push("");

  if (modules.length > 0) {
    lines.push("  UpdateLayoutConfig($c4ShapeInRow=\"3\", $c4BoundaryInRow=\"1\")");
  }

  return lines.join("\n");
}

function buildArchitectMarkdown(
  c4Context: string,
  c4Container: string,
  integrations: Integration[],
  modules: ModuleInfo[],
  erd: string | null,
): string {
  const lines: string[] = [];

  lines.push("# Architecture Report — Reconstruction");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  // C4 Context
  lines.push("## C4 Context Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push(c4Context);
  lines.push("```");
  lines.push("");

  // C4 Container
  lines.push("## C4 Container Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push(c4Container);
  lines.push("```");
  lines.push("");

  // ERD
  if (erd) {
    lines.push("## Entity Relationship Diagram");
    lines.push("");
    lines.push("```mermaid");
    lines.push(erd);
    lines.push("```");
    lines.push("");
  }

  // Integrations
  lines.push("## Integration Map");
  lines.push("");
  if (integrations.length > 0) {
    lines.push("| Integration | Type | Evidence |");
    lines.push("|-------------|------|----------|");
    for (const i of integrations) {
      lines.push(`| ${i.name} | ${i.type} | ${i.evidence} |`);
    }
  } else {
    lines.push("_No external integrations detected._");
  }
  lines.push("");

  // Module dependency map
  lines.push("## Module Dependency Map");
  lines.push("");
  if (modules.length > 0) {
    lines.push("```mermaid");
    lines.push("graph LR");
    for (const mod of modules) {
      const safeName = mod.name.replace(/[^a-zA-Z0-9]/g, "_");
      const internalImports = mod.imports.filter((i) => i.startsWith(".") || i.startsWith("../") || i.startsWith("./"));
      for (const imp of internalImports.slice(0, 5)) {
        const target = path.basename(imp).replace(/\.\w+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
        if (target && target !== safeName) {
          lines.push(`    ${safeName}[${mod.name}]-->${target}[${target}]`);
        }
      }
    }
    lines.push("```");
  } else {
    lines.push("_Module dependency analysis requires TypeScript/JavaScript._");
  }
  lines.push("");

  // Module list
  lines.push("## Module Overview");
  lines.push("");
  if (modules.length > 0) {
    lines.push(`Total modules analyzed: ${modules.length}`);
    lines.push("");
    lines.push("| Module | File | Exports |");
    lines.push("|--------|------|---------|");
    for (const mod of modules.slice(0, 30)) {
      const exportsStr = mod.exportedItems.slice(0, 3).join(", ") || "—";
      lines.push(`| ${mod.name} | \`${mod.path}\` | ${exportsStr}${mod.exportedItems.length > 3 ? ", ..." : ""} |`);
    }
    if (modules.length > 30) {
      lines.push(`| ... | _and ${modules.length - 30} more_ |`);
    }
  } else {
    lines.push("_No modules analyzed._");
  }
  lines.push("");

  return lines.join("\n");
}

function buildSchemaMarkdown(
  tables: Array<{ name: string; columns: Array<{ name: string; type: string; key: string; nullable: boolean }>; source: string }>,
  relationships: Array<{ from: string; to: string; type: string }>,
): string {
  const lines: string[] = [];

  lines.push("# SCHEMA.md — Database Schema");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  if (tables.length > 0) {
    lines.push("## Entity Relationship Diagram");
    lines.push("");
    lines.push("```mermaid");
    lines.push("erDiagram");
    for (const table of tables) {
      lines.push(`    ${table.name} {`);
      for (const col of table.columns) {
        const annotations = [col.key !== "none" ? col.key : "", col.nullable ? "nullable" : ""].filter(Boolean).join(" ");
        lines.push(`        ${col.type} ${col.name} ${annotations}`.trimEnd());
      }
      lines.push("    }");
    }
    for (const rel of relationships) {
      const sym = rel.type === "1:N" ? "||--o{" : "||--||";
      lines.push(`    ${rel.from} ${sym} ${rel.to} : has`);
    }
    lines.push("```");
    lines.push("");

    lines.push("## Tables");
    lines.push("");
    lines.push(`Total: ${tables.length} tables`);
    lines.push("");
    for (const table of tables) {
      lines.push(`### ${table.name}`);
      lines.push("");
      lines.push(`**Source:** \`${table.source}\``);
      lines.push("");
      lines.push("| Column | Type | Key | Nullable |");
      lines.push("|--------|------|-----|----------|");
      for (const col of table.columns) {
        lines.push(`| ${col.name} | ${col.type} | ${col.key} | ${col.nullable ? "YES" : "NO"} |`);
      }
      lines.push("");
    }

    if (relationships.length > 0) {
      lines.push("## Relationships");
      lines.push("");
      lines.push("| From | To | Type |");
      lines.push("|------|----|------|");
      for (const rel of relationships) {
        lines.push(`| ${rel.from} | ${rel.to} | ${rel.type} |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
