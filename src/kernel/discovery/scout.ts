/**
 * Discovery Phase 1: Scout
 *
 * Surface-level scan of project structure, languages, frameworks, entry points.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { safeReadFile, fileExists } from "../utils/fs.js";
import type { StackProfile } from "../detection/stack.js";

export interface ScoutReport {
  directoryTree: string;
  languages: Record<string, number>;
  frameworks: Array<{ name: string; evidence: string; confidence: "high" | "medium" | "low" }>;
  entryPoints: string[];
  conventions: string[];
  markdown: string;
}

export async function runScout(rootPath: string, stack: StackProfile): Promise<ScoutReport> {
  const directoryTree = await getDirectoryTree(rootPath, 4);
  const languages = await detectLanguages(rootPath);
  const frameworks = await detectFrameworks(rootPath, stack);
  const entryPoints = await detectEntryPoints(rootPath);
  const conventions = await detectConventions(rootPath, stack);
  const markdown = await buildScoutReportMarkdown(rootPath, stack, directoryTree, languages, frameworks, entryPoints, conventions);

  return { directoryTree, languages, frameworks, entryPoints, conventions, markdown };
}

async function buildScoutReportMarkdown(
  rootPath: string,
  stack: StackProfile,
  directoryTree: string,
  languages: Record<string, number>,
  frameworks: Array<{ name: string; evidence: string; confidence: string }>,
  entryPoints: string[],
  conventions: string[],
): Promise<string> {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push("# Scout Report — Surface Structure Scan");
  lines.push("");
  lines.push(`> Generated: ${now}`);
  lines.push(`> Language: ${stack.language}`);
  lines.push(`> Package Manager: ${stack.packageManager ?? "none"}`);
  lines.push(`> Source: ${stack.sourceDir}/`);
  lines.push("");

  lines.push("## Stack Overview");
  lines.push("");
  lines.push(`- **Language:** ${stack.language}`);
  lines.push(`- **Package Manager:** ${stack.packageManager ?? "none"}`);
  lines.push(`- **Source Directory:** \`${stack.sourceDir}/\``);
  lines.push(`- **Test Directory:** \`${stack.testDir}/\``);
  if (stack.hasDocker) lines.push("- **Docker:** Dockerfile detected");
  if (stack.hasCI) lines.push(`- **CI:** ${stack.ciProvider ?? "detected"}`);
  if (stack.linter) lines.push(`- **Linter:** ${stack.linter}`);
  if (stack.formatter) lines.push(`- **Formatter:** ${stack.formatter}`);
  lines.push("");

  lines.push("## Directory Structure");
  lines.push("");
  lines.push("```");
  lines.push(directoryTree);
  lines.push("```");
  lines.push("");

  lines.push("## Languages Detected");
  lines.push("");
  if (Object.keys(languages).length > 0) {
    const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]);
    lines.push("| Extension | Files |");
    lines.push("|-----------|-------|");
    for (const [ext, count] of sorted) {
      lines.push(`| .${ext} | ${count} |`);
    }
  } else {
    lines.push("_Could not detect file extensions._");
  }
  lines.push("");

  lines.push("## Frameworks Detected");
  lines.push("");
  if (frameworks.length > 0) {
    for (const fw of frameworks) {
      lines.push(`- **${fw.name}** — ${fw.evidence} (${fw.confidence})`);
    }
  } else {
    lines.push("_No frameworks detected._");
  }
  lines.push("");

  lines.push("## Entry Points");
  lines.push("");
  if (entryPoints.length > 0) {
    for (const ep of entryPoints) {
      lines.push(`- \`${ep}\``);
    }
  } else {
    lines.push("_No clear entry points detected._");
  }
  lines.push("");

  lines.push("## Project Conventions");
  lines.push("");
  if (conventions.length > 0) {
    for (const c of conventions) {
      lines.push(`- ${c}`);
    }
  } else {
    lines.push("_No notable conventions detected._");
  }
  lines.push("");

  // Package scripts
  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
          lines.push("## Scripts (package.json)");
          lines.push("");
          for (const [name, script] of Object.entries(pkg.scripts)) {
            lines.push(`- **\`${name}\`:** \`${script}\``);
          }
          lines.push("");
        }
      } catch { /* ignore */ }
    }
  }

  // Dependencies summary
  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        const depCount = Object.keys(deps).length;
        if (depCount > 0) {
          lines.push("## Dependencies Overview");
          lines.push("");
          lines.push(`- **Total Dependencies:** ${depCount}`);
          lines.push(`- **Runtime:** ${Object.keys(pkg.dependencies ?? {}).length}`);
          lines.push(`- **Dev:** ${Object.keys(pkg.devDependencies ?? {}).length}`);
          lines.push("");

          const critical = ["express", "react", "next", "vue", "angular", "django", "flask", "fastapi", "prisma", "typeorm", "sequelize"];
          lines.push("### Key Dependencies");
          lines.push("");
          for (const [name, version] of Object.entries(deps).slice(0, 20)) {
            const marker = critical.some((c) => name.toLowerCase().includes(c)) ? " (framework)" : "";
            lines.push(`- **${name}:** ${version}${marker}`);
          }
          if (depCount > 20) {
            lines.push(`- _... and ${depCount - 20} more_`);
          }
          lines.push("");
        }
      } catch { /* ignore */ }
    }
  }

  return lines.join("\n");
}

async function detectConventions(rootPath: string, stack: StackProfile): Promise<string[]> {
  const conventions: string[] = [];
  if (stack.language === "typescript") conventions.push("TypeScript with strict mode (tsconfig.json detected)");
  if (stack.formatter) conventions.push(`Code formatting: ${stack.formatter}`);
  if (stack.linter) conventions.push(`Linting: ${stack.linter}`);
  conventions.push(`Source in \`${stack.sourceDir}/\`, tests in \`${stack.testDir}/\``);
  if (stack.hasDocker) conventions.push("Docker containerization");
  if (stack.hasCI) conventions.push("CI/CD pipeline configured");

  // Monorepo check
  const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      if (pkg.workspaces) conventions.push(`Monorepo with workspaces (${Array.isArray(pkg.workspaces) ? pkg.workspaces.length : "?"} packages)`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch { /* ignore */ }
  }

  if (await fileExists(path.join(rootPath, "lerna.json"))) conventions.push("Monorepo (Lerna)");

  return conventions;
}

async function detectLanguages(rootPath: string): Promise<Record<string, number>> {
  const extensions: Record<string, number> = {};
  try {
    const output = execSync(
      `find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -path './_devflow/*' -not -path './.devflow/*' -not -path './.claude/*' -not -path './plan/*' 2>/dev/null | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20`,
      { cwd: rootPath, encoding: "utf-8", timeout: 15000 },
    );
    for (const line of output.trim().split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1]) {
        const count = parseInt(parts[0] ?? "0", 10);
        if (!isNaN(count) && parts[1]) extensions[parts[1]] = count;
      }
    }
  } catch { /* ignore */ }
  return extensions;
}

async function detectFrameworks(
  rootPath: string,
  stack: StackProfile,
): Promise<Array<{ name: string; evidence: string; confidence: "high" | "medium" | "low" }>> {
  const frameworks: Array<{ name: string; evidence: string; confidence: "high" | "medium" | "low" }> = [];

  // Config file patterns (high confidence)
  const configChecks: Array<{ file: string; name: string }> = [
    { file: "next.config.js", name: "Next.js" },
    { file: "next.config.ts", name: "Next.js" },
    { file: "next.config.mjs", name: "Next.js" },
    { file: "nuxt.config.ts", name: "Nuxt.js" },
    { file: "svelte.config.js", name: "Svelte" },
    { file: "astro.config.mjs", name: "Astro" },
    { file: "remix.config.js", name: "Remix" },
    { file: "angular.json", name: "Angular" },
    { file: "nest-cli.json", name: "NestJS" },
    { file: "vite.config.ts", name: "Vite" },
    { file: "vite.config.js", name: "Vite" },
    { file: "vue.config.js", name: "Vue.js" },
    { file: "react-native.config.js", name: "React Native" },
  ];

  for (const ck of configChecks) {
    if (await fileExists(path.join(rootPath, ck.file))) {
      frameworks.push({ name: ck.name, evidence: `Config file: ${ck.file}`, confidence: "high" });
    }
  }

  // Dependency-based detection (medium confidence)
  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        const allDeps: Record<string, string> = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        const depNames = new Set(Object.keys(allDeps).map((d) => d.toLowerCase()));

        const depFrameworkMap: Array<{ dep: string; name: string }> = [
          { dep: "react", name: "React" },
          { dep: "next", name: "Next.js" },
          { dep: "express", name: "Express" },
          { dep: "fastify", name: "Fastify" },
          { dep: "hono", name: "Hono" },
          { dep: "koa", name: "Koa" },
          { dep: "@nestjs/core", name: "NestJS" },
          { dep: "typeorm", name: "TypeORM" },
          { dep: "prisma", name: "Prisma" },
          { dep: "sequelize", name: "Sequelize" },
          { dep: "mongoose", name: "Mongoose" },
          { dep: "vue", name: "Vue.js" },
          { dep: "@angular/core", name: "Angular" },
          { dep: "svelte", name: "Svelte" },
          { dep: "gatsby", name: "Gatsby" },
          { dep: "zustand", name: "Zustand" },
          { dep: "tailwindcss", name: "Tailwind CSS" },
          { dep: "@trpc/client", name: "tRPC" },
        ];

        for (const entry of depFrameworkMap) {
          const alreadyDetected = frameworks.some((f) => f.name === entry.name);
          if (!alreadyDetected && depNames.has(entry.dep)) {
            const version = allDeps[entry.dep] ?? "?";
            frameworks.push({ name: entry.name, evidence: `Dependency: ${entry.dep}@${version}`, confidence: "medium" });
          }
        }
      } catch { /* ignore */ }
    }
  }

  return frameworks;
}

async function detectEntryPoints(rootPath: string): Promise<string[]> {
  const entryPoints: string[] = [];

  const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      if (pkg.main) entryPoints.push(`package.json → main: ${pkg.main}`);
      if (pkg.bin) {
        const bins = typeof pkg.bin === "string" ? { [pkg.name ?? "cli"]: pkg.bin } : pkg.bin;
        for (const [name, bin] of Object.entries(bins)) {
          entryPoints.push(`package.json → bin.${name}: ${bin}`);
        }
      }
    } catch { /* ignore */ }
  }

  const commonEntries = [
    "src/main.ts", "src/main.js", "src/index.ts", "src/index.js",
    "src/cli.ts", "src/cli.js", "src/app.ts", "src/app.js",
    "src/server.ts", "src/server.js",
    "main.py", "app.py", "manage.py", "wsgi.py",
    "main.go", "cmd/main.go",
    "src/main.rs", "src/lib.rs",
    "public/index.php",
  ];

  for (const entry of commonEntries) {
    if (await fileExists(path.join(rootPath, entry))) {
      if (!entryPoints.includes(entry)) entryPoints.push(entry);
    }
  }

  if (await fileExists(path.join(rootPath, "Dockerfile")) && !entryPoints.includes("Dockerfile")) {
    entryPoints.push("Dockerfile");
  }

  return entryPoints;
}

async function getDirectoryTree(rootPath: string, depth: number): Promise<string> {
  try {
    const output = execSync(
      `find . -maxdepth ${depth} -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -path './_devflow/*' -not -path './.devflow/*' -not -path './_reversa*' -not -path './.claude/*' -not -path './plan/*' | sort | head -120`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    return output.trim();
  } catch {
    return "_Could not generate directory tree._";
  }
}
