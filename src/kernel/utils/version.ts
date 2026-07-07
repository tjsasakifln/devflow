import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _version: string | null = null;

/**
 * Returns the Devflow version by reading package.json from the project root.
 * Result is cached after first call. Falls back to "0.0.0-dev" if package.json
 * cannot be read (e.g., in development without a build).
 */
export function getVersion(): string {
  if (_version !== null) return _version;
  try {
    // Navigate from dist/kernel/utils/ to project root where package.json lives
    const pkgPath = join(__dirname, "..", "..", "..", "package.json");
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version: string };
    _version = pkg.version;
  } catch {
    _version = "0.0.0-dev";
  }
  return _version;
}
