import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectProject } from "../../src/project/inspector.js";
import { detectState } from "../../src/engine/state-detector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "..", "fixtures");

describe("State Detector", () => {
  it("detects greenfield-idea for empty project with package.json", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "greenfield-empty")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("greenfield-idea");
  });

  it("detects brownfield-unknown for code without Devflow", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "brownfield-no-specs")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("brownfield-unknown");
  });

  it("detects feature-requirements for feature with requirements.md", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "feature-with-requirements")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("feature-requirements");
  });

  it("detects feature-clarification-needed for requirements with [DOUBT]", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "feature-with-doubts")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("feature-clarification-needed");
  });

  it("detects feature-done for completed feature", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "completed-feature")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("feature-done");
  });

  it("includes evidence in result", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "greenfield-empty")
    );
    const result = await detectState(inspection);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.some((e) => e.key === "has_package_json")).toBe(
      true
    );
  });
});
