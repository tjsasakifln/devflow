import path from "node:path";
import { execSync } from "node:child_process";
import { ArtifactManager } from "../kernel/artifacts/manager.js";
import { inspectProject } from "../adapters/project/inspector.js";
import { fileExists, listDir } from "../kernel/utils/fs.js";
import {
  isInteractive,
  requiredTextInput,
  optionalTextInput,
  spinnerWhile,
  confirmOrExit,
} from "../kernel/utils/prompts.js";
import { detectProjectType } from "../kernel/detection/project-type.js";
import type { ProjectType } from "../kernel/detection/project-type.js";
import pc from "picocolors";

export interface FeatureNewOptions {
  actor?: string;
  nonInteractive?: boolean;
  quick?: boolean;
  noWarnings?: boolean;
  template?: ProjectType;
}

export async function featureNewCommand(
  cwd: string,
  featureName: string,
  options?: FeatureNewOptions
): Promise<void> {
  const rootPath = path.resolve(cwd);

  // ── Pre-command warnings (Story 2.4) ──
  const { executePreCommandHooks, renderWarnings, computeHealthSummary, renderHealthSummary } =
    await import("../kernel/hooks/pre-command.js");
  const hooksCtx = {
    commandName: "feature new",
    rootPath,
    noWarnings: options?.noWarnings ?? false,
  };
  const warnings = await executePreCommandHooks(hooksCtx);
  renderWarnings(warnings);

  // Validate name
  const slug = featureName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug || slug.length === 0) {
    console.log(
      pc.red("Error: Feature name must contain at least one alphanumeric character.")
    );
    return;
  }

  // Determine next feature ID
  const manager = new ArtifactManager(rootPath);
  const featureDir = manager.paths.featureDir;
  const existing = await listDir(featureDir);

  let nextNum = 1;
  for (const entry of existing) {
    const match = entry.match(/^(\d{3})-/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num >= nextNum) nextNum = num + 1;
    }
  }

  const featureId = `${String(nextNum).padStart(3, "0")}-${slug}`;

  console.log(pc.bold("\nDevflow — New Feature\n"));

  // Check if feature already exists
  if (await fileExists(path.join(featureDir, featureId))) {
    console.log(
      pc.yellow(`⚠️  Feature '${featureId}' already exists.`)
    );
    return;
  }

  // Determine actor
  const actor = options?.actor || process.env.DEVFLOW_ACTOR || process.env.USER || undefined;

  // ── Template selection (greenfield vs brownfield) ──
  const templateVariant: ProjectType = options?.template || (await detectProjectType(rootPath));
  const templateLabel = templateVariant === "greenfield" ? "Greenfield (novo projeto)" : "Brownfield (código existente)";
  console.log(pc.dim(`  Template: ${templateLabel}\n`));

  // ── Interactive mode ──
  const runInteractive = !options?.nonInteractive && isInteractive();
  let prefill: Record<string, string> | null = null;

  // ── Quick mode ──
  if (options?.quick) {
    console.log(pc.bold("\n⚡ Quick Mode — AI-Generated Artifacts\n"));

    // Check AI provider
    const { isAiProviderConfigured } = await import("../kernel/artifacts/generator.js");
    if (!isAiProviderConfigured()) {
      console.log(
        pc.yellow("  No AI provider configured.\n")
      );
      console.log("  To use --quick mode, you need an AI provider set up.");
      console.log("  Run the following command to configure one:\n");
      console.log(`    ${pc.bold("devflow ai init")}\n`);
      console.log("  This will guide you through setting up Anthropic (Claude),");
      console.log("  OpenAI, or Ollama (local) as your AI provider.\n");
      return;
    }

    // Quick mode will proceed after directory creation
    console.log(pc.dim("  ✓ AI provider detected\n"));
  }

  if (runInteractive) {
    console.log(pc.dim("We will walk through each section of requirements.md."));
    console.log(pc.dim("Press Ctrl+C at any time to cancel.\n"));

    const problem = await requiredTextInput("What problem does this feature solve?");
    const who = await requiredTextInput("Who uses this feature? (role, persona, or user type)");
    const affected = await requiredTextInput(
      "What screens / APIs / files / modules are affected? (comma-separated)"
    );
    const mustNotBreak = await requiredTextInput(
      "What existing behaviors must NOT break? (comma-separated)"
    );
    const doubtsRaw = await optionalTextInput(
      "What doubts or uncertainties still exist? (comma-separated, leave empty if none)"
    );
    const negativeScope = await requiredTextInput(
      "What is explicitly OUT OF SCOPE for this feature? (comma-separated)"
    );

    prefill = { problem, who, affected, mustNotBreak, doubtsRaw, negativeScope };

    const shouldContinue = await confirmOrExit("Generate pre-filled requirements.md with these answers?");
    if (!shouldContinue) {
      console.log(pc.yellow("\nFeature creation cancelled.\n"));
      return;
    }
  }

  // Create feature directory with requirements template
  console.log(pc.blue("→") + ` Creating feature: ${pc.bold(featureId)}`);
  const featurePath = await manager.ensureFeatureDir(featureName, featureId);

  // ── Write pre-filled requirements if interactive ──
  if (prefill) {
    await spinnerWhile("Generating requirements.md", async () => {
      const now = new Date().toISOString();
      const content = generatePrefilledRequirements(featureName, featureId, now, prefill!);
      await manager.safeWrite(
        path.join(featurePath, "requirements.md"),
        content,
        "requirements.md"
      );
    });
  }

  // Update active feature
  const now = new Date().toISOString();
  await manager.writeActiveFeature({
    featureId,
    featureName,
    startedAt: now,
    updatedAt: now,
    implementerActor: actor,
  });

  // Update state
  await manager.writeState({
    currentState: "feature-empty",
    previousState: null,
    confidence: "high",
    lastUpdated: now,
    activeFeatureId: featureId,
    blockers: [],
  });

  // Regenerate cockpit
  const inspection = await inspectProject(rootPath);
  const { detectState } = await import("../kernel/state/detector.js");
  const { computeRecommendation } = await import("../kernel/actions/recommender.js");
  const { generateCockpit } = await import("../kernel/cockpit/generator.js");

  const stateResult = await detectState(inspection);
  const recommendation = computeRecommendation(stateResult, inspection);
  const cockpit = generateCockpit(stateResult, recommendation, inspection);
  await manager.safeWrite(
    path.join(rootPath, "DEVFLOW.md"),
    cockpit,
    "DEVFLOW.md"
  );

  // ── Quick mode: generate artifacts ──
  if (options?.quick) {
    console.log(pc.blue("→") + " Generating all 4 artifacts with AI...\n");

    const { quickGenerateArtifacts } = await import("../kernel/artifacts/generator.js");
    const result = await quickGenerateArtifacts({
      cwd: rootPath,
      featureName,
      featureId,
      featurePath,
      description: featureName, // The feature name IS the description
    });

    if (result.success) {
      const seconds = (result.durationMs / 1000).toFixed(1);
      console.log(pc.green("  ✓ 4 artifacts generated."));
      for (const file of result.generated) {
        console.log(`   ${pc.dim("→")} _devflow/features/${featureId}/${file}`);
      }
      console.log();
      console.log(pc.green(`  ⏱️  ${result.generated.length} artifacts generated in ${seconds}s. Manual fill would take ~35min.`));
      console.log();
      console.log(pc.yellow("  ⚠️  ALL artifacts are AI-generated. Review before coding."));
      console.log();
    } else if (result.message) {
      console.log(pc.red(`  ✖ ${result.message}`));
      console.log();
      return;
    } else {
      console.log(pc.red("  ✖ Some artifacts failed to generate.\n"));
      if (result.generated.length > 0) {
        console.log("  Generated:");
        for (const file of result.generated) {
          console.log(`   ${pc.dim("→")} ${file}`);
        }
      }
      if (result.failed.length > 0) {
        console.log("  Failed:");
        for (const file of result.failed) {
          console.log(`   ${pc.dim("✖")} ${file}`);
        }
      }
      console.log();
    }
  }

  // ── Create Git feature branch ──
  let branchCreated = false;
  try {
    const currentBranch = execSync("git branch --show-current", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();

    if (currentBranch === "main" || currentBranch === "master") {
      execSync(`git checkout -b feature/${featureId}`, {
        cwd: rootPath,
        encoding: "utf-8",
      });
      branchCreated = true;
    } else {
      console.log(
        pc.yellow(`  ⚠  Not on main/master branch. Skipping branch creation.`)
      );
    }
  } catch {
    console.log(
      pc.yellow(`  ⚠  Git branch could not be created (git may not be configured).`)
    );
  }

  console.log(pc.green("\n✅ Feature created successfully!\n"));
  console.log(pc.bold("Feature:     "), featureId);
  console.log(pc.bold("Directory:   "), featurePath);
  if (branchCreated) {
    console.log(pc.bold("Branch:      "), `feature/${featureId}`);
  }
  if (actor) {
    console.log(pc.bold("Actor:       "), actor);
  }
  console.log();
  console.log(pc.bold("Created files:"));
  if (options?.quick) {
    console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/requirements.md ${pc.dim("(AI)")}`);
    console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/roadmap.md ${pc.dim("(AI)")}`);
    console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/actions.md ${pc.dim("(AI)")}`);
    console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/test-plan.md ${pc.dim("(AI)")}`);
  } else {
    console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/requirements.md`);
  }
  console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/interfaces/`);
  console.log();

  if (prefill) {
    console.log(pc.green("Requirements.md pre-filled with your answers."));
    console.log(pc.dim("Review and refine each section before proceeding."));
    const doubts = prefill.doubtsRaw?.trim();
    if (doubts) {
      console.log(
        pc.yellow(`  ⚠  ${doubts.split(",").length} doubt(s) recorded as [DOUBT] markers — must be resolved before feature-design.`)
      );
    }
    console.log();
  }

  console.log(
    "Next: " +
      pc.bold(`devflow next`) +
      " to see recommended actions.\n"
  );

  // ── Mini health summary (Story 2.4) ──
  try {
    const summary = await computeHealthSummary(featurePath);
    renderHealthSummary(summary);
  } catch {
    // Health summary is advisory — skip silently on failure
  }
}

/**
 * Generate a pre-filled requirements.md from interactive answers.
 * Maps each answer to the appropriate template section.
 */
function generatePrefilledRequirements(
  featureName: string,
  featureId: string,
  timestamp: string,
  answers: Record<string, string>,
): string {
  const doubtItems = answers.doubtsRaw
    ? answers.doubtsRaw
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => `- [ ] [DOUBT] ${d}`)
        .join("\n")
    : "";

  const negativeItems = answers.negativeScope
    ? answers.negativeScope
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => `- Esta feature NÃO inclui: ${d}`)
        .join("\n")
    : "- Esta feature NÃO inclui: <!-- descrever -->";

  const affectedItems = answers.affected
    ? answers.affected
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => `- ${d}`)
        .join("\n")
    : "- ";

  const mustNotBreakItems = answers.mustNotBreak
    ? answers.mustNotBreak
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => `- ${d}`)
        .join("\n")
    : "- ";

  return [
    `# Feature: ${featureName} (${featureId})`,
    "",
    "> Spec-Driven Development: entender → especificar → planejar → testar → implementar → verificar.",
    "> ⚠️ Este arquivo foi pré-preenchido por modo interativo. Revise e refine cada seção.",
    "",
    "## Descrição Funcional",
    answers.problem || "<!-- Descreva qual problema de negócio esta feature resolve. -->",
    "",
    "## Comportamento Esperado",
    `**Atores:** ${answers.who || "<!-- quem usa esta feature? -->"}`,
    "",
    `<!-- Descreva: Quando [ator] faz [ação], o sistema [reação]. -->`,
    "",
    "## Invariantes de Domínio",
    "- ",
    "",
    "## Entradas",
    "- ",
    "",
    "## Saídas",
    "- ",
    "",
    "## Regras de Negócio",
    "- R01: ",
    "- R02: ",
    "",
    "## Dados Persistidos",
    "- ",
    "",
    "## Integrações Externas",
    affectedItems,
    "",
    "## Critérios de Aceitação",
    "- [ ] **Cenário 1:** Given <!-- contexto -->, When <!-- ação -->, Then <!-- resultado esperado -->",
    "- [ ] **Cenário 2:** Given <!-- contexto -->, When <!-- ação -->, Then <!-- resultado esperado -->",
    "- [ ] **Cenário 3:** Given <!-- contexto -->, When <!-- ação -->, Then <!-- resultado esperado -->",
    "",
    "## Casos de Erro",
    "- **Erro 1:** <!-- descrição → comportamento esperado -->",
    "- **Erro 2:** <!-- descrição → comportamento esperado -->",
    "",
    "## Casos Extremos",
    "- [ ] <!-- edge case 1 -->",
    "- [ ] <!-- edge case 2 -->",
    "",
    "## Restrições Técnicas",
    "- ",
    "",
    "## Escopo Negativo",
    negativeItems,
    "",
    "## Requisitos Não-Funcionais",
    mustNotBreakItems
      ? `**Comportamentos que NÃO devem quebrar:**\n${mustNotBreakItems}\n`
      : "",
    "- **Performance:** <!-- requisito -->",
    "- **Segurança:** <!-- requisito -->",
    "- **Observabilidade:** <!-- requisito -->",
    "",
    "## Riscos de Manutenção",
    "- **Risco 1:** <!-- descrição → mitigação -->",
    "- **Risco 2:** <!-- descrição → mitigação -->",
    "",
    "## Dúvidas [DOUBT]",
    doubtItems || "<!-- Nenhuma dúvida registrada. -->",
    "",
    "---",
    "",
    `*Gerado: ${timestamp} (modo interativo)*`,
    `*Implementador: ${process.env.USER || "desconhecido"}*`,
    "*Status: Draft — requer revisão de requirements*",
    "*Use `devflow next` para ver o diagnóstico e próximos passos.*",
    "",
  ].join("\n");
}
