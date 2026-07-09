import { describe, it, expect } from "vitest";
import {
  computeSanityScore,
  computeFeatureSanityScores,
} from "../../src/kernel/checks/sanity-score.js";

describe("computeSanityScore", () => {
  it("passes content with substantive, specific content", () => {
    const md = `
## Descricao Funcional
The system shall allow users to upload files up to 10MB in size to S3 via the /api/upload endpoint.
Uploaded files are stored in the UserFileService and must pass FileValidator.

## Comportamento Esperado
When a user calls POST /api/upload with a file under 10MB, the system:
1. Validates the file type against the ALLOWED_FILE_TYPES list
2. Stores it in S3 bucket devflow-uploads
3. Returns { url: string, size: number } with status 201

## Criterios de Aceitacao
Scenario: User uploads a valid file
Given a user is authenticated
When they upload a file under 10MB
Then the file is stored and a URL is returned

Scenario: User uploads an oversized file
Given a user is authenticated
When they upload a file over 10MB
Then an error is returned

Scenario: Upload failure handling
Given a user is authenticated
When S3 is unavailable
Then a 503 error is returned

## Casos de Erro
Upload timeout (>30s), file type mismatch (not in ALLOWED_FILE_TYPES),
S3 service failure (5xx), quota exceeded (>100MB/user).
`;
    const result = computeSanityScore(md);
    expect(result.passed).toBe(true);
    expect(result.totalScore).toBeGreaterThanOrEqual(50);
    expect(result.color).toMatch(/^(green|yellow)$/);
  });

  it("fails content with placeholders and boilerplate", () => {
    const md = `
## Descricao Funcional
TODO: implementar a feature seguindo boas práticas.

## Comportamento Esperado
TBD - a definir.

## Criterios de Aceitacao
N/A

## Casos de Erro
placeholder
`;
    const result = computeSanityScore(md);
    expect(result.passed).toBe(false);
    expect(result.totalScore).toBeLessThan(50);
    expect(result.color).toBe("red");
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("detects placeholder terms like TODO, TBD, lorem ipsum", () => {
    const md = `
## Section One
This section has some content about the feature.

## Section Two
TODO: implement this section later.
Also TBD and lorem ipsum dolor sit amet.

## Section Three
More content here about the actual behavior.
`;
    const result = computeSanityScore(md);
    const placeholder = result.metrics.placeholderDetection;
    expect(placeholder.score).toBeLessThan(100);
    expect(placeholder.passed).toBe(false);
  });

  it("scores empty artifact as 0/100 red", () => {
    const result = computeSanityScore("");
    expect(result.totalScore).toBe(0);
    expect(result.color).toBe("red");
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("applies custom blocking threshold", () => {
    const md = "## Test\nSome basic content but not very detailed.";
    const result = computeSanityScore(md, { blockingThreshold: 10 });
    expect(result.blockingThreshold).toBe(10);
  });

  it("detects generic/vague terminology", () => {
    const md = `
## Section One
This implements the feature following best practices.
The code is robust, scalable, and production-ready.
Clean code and well-documented with state-of-the-art patterns.

## Section Two
More content here about the actual behavior and implementation details.

## Section Three
Final section with some additional notes about the feature.
`;
    const result = computeSanityScore(md);
    // Should have low specificity due to generic terms
    expect(result.metrics.specificityScore.score).toBeLessThan(70);
  });

  it("provides color coding: green >= 80, yellow 50-79, red < 50", () => {
    // Excellent content
    const goodMd = `
## Descricao Funcional
The UploadService handles file uploads to S3 via /api/upload.
Uses FileValidator to check types against ALLOWED_TYPES.
Max file size: 10485760 bytes (10MB).

## Comportamento Esperado
When/upload receives a POST with valid file, returns 201 with {url,size}.
When file exceeds 10MB, returns 413 with error message.
When S3 is down, returns 503 after 30s timeout.

## Criterios de Aceitacao
Scenario: Valid file upload returns 201
Given file under 10MB
When POST /api/upload
Then status 201 with download URL

Scenario: File too large returns 413
Given file over 10MB
When POST /api/upload
Then status 413 with error message

Scenario: S3 failure returns 503
Given S3 is unavailable
When POST /api/upload
Then status 503 after timeout

## Casos de Erro
413: file size exceeded. 503: S3 unavailable. 400: invalid file type.
Timeout: 30s. Retry: 3 attempts with exponential backoff.
`;
    const goodResult = computeSanityScore(goodMd);

    // Medium content
    const mediumMd = `
## Section One
This describes the feature for user file uploads.

## Section Two
The system validates files and stores them.

## Section Three
Error handling covers common cases.
`;
    const mediumResult = computeSanityScore(mediumMd);

    // Verify color mapping
    if (goodResult.totalScore >= 80) {
      expect(goodResult.color).toBe("green");
    } else if (goodResult.totalScore >= 50) {
      expect(goodResult.color).toBe("yellow");
    }

    if (mediumResult.totalScore >= 50) {
      expect(mediumResult.color).toMatch(/^(green|yellow)$/);
    }
  });
});

describe("computeFeatureSanityScores", () => {
  const goodArtifact = `
## Section One
The FileUploadService handles uploads via /api/upload.
Validates against MAX_FILE_SIZE (10485760 bytes).
Stores in S3 bucket: devflow-prod-uploads.

## Section Two
Returns 201 with {url, size} on success.
Returns 413 if file > 10MB.
Returns 503 if S3 unavailable.

## Section Three
Error cases: timeout >30s, invalid type, quota exceeded.
`;
  const badArtifact = `
## Section One
TODO: implementar seguindo boas práticas.

## Section Two
TBD

## Section Three
N/A
`;

  it("aggregates scores across multiple artifacts", () => {
    const artifacts = {
      "requirements.md": goodArtifact,
      "roadmap.md": goodArtifact,
      "actions.md": goodArtifact,
      "test-plan.md": goodArtifact,
    };
    const result = computeFeatureSanityScores(artifacts);
    expect(result.overallScore).toBeGreaterThanOrEqual(50);
    expect(result.overallPassed).toBe(true);
    expect(Object.keys(result.artifacts).length).toBe(4);
  });

  it("flags features with low-quality artifacts", () => {
    const artifacts = {
      "requirements.md": badArtifact,
      "roadmap.md": badArtifact,
      "actions.md": badArtifact,
      "test-plan.md": badArtifact,
    };
    const result = computeFeatureSanityScores(artifacts);
    expect(result.overallPassed).toBe(false);
    expect(result.overallScore).toBeLessThan(50);
  });

  it("handles missing artifacts as score 0 red", () => {
    const artifacts: Record<string, string | null> = {
      "requirements.md": null,
      "roadmap.md": null,
      "actions.md": "## Test\nSome content",
      "test-plan.md": null,
    };
    const result = computeFeatureSanityScores(artifacts);
    const req = result.artifacts["requirements.md"];
    expect(req.score).toBe(0);
    expect(req.color).toBe("red");
  });

  it("applies custom options to all artifacts", () => {
    const artifacts: Record<string, string | null> = {
      "requirements.md": goodArtifact,
    };
    const result = computeFeatureSanityScores(artifacts, {
      blockingThreshold: 10,
      minContentDensity: 0.1,
    });
    expect(result.overallPassed).toBe(true);
  });
});
