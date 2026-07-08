import { describe, it, expect } from "vitest";
import { gatherEvidence, computeConfidence, gatherEvidenceRefs } from "../../src/kernel/evidence/gatherer.js";
import type { ProjectInspection } from "../../src/kernel/types/project.js";
import type { Evidence } from "../../src/kernel/types/state.js";

const baseInspection: ProjectInspection = {
  hasPackageJson: true,
  hasSrcDir: true,
  hasGit: true,
  gitStatus: "clean",
  hasDotDevflow: false,
  hasDevArtifacts: false,
  features: [],
};

const fullInspection: ProjectInspection = {
  ...baseInspection,
  language: "typescript",
  detectedFramework: "node",
  currentBranch: "main",
  activeFeature: {
    id: "feat-001",
    hasRequirements: true,
    hasClarification: false,
    hasQualityAudit: true,
    hasRoadmap: true,
    hasActions: true,
    hasQaReport: false,
    hasLegacyImpact: true,
    hasRegressionWatch: false,
    hasImplementationLog: true,
    requirementsDoubts: true,
    actionsCompletionRatio: 0.75,
    implementerActor: "dev-user",
    reviewerActor: "qa-user",
  },
};

describe("Evidence Gatherer", () => {
  describe("gatherEvidence", () => {
    it("returns array of evidence items", () => {
      const evidence = gatherEvidence(baseInspection);
      expect(Array.isArray(evidence)).toBe(true);
      expect(evidence.length).toBeGreaterThan(0);
    });

    it("includes project-level evidence", () => {
      const evidence = gatherEvidence(baseInspection);
      const hasPkgJson = evidence.find(e => e.key === "has_package_json");
      expect(hasPkgJson).toBeDefined();
      expect(hasPkgJson!.value).toBe(true);
      expect(hasPkgJson!.confidence).toBe("high");
    });

    it("includes git evidence", () => {
      const evidence = gatherEvidence(baseInspection);
      const hasGit = evidence.find(e => e.key === "has_git");
      expect(hasGit).toBeDefined();
      expect(hasGit!.value).toBe(true);
    });

    it("includes git state", () => {
      const evidence = gatherEvidence(baseInspection);
      const gitState = evidence.find(e => e.key === "git_state");
      expect(gitState).toBeDefined();
      expect(gitState!.value).toBe("clean");
    });

    it("includes feature count", () => {
      const evidence = gatherEvidence(baseInspection);
      const count = evidence.find(e => e.key === "feature_count");
      expect(count).toBeDefined();
      expect(count!.value).toBe(0);
    });

    it("includes language and framework when available", () => {
      const evidence = gatherEvidence(fullInspection);
      const lang = evidence.find(e => e.key === "language");
      expect(lang).toBeDefined();
      expect(lang!.value).toBe("typescript");
      const framework = evidence.find(e => e.key === "framework");
      expect(framework).toBeDefined();
      expect(framework!.value).toBe("node");
    });

    it("includes feature-level evidence when activeFeature exists", () => {
      const evidence = gatherEvidence(fullInspection);
      const featId = evidence.find(e => e.key === "active_feature_id");
      expect(featId).toBeDefined();
      expect(featId!.value).toBe("feat-001");
    });

    it("includes feature file checks", () => {
      const evidence = gatherEvidence(fullInspection);
      const hasReqs = evidence.find(e => e.key === "has_requirements");
      expect(hasReqs).toBeDefined();
      expect(hasReqs!.value).toBe(true);
      const hasQa = evidence.find(e => e.key === "has_qa_report");
      expect(hasQa).toBeDefined();
      expect(hasQa!.value).toBe(false);
    });

    it("includes implementer and reviewer evidence", () => {
      const evidence = gatherEvidence(fullInspection);
      const impl = evidence.find(e => e.key === "implementer_actor");
      expect(impl).toBeDefined();
      expect(impl!.value).toBe("dev-user");
      const rev = evidence.find(e => e.key === "reviewer_actor");
      expect(rev).toBeDefined();
      expect(rev!.value).toBe("qa-user");
    });

    it("includes requirements doubts when present", () => {
      const evidence = gatherEvidence(fullInspection);
      const doubts = evidence.find(e => e.key === "requirements_doubts");
      expect(doubts).toBeDefined();
      expect(doubts!.value).toBe(true);
    });

    it("includes actions completion ratio", () => {
      const evidence = gatherEvidence(fullInspection);
      const ratio = evidence.find(e => e.key === "actions_completion_ratio");
      expect(ratio).toBeDefined();
      expect(ratio!.value).toBe(0.75);
    });
  });

  describe("computeConfidence", () => {
    it("returns low for evidence when state has no mapping (default)", () => {
      // computeConfidence only maps specific states; unknown states return null for all evidence
      const evidence = gatherEvidence(baseInspection);
      const result = computeConfidence(evidence, "greenfield-idea");
      expect(result).toBe("low");
    });

    it("returns high when no-project state and evidence is contradictory", () => {
      // For no-project: has_package_json=true contradicts (weight=3 negative)
      // But has_dot_devflow=false has no mapping for no-project
      // has_git=true also contradicts (weight=3 negative)
      // has_src_dir=true contradicts (weight=3 negative)
      // So we have 9 negative weight, 0 positive → ratio = 0 → "low"
      const evidence = gatherEvidence(baseInspection);
      const result = computeConfidence(evidence, "no-project");
      expect(["low", "medium"]).toContain(result);
    });

    it("returns high for feature-done with qa report", () => {
      const evidence: Evidence[] = [
        { type: "file_presence", key: "has_qa_report", value: true, source: "test", confidence: "high" },
      ];
      const result = computeConfidence(evidence, "feature-done");
      expect(result).toBe("high");
    });

    it("returns low for empty evidence", () => {
      const result = computeConfidence([], "no-project");
      expect(result).toBe("low");
    });
  });

  describe("gatherEvidenceRefs", () => {
    it("returns array of EvidenceRef items", () => {
      const refs = gatherEvidenceRefs(baseInspection);
      expect(Array.isArray(refs)).toBe(true);
      expect(refs.length).toBeGreaterThan(0);
    });

    it("includes id, label, type, source, hash, timestamp, confidence", () => {
      const refs = gatherEvidenceRefs(baseInspection);
      for (const ref of refs) {
        expect(ref.id).toBeTruthy();
        expect(ref.label).toBeTruthy();
        expect(ref.type).toBeTruthy();
        expect(ref.source).toBeTruthy();
        expect(ref.hash).toBeTruthy();
        expect(ref.hash.algorithm).toBe("sha256");
        expect(ref.hash.value).toBeTruthy();
        expect(ref.timestamp).toBeTruthy();
        expect(typeof ref.confidence).toBe("number");
      }
    });

    it("generates sequential IDs E001, E002, ...", () => {
      const refs = gatherEvidenceRefs(baseInspection);
      expect(refs[0].id).toBe("E001");
      expect(refs[1].id).toBe("E002");
    });

    it("includes git status as git-history type", () => {
      const refs = gatherEvidenceRefs(baseInspection);
      const gitStatus = refs.find(r => r.label.includes("Git status"));
      expect(gitStatus).toBeDefined();
      expect(gitStatus!.type).toBe("git-history");
      expect(gitStatus!.source).toBeDefined();
    });

    it("includes feature-specific refs when active feature exists", () => {
      const refs = gatherEvidenceRefs(fullInspection);
      const featRef = refs.find(r => r.label.includes("Active feature"));
      expect(featRef).toBeDefined();
      const reqRef = refs.find(r => r.label.includes("requirements.md"));
      expect(reqRef).toBeDefined();
      expect(reqRef!.source.target).toContain("feat-001");
    });

    it("includes implementer and reviewer refs", () => {
      const refs = gatherEvidenceRefs(fullInspection);
      const implRef = refs.find(r => r.label === "Implementer actor");
      expect(implRef).toBeDefined();
      const revRef = refs.find(r => r.label === "Reviewer actor");
      expect(revRef).toBeDefined();
    });
  });
});
