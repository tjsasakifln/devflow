import path from "node:path";
import fs from "node:fs/promises";
import pc from "picocolors";

// ── Types ──

export interface AiInitResult {
  success: boolean;
  configured: string[];
  failed: string[];
  envPath: string;
  details: Array<{ provider: string; status: "ok" | "error" | "skipped"; message: string }>;
}

interface ProviderConfig {
  key: string;
  envVar: string;
  validate: (value: string) => Promise<string | null>; // null = valid, string = error
  label: string;
}

// ── Provider validators ──

async function validateAnthropicKey(key: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [{ role: "user", content: "hello" }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    // 400 with overrides_limit is actually auth success (prompt too short for the model)
    if (response.status === 200 || response.status === 400) return null;
    if (response.status === 401) return "Invalid API key (401 Unauthorized)";
    return `Unexpected response: ${response.status} ${response.statusText}`;
  } catch (err) {
    return `Connection error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function validateOpenAiKey(key: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 200) return null;
    if (response.status === 401) return "Invalid API key (401 Unauthorized)";
    return `Unexpected response: ${response.status} ${response.statusText}`;
  } catch (err) {
    return `Connection error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function validateOllamaHost(host: string): Promise<string | null> {
  try {
    const url = host.replace(/\/+$/, "") + "/api/tags";
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.status === 200) return null;
    return `Ollama returned status ${response.status}`;
  } catch (err) {
    return `Cannot reach Ollama at ${host}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ── .env reader/writer ──

async function readEnvFile(envPath: string): Promise<Map<string, string>> {
  try {
    const content = await fs.readFile(envPath, "utf-8");
    const env = new Map<string, string>();
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key) env.set(key, value);
    }
    return env;
  } catch {
    return new Map();
  }
}

async function writeEnvFile(
  envPath: string,
  updates: Record<string, string>,
): Promise<void> {
  const existing = await readEnvFile(envPath);

  // Apply updates
  for (const [key, value] of Object.entries(updates)) {
    existing.set(key, value);
  }

  // Rebuild file preserving original ordering, commenting new entries
  let content = "";
  const written = new Set<string>();

  // Try to read original content to preserve comments and ordering
  try {
    const original = await fs.readFile(envPath, "utf-8");
    const lines = original.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        content += line + "\n";
        continue;
      }
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) {
        content += line + "\n";
        continue;
      }
      const key = trimmed.slice(0, eqIdx).trim();
      if (existing.has(key)) {
        content += `${key}=${existing.get(key)}\n`;
        written.add(key);
      } else {
        content += line + "\n";
      }
    }
  } catch {
    // File doesn't exist — start fresh
  }

  // Append any new keys not yet written
  for (const [key, value] of existing) {
    if (!written.has(key)) {
      content += `\n# AI provider configured by \`devflow ai init\`\n${key}=${value}\n`;
      written.add(key);
    }
  }

  await fs.mkdir(path.dirname(envPath), { recursive: true });
  await fs.writeFile(envPath, content, "utf-8");
}

// ── Main command ──

export interface AiInitOptions {
  providers?: string[]; // subset of ["anthropic", "openai", "ollama"]
  yes?: boolean;
}

export async function aiInitCommand(
  cwd: string,
  options: AiInitOptions,
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const envPath = path.join(rootPath, ".env");
  const existingEnv = await readEnvFile(envPath);

  // ── Banner to stderr ──
  process.stderr.write(
    pc.bold("\nDevflow AI Init\n") +
    pc.dim("Configure AI provider connections\n\n"),
  );

  const providers: ProviderConfig[] = [
    {
      key: "anthropic",
      envVar: "ANTHROPIC_API_KEY",
      label: "Anthropic (Claude)",
      validate: validateAnthropicKey,
    },
    {
      key: "openai",
      envVar: "OPENAI_API_KEY",
      label: "OpenAI",
      validate: validateOpenAiKey,
    },
    {
      key: "ollama",
      envVar: "OLLAMA_HOST",
      label: "Ollama (local)",
      validate: validateOllamaHost,
    },
  ];

  // Filter if specific providers requested
  const activeProviders = options.providers
    ? providers.filter((p) => options.providers!.includes(p.key))
    : providers;

  const result: AiInitResult = {
    success: true,
    configured: [],
    failed: [],
    envPath,
    details: [],
  };

  for (const provider of activeProviders) {
    const existingValue = existingEnv.get(provider.envVar) || "";
    const defaultVal = provider.key === "ollama" ? "http://localhost:11434" : "";

    if (existingValue && existingValue.length > 0 && !options.yes) {
      // Key already set — validate existing
      process.stderr.write(
        pc.dim(`  ${provider.label}: key already set in .env — validating... `),
      );
      const error = await provider.validate(existingValue);
      if (error) {
        process.stderr.write(pc.red("FAIL") + "\n");
        process.stderr.write(pc.dim(`    ${error}\n`));
        result.details.push({
          provider: provider.key,
          status: "error",
          message: error,
        });
        result.failed.push(provider.key);
      } else {
        process.stderr.write(pc.green("OK") + "\n");
        result.details.push({
          provider: provider.key,
          status: "ok",
          message: "Validated existing key",
        });
        result.configured.push(provider.key);
      }
      continue;
    }

    if (options.yes && !existingValue) {
      // Non-interactive, no existing value — skip
      process.stderr.write(
        pc.dim(`  ${provider.label}: skipped (--yes mode, no existing value)\n`),
      );
      result.details.push({
        provider: provider.key,
        status: "skipped",
        message: "No key provided (--yes mode)",
      });
      continue;
    }

    // Prompt for value (non-interactive: skip)
    process.stderr.write(pc.cyan(`  ? ${provider.label}`));
    process.stderr.write(
      pc.dim(provider.key === "ollama" ? ` [${defaultVal}]: ` : ": "),
    );

    // Read from stdin for interactive input
    let value = existingValue || (provider.key === "ollama" ? defaultVal : "");
    if (!options.yes) {
      value = await readLine(value);
    }

    if (!value || value.trim() === "") {
      process.stderr.write(pc.yellow("skipped\n"));
      result.details.push({
        provider: provider.key,
        status: "skipped",
        message: "No value provided",
      });
      continue;
    }

    process.stderr.write(pc.dim(" validating... "));

    const error = await provider.validate(value.trim());
    if (error) {
      process.stderr.write(pc.red("FAIL") + "\n");
      process.stderr.write(pc.dim(`    ${error}\n`));
      result.details.push({
        provider: provider.key,
        status: "error",
        message: error,
      });
      result.failed.push(provider.key);
    } else {
      process.stderr.write(pc.green("OK") + "\n");
      // Save to .env
      await writeEnvFile(envPath, { [provider.envVar]: value.trim() });
      result.details.push({
        provider: provider.key,
        status: "ok",
        message: "Validated and saved",
      });
      result.configured.push(provider.key);
    }
  }

  // ── Summary ──
  result.success = result.failed.length === 0;

  const summaryParts: string[] = [];
  if (result.configured.length > 0) {
    summaryParts.push(`${pc.green("✓")} ${result.configured.length} configured`);
  }
  if (result.failed.length > 0) {
    summaryParts.push(`${pc.red("✖")} ${result.failed.length} failed`);
  }
  if (result.details.filter((d) => d.status === "skipped").length > 0) {
    summaryParts.push(
      `${pc.yellow("–")} ${result.details.filter((d) => d.status === "skipped").length} skipped`,
    );
  }

  process.stderr.write(pc.bold("\nResults: ") + summaryParts.join(" · ") + "\n\n");

  // ── Pipe-safe JSON to stdout ──
  console.log(JSON.stringify(result, null, 2));
}

// ── Stdin reader ──

async function readLine(defaultValue: string): Promise<string> {
  return new Promise<string>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", (data: Buffer) => {
      process.stdin.pause();
      const input = data.toString("utf-8").trim();
      resolve(input || defaultValue);
    });
  });
}
