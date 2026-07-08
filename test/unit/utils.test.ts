import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { heading, bold, italic, code, codeBlock, list, checkbox, table, section, hr, comment, link, MARKER_START, MARKER_END } from "../../src/kernel/utils/markdown.js";
import { sha256, sha256Sync } from "../../src/kernel/utils/hash.js";
import { safeReadFile, fileExists, isDirectory, atomicWrite, ensureDir, listDir, countFiles, getLastModified } from "../../src/kernel/utils/fs.js";

describe("Markdown Utils", () => {
  it("heading creates markdown heading with correct level", () => {
    expect(heading(1, "Title")).toBe("# Title\n");
    expect(heading(2, "Sub")).toBe("## Sub\n");
    expect(heading(3, "Subsub")).toBe("### Subsub\n");
  });

  it("bold wraps text", () => {
    expect(bold("text")).toBe("**text**");
  });

  it("italic wraps text", () => {
    expect(italic("text")).toBe("*text*");
  });

  it("code wraps text", () => {
    expect(code("const x = 1")).toBe("`const x = 1`");
  });

  it("codeBlock creates fenced code block", () => {
    expect(codeBlock("js", "console.log('hi')")).toBe("```js\nconsole.log('hi')\n```\n");
  });

  it("list creates bullet list", () => {
    expect(list(["a", "b"])).toBe("- a\n- b");
  });

  it("checkbox creates checked and unchecked", () => {
    expect(checkbox("task", true)).toBe("- [X] task");
    expect(checkbox("task", false)).toBe("- [ ] task");
  });

  it("table creates markdown table", () => {
    const result = table(["Name", "Age"], [["Alice", "30"], ["Bob", "25"]]);
    expect(result).toContain("| Name | Age |");
    expect(result).toContain("|---|");
    expect(result).toContain("| Alice | 30 |");
    expect(result).toContain("| Bob | 25 |");
  });

  it("section creates section with title and content", () => {
    expect(section("Test", "Content")).toBe("## Test\n\nContent\n");
  });

  it("hr returns horizontal rule", () => {
    expect(hr()).toBe("\n---\n");
  });

  it("comment creates HTML comment", () => {
    expect(comment("note")).toBe("<!-- note -->");
  });

  it("link creates markdown link", () => {
    expect(link("text", "http://example.com")).toBe("[text](http://example.com)");
  });

  it("exports MARKER_START and MARKER_END constants", () => {
    expect(MARKER_START).toContain("DEVFLOW INTEGRATION START");
    expect(MARKER_END).toContain("DEVFLOW INTEGRATION END");
  });

  it("list handles empty array", () => {
    expect(list([])).toBe("");
  });

  it("table handles empty rows", () => {
    expect(table(["H1"], [])).toContain("| H1 |");
  });
});

describe("Hash Utils", () => {
  it("sha256Sync produces hex string", () => {
    const hash = sha256Sync("test");
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // hex-encoded sha256
  });

  it("sha256Sync is deterministic", () => {
    expect(sha256Sync("hello")).toBe(sha256Sync("hello"));
  });

  it("sha256Sync differs for different inputs", () => {
    expect(sha256Sync("hello")).not.toBe(sha256Sync("world"));
  });

  it("sha256 produces same result as sha256Sync", async () => {
    const [async, sync] = await Promise.all([sha256("test"), Promise.resolve(sha256Sync("test"))]);
    expect(async).toBe(sync);
  });

  it("sha256 handles empty string", async () => {
    const hash = await sha256("");
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64);
  });
});

describe("FS Utils", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), `devflow-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("safeReadFile returns null for non-existent file", async () => {
    const result = await safeReadFile(path.join(tmpDir, "nonexistent.txt"));
    expect(result).toBeNull();
  });

  it("safeReadFile returns content for existing file", async () => {
    const filePath = path.join(tmpDir, "existing.txt");
    await fs.writeFile(filePath, "hello", "utf-8");
    const result = await safeReadFile(filePath);
    expect(result).toBe("hello");
  });

  it("fileExists returns true for existing file", async () => {
    const filePath = path.join(tmpDir, "exists-test.txt");
    await fs.writeFile(filePath, "test", "utf-8");
    expect(await fileExists(filePath)).toBe(true);
  });

  it("fileExists returns false for non-existent file", async () => {
    expect(await fileExists(path.join(tmpDir, "no-such-file.txt"))).toBe(false);
  });

  it("isDirectory returns true for directory", async () => {
    expect(await isDirectory(tmpDir)).toBe(true);
  });

  it("isDirectory returns false for non-existent path", async () => {
    expect(await isDirectory(path.join(tmpDir, "no-such-dir"))).toBe(false);
  });

  it("atomicWrite writes content atomically", async () => {
    const filePath = path.join(tmpDir, "atomic-test.txt");
    await atomicWrite(filePath, "atomic content");
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toBe("atomic content");
  });

  it("ensureDir creates directory", async () => {
    const newDir = path.join(tmpDir, "nested", "deep", "dir");
    await ensureDir(newDir);
    const stat = await fs.stat(newDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("listDir returns file list", async () => {
    const files = await listDir(tmpDir);
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });

  it("listDir returns empty for non-existent dir", async () => {
    const files = await listDir(path.join(tmpDir, "no-such"));
    expect(files).toEqual([]);
  });

  it("countFiles returns number of files recursively", async () => {
    const count = await countFiles(tmpDir);
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("getLastModified returns a positive timestamp", async () => {
    const result = await getLastModified(tmpDir);
    expect(result).toBeGreaterThan(0);
  });
});
