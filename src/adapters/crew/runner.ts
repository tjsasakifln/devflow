/**
 * CrewAI Sidecar Runner
 *
 * Optional Python-based multi-agent review using CrewAI.
 * Communication via JSON exchange files in .devflow/ai/exchange/.
 * Gracefully degrades if Python/uv not installed.
 */

import { runProcess } from "../process/safe-runner.js";
import path from "node:path";

export interface CrewRunOptions {
  crewName: "review" | "adversarial" | "feature-flow";
  featureId: string;
  rootPath: string;
}

export interface CrewRunResult {
  success: boolean;
  output: string;
  error?: string;
}

/** Check if CrewAI sidecar is available. */
export async function isCrewAIAvailable(rootPath: string): Promise<boolean> {
  const sidecarPath = path.join(rootPath, "agents", "crewai-sidecar", "pyproject.toml");
  try {
    const { stat } = await import("node:fs/promises");
    await stat(sidecarPath);
  } catch {
    return false;
  }

  // Check for uv (Python package manager)
  const result = await runProcess({
    command: "uv",
    args: ["--version"],
    cwd: rootPath,
    timeout: 5_000,
    allowedCommands: ["uv"],
  });
  return result.exitCode === 0;
}

/** Run a CrewAI crew via the sidecar. */
export async function runCrew(options: CrewRunOptions): Promise<CrewRunResult> {
  if (!(await isCrewAIAvailable(options.rootPath))) {
    return {
      success: false,
      output: "",
      error:
        "CrewAI sidecar not available. Install Python + uv and set up agents/crewai-sidecar/. Falling back to LangGraph TypeScript path.",
    };
  }

  const exchangeDir = path.join(options.rootPath, ".devflow", "ai", "exchange");
  const sidecarPath = path.join(options.rootPath, "agents", "crewai-sidecar");

  const result = await runProcess({
    command: "uv",
    args: [
      "run",
      "--directory",
      sidecarPath,
      "python",
      "-m",
      `crews.${options.crewName}_crew`,
      "--feature-id",
      options.featureId,
      "--exchange-dir",
      exchangeDir,
    ],
    cwd: options.rootPath,
    timeout: 300_000,
    allowedCommands: ["uv"],
  });

  return {
    success: result.exitCode === 0,
    output: result.stdout,
    error: result.stderr || undefined,
  };
}

/** Graceful degradation message for when CrewAI is unavailable. */
export function crewFallbackMessage(): string {
  return [
    "CrewAI sidecar not available. Options:",
    "  1. Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh",
    "  2. Set up sidecar: cd agents/crewai-sidecar && uv sync",
    "  3. Use LangGraph TypeScript path: devflow requirements audit <id> --ai",
  ].join("\n");
}
