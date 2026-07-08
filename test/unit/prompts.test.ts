import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  confirm: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  multiSelect: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
});

describe("isInteractive", () => {
  // Each test dynamically re-imports the module to reset the internal `_isInteractive` cache.
  // We test through dynamic import so module state is fresh per test.

  it("returns true when TTY is available and no CI flag", async () => {
    process.stdout.isTTY = true;
    const mod = await import("../../src/kernel/utils/prompts.js");
    expect(mod.isInteractive()).toBe(true);
  });

  it("returns false when CI env is set", async () => {
    process.stdout.isTTY = true;
    process.env.CI = "true";
    const mod = await import("../../src/kernel/utils/prompts.js");
    expect(mod.isInteractive()).toBe(false);
  });

  it("returns false when DEVFLOW_NON_INTERACTIVE is set", async () => {
    process.stdout.isTTY = true;
    process.env.DEVFLOW_NON_INTERACTIVE = "1";
    const mod = await import("../../src/kernel/utils/prompts.js");
    expect(mod.isInteractive()).toBe(false);
  });

  it("returns false when not a TTY", async () => {
    process.stdout.isTTY = false;
    const mod = await import("../../src/kernel/utils/prompts.js");
    expect(mod.isInteractive()).toBe(false);
  });

  it("caches result after first call", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    expect(mod.isInteractive()).toBe(false);
    // _isInteractive is cached, env change doesn't affect it
    process.stdout.isTTY = true;
    expect(mod.isInteractive()).toBe(false);
  });

  it("setNonInteractive forces false regardless of TTY", async () => {
    process.stdout.isTTY = true;
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    expect(mod.isInteractive()).toBe(false);
  });
});

describe("setNonInteractive", () => {
  it("forces non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    expect(mod.isInteractive()).toBe(false);
  });
});

describe("confirmOrExit", () => {
  it("returns false in non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    const result = await mod.confirmOrExit("Continue?");
    expect(result).toBe(false);
  });
});

describe("requiredTextInput", () => {
  it("returns empty string in non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    const result = await mod.requiredTextInput("Enter name:");
    expect(result).toBe("");
  });
});

describe("optionalTextInput", () => {
  it("returns empty string in non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    const result = await mod.optionalTextInput("Optional:");
    expect(result).toBe("");
  });
});

describe("selectOption", () => {
  it("returns first option value in non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    const result = await mod.selectOption("Pick:", [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ]);
    expect(result).toBe("a");
  });

  it("returns null for empty options in non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    const result = await mod.selectOption("Pick:", []);
    expect(result).toBeNull();
  });
});

describe("multiSelectCheckboxes", () => {
  it("returns empty array in non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    const result = await mod.multiSelectCheckboxes("Pick:", [
      { value: "a", label: "A" },
    ]);
    expect(result).toEqual([]);
  });
});

describe("spinnerWhile", () => {
  it("executes the callback even in non-interactive mode", async () => {
    const mod = await import("../../src/kernel/utils/prompts.js");
    mod.setNonInteractive();
    const fn = vi.fn().mockResolvedValue("result");
    const result = await mod.spinnerWhile("Loading", fn);
    expect(fn).toHaveBeenCalled();
    expect(result).toBe("result");
  });
});
