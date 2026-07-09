/**
 * AI Artifact Generator — `devflow feature new --quick`
 *
 * Generates all 4 required artifacts (requirements.md, roadmap.md,
 * actions.md, test-plan.md) from a one-line feature description
 * using the configured AI provider.
 */

import path from "node:path";
import { ArtifactManager } from "./manager.js";
import type { DevflowModelProvider } from "../../adapters/models/index.js";

// ── Types ──

export interface QuickGenerateOptions {
  cwd: string;
  featureName: string;
  featureId: string;
  featurePath: string;
  description: string;
}

export interface GenerateResult {
  success: boolean;
  generated: string[];
  failed: string[];
  durationMs: number;
  message?: string;
}

interface ArtifactDef {
  id: string;
  filename: string;
  promptBuilder: (name: string, id: string, desc: string) => string;
}

// ── Artifact definitions ──

const ARTIFACTS: ArtifactDef[] = [
  { id: "requirements", filename: "requirements.md", promptBuilder: buildRequirementsPrompt },
  { id: "roadmap", filename: "roadmap.md", promptBuilder: buildRoadmapPrompt },
  { id: "actions", filename: "actions.md", promptBuilder: buildActionsPrompt },
  { id: "test-plan", filename: "test-plan.md", promptBuilder: buildTestPlanPrompt },
];

// ── Provider detection ──

export function detectAvailableProvider(): DevflowModelProvider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey.length > 0) {
    return createDirectAnthropicProvider(apiKey);
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && openAiKey.length > 0) {
    return createDirectOpenAiProvider(openAiKey);
  }

  const ollamaHost = process.env.OLLAMA_HOST;
  if (ollamaHost && ollamaHost.length > 0) {
    return createOllamaProvider(ollamaHost);
  }

  return null;
}

export function isAiProviderConfigured(): boolean {
  return !!(
    (process.env.ANTHROPIC_API_KEY?.length ?? 0) > 0 ||
    (process.env.OPENAI_API_KEY?.length ?? 0) > 0 ||
    (process.env.OLLAMA_HOST?.length ?? 0) > 0
  );
}

// ── Provider implementations (lightweight, no SDK deps) ──

function createDirectAnthropicProvider(apiKey: string): DevflowModelProvider {
  return {
    name: "anthropic",
    async invoke(prompt: string) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };

      const text = data.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      return { content: text, modelName: "claude-sonnet-4-20250514" };
    },
  };
}

function createDirectOpenAiProvider(apiKey: string): DevflowModelProvider {
  return {
    name: "openai",
    async invoke(prompt: string) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      return {
        content: data.choices[0]?.message?.content ?? "",
        modelName: "gpt-4o",
      };
    },
  };
}

function createOllamaProvider(host: string): DevflowModelProvider {
  const baseUrl = host.replace(/\/+$/, "");
  return {
    name: "ollama",
    async invoke(prompt: string) {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        message?: { content: string };
        response?: string;
      };

      const content = data.message?.content ?? data.response ?? "";
      return { content, modelName: "llama3.2" };
    },
  };
}

// ── AI call wrapper ──

async function callAI(prompt: string): Promise<string> {
  const provider = detectAvailableProvider();
  if (!provider) {
    throw new Error("No AI provider configured. Run `devflow ai init` first.");
  }

  const result = await provider.invoke(prompt);
  return result.content;
}

// ── Prompt builders ──

function buildRequirementsPrompt(name: string, id: string, desc: string): string {
  return [
    `You are a senior software engineer writing a feature requirements document.`,
    ``,
    `Generate a complete requirements.md for the following feature.`,
    ``,
    `Feature Name: ${name}`,
    `Feature ID: ${id}`,
    `Description: ${desc}`,
    ``,
    `The document MUST follow this exact section structure. For EACH section, write concrete, specific content — NOT generic placeholders. Use the pedagogical examples as quality guidance.`,
    ``,
    `SECTIONS:`,
    `1. ## Descrição Funcional — Explain the BUSINESS PROBLEM this feature solves. Use language a product manager would understand. Quantify impact where possible.`,
    `2. ## Comportamento Esperado — Describe system behavior in "When [actor] does [action], the system [reaction]" format. Cover main flow + at least 1 alternative flow.`,
    `3. ## Invariantes de Domínio — Business rules that must ALWAYS be true. At least 2 boolean invariants.`,
    `4. ## Entradas — List each input with name, type, required/optional, validation rules.`,
    `5. ## Saídas — List each output with format, content, HTTP status code (if API).`,
    `6. ## Regras de Negócio — Numbered rules R01, R02, etc. At least 3. Each must be testable.`,
    `7. ## Dados Persistidos — What data is stored? In which tables/models? New or modified fields?`,
    `8. ## Integrações Externas — External APIs, services affected. For each: endpoint, contract, failure strategy.`,
    `9. ## Critérios de Aceitação — At least 3 Gherkin scenarios (Given/When/Then). Include 1 error scenario.`,
    `10. ## Casos de Erro — At least 3 errors with trigger, HTTP code (if API), response payload, recovery strategy.`,
    `11. ## Casos Extremos — At least 3 concrete edge cases with expected behavior.`,
    `12. ## Restrições Técnicas — Technical limitations, dependency versions, infra constraints.`,
    `13. ## Escopo Negativo — Explicitly what is NOT included. At least 3 items.`,
    `14. ## Requisitos Não-Funcionais — Performance, security, observability with concrete metrics.`,
    `15. ## Riscos de Manutenção — At least 2 specific risks with concrete mitigations.`,
    `16. ## Dúvidas [DOUBT] — Any open questions. If none, leave blank.`,
    ``,
    `IMPORTANT:`,
    `- Write in Brazilian Portuguese (pt-BR).`,
    `- Every section must have REAL content — no "<!-- placeholder -->" comments.`,
    `- Be specific. Use examples, numbers, and concrete scenarios.`,
    `- Total document should be 2000-4000 characters.`,
    ``,
    `Output ONLY the markdown content. Start with "# Feature: ${name} (${id})".`,
  ].join("\n");
}

function buildRoadmapPrompt(name: string, id: string, desc: string): string {
  return [
    `You are a senior software architect writing an architectural roadmap document.`,
    ``,
    `Generate a complete roadmap.md for the following feature.`,
    ``,
    `Feature Name: ${name}`,
    `Feature ID: ${id}`,
    `Description: ${desc}`,
    ``,
    `The document MUST follow this exact section structure with concrete content:`,
    ``,
    `SECTIONS:`,
    `1. ## Desenho Arquitetural — Mermaid diagram showing components, data flow, and dependency direction. Include a real diagram.`,
    `2. ## Camadas Envolvidas — Check which architecture layers are touched (Domain, Application, Infrastructure, Interface). Justify each.`,
    `3. ## Classes/Módulos Previstos — Table with Class/Module, Single Responsibility, Layer. Each class has ONE responsibility (SRP).`,
    `4. ## Padrões de Projeto Adotados — Name the pattern AND explain what specific problem it solves in THIS feature. At least 2 patterns.`,
    `5. ## Padrões Rejeitados — Patterns considered but rejected, with reason. At least 1.`,
    `6. ## Interfaces Necessárias — TypeScript interfaces for contracts between layers.`,
    `7. ## Repositories — Data access interfaces.`,
    `8. ## Adapters — External service adapters.`,
    `9. ## Serviços de Domínio — Domain services for business rules.`,
    `10. ## Riscos de Acoplamento — Dependencies between modules and what breaks if one changes. At least 2.`,
    `11. ## Impacto em Código Legado — Table with file, change type (mod/create/delete), risk level.`,
    `12. ## Estratégia de Rollback — How to undo in < 5 minutes. Include migration rollback if applicable.`,
    `13. ## Verificação de Constitution — Checklist C1-C8 with context-specific notes.`,
    ``,
    `IMPORTANT:`,
    `- Write in Brazilian Portuguese (pt-BR).`,
    `- Every section must have REAL content. No placeholders.`,
    `- The Mermaid diagram must be valid syntax.`,
    `- Total: 1500-3000 characters.`,
    ``,
    `Output ONLY the markdown content. Start with "# Architectural Roadmap: ${name}".`,
  ].join("\n");
}

function buildActionsPrompt(name: string, id: string, desc: string): string {
  return [
    `You are a senior developer writing an implementation action plan.`,
    ``,
    `Generate a complete actions.md for the following feature.`,
    ``,
    `Feature Name: ${name}`,
    `Feature ID: ${id}`,
    `Description: ${desc}`,
    ``,
    `The document MUST follow this structure:`,
    ``,
    `SECTIONS:`,
    `1. ## Pre-requisites — Checklist of conditions before implementation starts (requirements reviewed, roadmap approved, test plan defined, constitution check).`,
    `2. ## Action List — Break the feature into numbered implementation tasks (T001, T002, T003...). Each task is ONE atomic unit of work (1 commit, 1 file, 1 test).`,
    ``,
    `For EACH task, provide a markdown table with:`,
    `- **Alvo exato**: exact file path (e.g., src/domain/Entity.ts)`,
    `- **Camada**: Domain / Application / Infrastructure / Interface`,
    `- **Contrato esperado**: function signature or interface`,
    `- **Teste associado**: test file path`,
    `- **Comando de verificação**: verification command`,
    `- **Evidência esperada**: expected evidence (e.g., "N tests passing")`,
    `- **Risco**: low/medium/high with description`,
    `- **Dependências**: dependencies on other tasks`,
    `- **Status**: [ ] Pendente`,
    ``,
    `Include 4-8 tasks covering the full feature scope.`,
    ``,
    `3. ## Rollback Plan — How to undo each task.`,
    `4. ## Verification Suite — Commands to run before declaring completion.`,
    ``,
    `IMPORTANT:`,
    `- Write in Brazilian Portuguese (pt-BR).`,
    `- Every task must be atomic and specific. No task larger than 1 file.`,
    `- Be realistic about file paths based on a typical TypeScript project structure.`,
    `- Total: 1500-3000 characters.`,
    ``,
    `Output ONLY the markdown content. Start with "# Actions: ${name}".`,
  ].join("\n");
}

function buildTestPlanPrompt(name: string, id: string, desc: string): string {
  return [
    `You are a senior QA engineer writing a test plan document.`,
    ``,
    `Generate a complete test-plan.md for the following feature.`,
    ``,
    `Feature Name: ${name}`,
    `Feature ID: ${id}`,
    `Description: ${desc}`,
    ``,
    `The document MUST follow this structure:`,
    ``,
    `SECTIONS:`,
    `1. ## Test Strategy — Overall testing approach for this feature.`,
    `2. ## Unit Tests — Per Contract table: Contract (function/class), Test File, Edge Cases Covered.`,
    `3. ## Integration Tests — Per Flow table: Flow, Test File, Dependencies Mocked.`,
    `4. ## Edge Cases — Checklist of at least 4 concrete edge cases.`,
    `5. ## Error Scenarios — Checklist of at least 3 error scenarios with expected behavior.`,
    `6. ## Regression Coverage — Existing tests that must keep passing.`,
    `7. ## Verification Commands — Commands to run all tests.`,
    `8. ## Coverage Targets — Lines >= 80%, Branches >= 80%, Functions >= 80%, Domain branches 100%.`,
    ``,
    `IMPORTANT:`,
    `- Write in Brazilian Portuguese (pt-BR).`,
    `- Every section must have REAL content. No placeholders.`,
    `- Each unit test maps to a contract with specific edge cases.`,
    `- Each integration test maps to a flow with specific mocked dependencies.`,
    `- Be specific about test file paths and edge case conditions.`,
    `- Total: 1500-3000 characters.`,
    ``,
    `Output ONLY the markdown content. Start with "# Test Plan: ${name} (${id})".`,
  ].join("\n");
}

// ── Banner ──

function addAIBanner(content: string, artifactType: string): string {
  const banner = [
    `> 🤖 **AI-GENERATED — REVIEW BEFORE CODING**`,
    `>`,
    `> This \`${artifactType}\` was automatically generated by \`devflow feature new --quick\``,
    `> from a one-line description. Review each section carefully before using it`,
    `> for implementation. The AI may have made assumptions that do not match`,
    `> your actual requirements.`,
    `>`,
    `> Generated: ${new Date().toISOString()}`,
    `> Tool: Devflow Quick Mode`,
    ``,
  ].join("\n");

  return banner + content;
}

// ── Main generator ──

export async function quickGenerateArtifacts(
  options: QuickGenerateOptions,
): Promise<GenerateResult> {
  const { cwd, featureName, featureId, featurePath, description } = options;
  const startTime = Date.now();

  // Check provider
  if (!isAiProviderConfigured()) {
    return {
      success: false,
      generated: [],
      failed: ARTIFACTS.map((a) => a.filename),
      durationMs: 0,
      message:
        "No AI provider configured. Please run `devflow ai init` to configure an AI provider first.",
    };
  }

  const generated: string[] = [];
  const failed: string[] = [];
  const manager = new ArtifactManager(cwd);

  for (const artifact of ARTIFACTS) {
    try {
      const prompt = artifact.promptBuilder(featureName, featureId, description);
      const content = await callAI(prompt);
      const finalContent = addAIBanner(content, artifact.id);
      const filePath = path.join(featurePath, artifact.filename);

      // Write the file
      await manager.safeWrite(filePath, finalContent, artifact.filename);
      generated.push(artifact.filename);
    } catch (err) {
      failed.push(artifact.filename);
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: failed.length === 0,
    generated,
    failed,
    durationMs,
  };
}
