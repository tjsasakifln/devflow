/**
 * Thin wrapper around @clack/prompts.
 *
 * Every function:
 * - Handles isCancel uniformly (exits cleanly)
 * - Validates required inputs
 * - Degrades gracefully when TTY is unavailable (non-interactive mode)
 */

import pc from "picocolors";

let clackPrompts: any = null;

async function loadClack() {
  if (!clackPrompts) {
    try {
      const mod = await import("@clack/prompts");
      clackPrompts = mod;
    } catch {
      // @clack/prompts not available — use fallback
    }
  }
  return clackPrompts;
}

// ─────────────────────────────────────────────
// TTY detection
// ─────────────────────────────────────────────

let _isInteractive: boolean | null = null;
export function isInteractive(): boolean {
  if (_isInteractive !== null) return _isInteractive;
  _isInteractive =
    process.stdout.isTTY === true &&
    !process.env.CI &&
    !process.env.DEVFLOW_NON_INTERACTIVE;
  return _isInteractive;
}

/** Force non-interactive mode (for CI, tests, --non-interactive flag) */
export function setNonInteractive(): void {
  _isInteractive = false;
}

// ─────────────────────────────────────────────
// Prompt wrappers
// ─────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Confirm with the user. Returns false in non-interactive mode.
 * Exits process on Ctrl+C.
 */
export async function confirmOrExit(message: string): Promise<boolean> {
  if (!isInteractive()) {
    console.log(pc.dim(`  [?] ${message} → no (non-interactive)`));
    return false;
  }

  const p = await loadClack();
  if (!p) return fallbackConfirm(message);

  const result = await p.confirm({ message });
  if (p.isCancel(result)) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  return result === true;
}

/**
 * Ask for text input. Validates non-empty by default.
 * Exits process on Ctrl+C.
 */
export async function requiredTextInput(
  message: string,
  validate?: (value: string) => string | undefined,
): Promise<string> {
  if (!isInteractive()) {
    console.log(pc.dim(`  [?] ${message} → (skipped, non-interactive)`));
    return "";
  }

  const p = await loadClack();
  if (!p) return fallbackText(message);

  const result = await p.text({
    message,
    validate: validate ?? ((v: string) => {
      if (!v.trim()) return "This field is required.";
      return undefined;
    }),
  });

  if (p.isCancel(result)) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  return result as string;
}

/**
 * Optional text input. Returns empty string if user skips.
 */
export async function optionalTextInput(message: string): Promise<string> {
  if (!isInteractive()) return "";

  const p = await loadClack();
  if (!p) return fallbackText(message);

  const result = await p.text({
    message,
    defaultValue: "",
  });

  if (p.isCancel(result)) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  return (result as string) ?? "";
}

/**
 * Let user select from options. Returns the selected value.
 */
export async function selectOption(
  message: string,
  options: SelectOption[],
): Promise<string | null> {
  if (!isInteractive()) {
    console.log(pc.dim(`  [?] ${message} → (skipped, non-interactive)`));
    return options[0]?.value ?? null;
  }

  const p = await loadClack();
  if (!p) return fallbackSelect(message, options);

  const result = await p.select({
    message,
    options: options.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
  });

  if (p.isCancel(result)) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  return result as string;
}

/**
 * Multi-select checkboxes.
 */
export async function multiSelectCheckboxes(
  message: string,
  options: MultiSelectOption[],
): Promise<string[]> {
  if (!isInteractive()) {
    console.log(pc.dim(`  [?] ${message} → (skipped, non-interactive)`));
    return [];
  }

  const p = await loadClack();
  if (!p) return [];

  const result = await p.multiselect({
    message,
    options: options.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
    required: false,
  });

  if (p.isCancel(result)) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  return (result as string[]) ?? [];
}

/**
 * Show a spinner while executing an async function.
 * In non-interactive mode, just prints a message.
 */
export async function spinnerWhile<T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isInteractive()) {
    console.log(pc.dim(`  ... ${message}`));
    return fn();
  }

  const p = await loadClack();
  if (!p) {
    console.log(pc.dim(`  ... ${message}`));
    return fn();
  }

  const s = p.spinner();
  s.start(message);
  try {
    const result = await fn();
    s.stop(pc.green("Done"));
    return result;
  } catch (err) {
    s.stop(pc.red("Failed"));
    throw err;
  }
}

// ─────────────────────────────────────────────
// Fallback implementations (when @clack/prompts not installed)
// ─────────────────────────────────────────────

function fallbackConfirm(message: string): boolean {
  console.log(pc.yellow(`  [?] ${message} (y/n)`));
  return false;
}

function fallbackText(message: string): string {
  console.log(pc.yellow(`  [?] ${message}`));
  console.log(pc.dim("     (interactive prompts unavailable — install @clack/prompts)"));
  return "";
}

function fallbackSelect(
  message: string,
  options: SelectOption[],
): string | null {
  console.log(pc.yellow(`  [?] ${message}`));
  for (const o of options) {
    console.log(pc.dim(`     [${o.value}] ${o.label}`));
  }
  return options[0]?.value ?? null;
}
