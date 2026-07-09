/**
 * Sanity Score — Artifact Quality Scoring Engine
 *
 * Measures actual content density in artifacts (requirements.md, roadmap.md,
 * actions.md, test-plan.md) and rejects placeholder-filled templates before
 * code is written.
 *
 * 4 Metrics (weighted, 0-100 total):
 *   - Content density (30%): user-written content vs template boilerplate
 *   - Section completion (25%): sections with non-placeholder text
 *   - Specificity score (25%): concrete names, values, file paths
 *   - Placeholder detection (20%): flags TODO, TBD, lorem ipsum, etc.
 *
 * Usage:
 *   const result = computeSanityScore(markdownContent);
 *   if (result.totalScore < 50) { /* block feature prompt *\/ }
 */

// ── Placeholder terms to detect ──
const DEFAULT_PLACEHOLDER_TERMS: readonly string[] = [
  // Portuguese
  "todo", "tbd", "n/a", "nao informado", "nao se aplica",
  "lorem ipsum", "placeholder", "teste", "exemplo",
  "a definir", "pendente", "em breve",
  // English
  "todo", "tbd", "n/a", "not informed", "not applicable",
  "lorem ipsum", "placeholder", "test", "example",
  "to be defined", "to be determined", "pending", "coming soon",
  // Template boilerplate indicators
  "preencha", "descreva", "adicione", "substitua",
  "fill this", "describe", "add your", "replace this",
  "[preencha", "[adicione", "[descreva", "[replace",
  "<!--", "-->",
];

// ── Generic/vague terms that indicate low specificity ──
const GENERIC_TERMS: readonly string[] = [
  "boas práticas", "best practices", "padrões", "patterns",
  "robusto", "robust", "escalável", "scalable",
  "qualidade", "quality", "clean code", "código limpo",
  "bem documentado", "well documented", "manutenível", "maintainable",
  "produção", "production-ready", "state-of-the-art",
  "implementar", "implement", "codificar", "code the",
  "fazer", "criar", "create", "build the feature",
  "seguindo as melhores práticas", "following best practices",
];

// ── Template instruction marker patterns for boilerplate detection ──
const TEMPLATE_INSTRUCTION_PATTERNS = [
  /\[Preencha[\s\S]*?\](?:\([\s\S]*?\))?/gi,
  /\[Adicione[\s\S]*?\](?:\([\s\S]*?\))?/gi,
  /\[Descreva[\s\S]*?\](?:\([\s\S]*?\))?/gi,
  /\[Replace[\s\S]*?\](?:\([\s\S]*?\))?/gi,
  /\[Fill[\s\S]*?\](?:\([\s\S]*?\))?/gi,
];

// ── Scoring threshold constants ──
const CONTENT_DENSITY_REQUIRED = 0.40; // 40%
const SECTION_COMPLETION_REQUIRED = 0.60; // 60%
const MIN_SECTION_CHARS = 30;
const PLACEHOLDER_PASS_THRESHOLD = 75; // placeholder detection passes only if score >= 75
const PLACEHOLDER_PENALTY_PER_TERM = 12; // penalty per unique placeholder term found
const SPECIFICITY_PATTERNS = [
  // File paths
  /src\/[\w./-]+\.[a-z]+/gi,
  // Numbers
  /\b\d{2,}(%|ms|s|min|px|em|rem|gb|mb)\b/gi,
  // URLs/commands
  /`npx\s+\S+`/g,
  /`curl\s+\S+`/g,
  // Specific class/interface names
  /[A-Z][a-zA-Z]+(Service|Repository|Controller|Adapter|Factory|UseCase|Entity|Model|Gateway|Handler|Provider|Middleware|Plugin|Helper|Util)/g,
  // Specific routes
  /\/api\/[\w/-]+/g,
  // Env vars
  /[A-Z][A-Z_]+(?:_[A-Z]+)+/g,
  // Version numbers
  /\b\d+\.\d+\.\d+\b/g,
  // Numeric constraints
  /\b(maior|menor|acima|abaixo|>=?|<=?)\s*\d+/gi,
];

// ── Public Interfaces ──

export interface SanityScoreMetrics {
  contentDensity: MetricResult;
  sectionCompletion: MetricResult;
  specificityScore: MetricResult;
  placeholderDetection: MetricResult;
}

export interface MetricResult {
  score: number; // 0-100
  weight: number; // percentage weight
  passed: boolean;
  details: string[];
}

export interface SanityScoreResult {
  /** Weighted total score 0-100 */
  totalScore: number;
  /** Color coding */
  color: "green" | "yellow" | "red";
  /** Individual metric results */
  metrics: SanityScoreMetrics;
  /** Whether the artifact passes minimum quality */
  passed: boolean;
  /** Overall blocking threshold */
  blockingThreshold: number;
  /** Feature-level failures (all artifact failures aggregated) */
  failures: string[];
}

export interface ArtifactSanityScore {
  artifact: string;
  score: number;
  color: "green" | "yellow" | "red";
  passed: boolean;
  metrics: SanityScoreMetrics;
}

// ── Main Entry Point ──

/**
 * Compute sanity score for a single artifact (requirements.md, roadmap.md, etc.).
 * Returns a 0-100 weighted score with color coding and per-metric breakdown.
 */
export function computeSanityScore(
  content: string,
  options?: {
    minContentDensity?: number;
    minSectionCompletion?: number;
    blockingThreshold?: number;
    customPlaceholderTerms?: string[];
    weights?: {
      contentDensity: number;
      sectionCompletion: number;
      specificityScore: number;
      placeholderDetection: number;
    };
  },
): SanityScoreResult {
  const minDensity = options?.minContentDensity ?? CONTENT_DENSITY_REQUIRED;
  const minCompletion = options?.minSectionCompletion ?? SECTION_COMPLETION_REQUIRED;
  const blockingThreshold = options?.blockingThreshold ?? 50;
  const extraPlaceholders = options?.customPlaceholderTerms ?? [];
  const weights = options?.weights ?? {
    contentDensity: 30,
    sectionCompletion: 25,
    specificityScore: 25,
    placeholderDetection: 20,
  };

  const allPlaceholderTerms = [...DEFAULT_PLACEHOLDER_TERMS, ...extraPlaceholders.map((t) => t.toLowerCase())];

  // Empty content: all metrics fail with score 0
  if (!content || content.trim().length === 0) {
    const zeroMetric = (weight: number): MetricResult => ({
      score: 0, weight, passed: false, details: ["Content is empty"],
    });
    return {
      totalScore: 0,
      color: "red",
      passed: false,
      blockingThreshold,
      metrics: {
        contentDensity: zeroMetric(weights.contentDensity),
        sectionCompletion: zeroMetric(weights.sectionCompletion),
        specificityScore: zeroMetric(weights.specificityScore),
        placeholderDetection: zeroMetric(weights.placeholderDetection),
      },
      failures: ["Artifact is empty"],
    };
  }

  const contentDensity = computeContentDensity(content, minDensity);
  const sectionCompletion = computeSectionCompletion(content, minCompletion);
  const specificity = computeSpecificity(content);
  const placeholderDetect = computePlaceholderDetection(content, allPlaceholderTerms);

  const failures: string[] = [];
  if (!contentDensity.passed) {
    failures.push(`Content density: ${contentDensity.score.toFixed(0)}/100 (min ${(minDensity * 100).toFixed(0)}%)`);
  }
  if (!sectionCompletion.passed) {
    failures.push(`Section completion: ${sectionCompletion.score.toFixed(0)}/100 (min ${(minCompletion * 100).toFixed(0)}%)`);
  }
  if (!specificity.passed) {
    failures.push(`Specificity: ${specificity.score.toFixed(0)}/100 — lacks concrete references`);
  }
  if (!placeholderDetect.passed) {
    failures.push(`Placeholder detection: ${placeholderDetect.score.toFixed(0)}/100 — placeholders found`);
  }

  let totalScore = Math.round(
    (contentDensity.score * weights.contentDensity +
      sectionCompletion.score * weights.sectionCompletion +
      specificity.score * weights.specificityScore +
      placeholderDetect.score * weights.placeholderDetection) /
      100,
  );

  // Penalty: if any single metric is critically failing (score < 25),
  // apply a reduction to prevent one high metric from masking another
  const criticalMetrics = [contentDensity, sectionCompletion, specificity, placeholderDetect]
    .filter((m) => m.score < 25);
  if (criticalMetrics.length > 0) {
    const penalty = criticalMetrics.reduce((sum, m) => sum + (25 - m.score) * 0.3, 0);
    totalScore = Math.max(0, totalScore - Math.round(penalty));
  }

  const color: "green" | "yellow" | "red" =
    totalScore >= 80 ? "green" : totalScore >= 50 ? "yellow" : "red";

  return {
    totalScore,
    color,
    passed: totalScore >= blockingThreshold,
    blockingThreshold,
    metrics: {
      contentDensity,
      sectionCompletion,
      specificityScore: specificity,
      placeholderDetection: placeholderDetect,
    },
    failures,
  };
}

/**
 * Compute sanity scores for all artifacts in a feature and return
 * an aggregated summary.
 */
export function computeFeatureSanityScores(
  artifacts: Record<string, string | null>,
  options?: {
    minContentDensity?: number;
    minSectionCompletion?: number;
    blockingThreshold?: number;
    customPlaceholderTerms?: string[];
    weights?: {
      contentDensity: number;
      sectionCompletion: number;
      specificityScore: number;
      placeholderDetection: number;
    };
  },
): {
  artifacts: Record<string, ArtifactSanityScore>;
  overallScore: number;
  overallColor: "green" | "yellow" | "red";
  overallPassed: boolean;
  failures: string[];
} {
  const artifactResults: Record<string, ArtifactSanityScore> = {};
  const allFailures: string[] = [];
  let totalWeightedScore = 0;
  let validArtifactCount = 0;

  for (const [name, content] of Object.entries(artifacts)) {
    if (!content || content.trim().length === 0) {
      artifactResults[name] = {
        artifact: name,
        score: 0,
        color: "red",
        passed: false,
        metrics: {
          contentDensity: { score: 0, weight: 30, passed: false, details: ["Artifact is empty or missing"] },
          sectionCompletion: { score: 0, weight: 25, passed: false, details: ["Artifact is empty or missing"] },
          specificityScore: { score: 0, weight: 25, passed: false, details: ["Artifact is empty or missing"] },
          placeholderDetection: { score: 0, weight: 20, passed: false, details: ["Artifact is empty or missing"] },
        },
      };
      allFailures.push(`${name}: artifact is empty or missing`);
      continue;
    }

    const result = computeSanityScore(content, options);
    artifactResults[name] = {
      artifact: name,
      score: result.totalScore,
      color: result.color,
      passed: result.passed,
      metrics: result.metrics,
    };
    totalWeightedScore += result.totalScore;
    validArtifactCount++;
    allFailures.push(...result.failures.map((f) => `${name}: ${f}`));
  }

  const overallScore = validArtifactCount > 0
    ? Math.round(totalWeightedScore / validArtifactCount)
    : 0;
  const overallColor: "green" | "yellow" | "red" =
    overallScore >= 80 ? "green" : overallScore >= 50 ? "yellow" : "red";
  const overallPassed = overallScore >= (options?.blockingThreshold ?? 50);

  return {
    artifacts: artifactResults,
    overallScore,
    overallColor,
    overallPassed,
    failures: allFailures,
  };
}

/**
 * Render sanity score summary as a color-coded terminal string.
 */
export function renderSanityScoreSummary(
  result: SanityScoreResult | { artifacts: Record<string, ArtifactSanityScore>; overallScore: number; overallColor: string; overallPassed: boolean; failures: string[] },
  artifactName?: string,
): string {
  const lines: string[] = [];

  if ("totalScore" in result) {
    // Single artifact result
    lines.push(formatScoreLine(artifactName ?? "Artifact", result.totalScore, result.color));
    lines.push(formatMetricLine("  Content density", result.metrics.contentDensity));
    lines.push(formatMetricLine("  Section completion", result.metrics.sectionCompletion));
    lines.push(formatMetricLine("  Specificity", result.metrics.specificityScore));
    lines.push(formatMetricLine("  Placeholder detection", result.metrics.placeholderDetection));
    if (result.failures.length > 0) {
      lines.push(`  Failures:`);
      for (const f of result.failures) {
        lines.push(`    - ${f}`);
      }
    }
  } else {
    // Multi-artifact feature result
    for (const [name, ar] of Object.entries(result.artifacts)) {
      lines.push(formatScoreLine(name, ar.score, ar.color));
    }
    lines.push("");
    lines.push(formatScoreLine("OVERALL", result.overallScore, result.overallColor as "green" | "yellow" | "red"));
    if (result.failures.length > 0) {
      lines.push(`  Failures (${result.failures.length}):`);
      for (const f of result.failures.slice(0, 10)) {
        lines.push(`    - ${f}`);
      }
      if (result.failures.length > 10) {
        lines.push(`    ... and ${result.failures.length - 10} more`);
      }
    }
  }

  return lines.join("\n");
}

function formatScoreLine(label: string, score: number, color: string): string {
  const colored = color === "green" ? `\x1b[32m${score}\x1b[0m`
    : color === "yellow" ? `\x1b[33m${score}\x1b[0m`
    : `\x1b[31m${score}\x1b[0m`;
  return `${label}: ${colored}/100 [${color.toUpperCase()}]`;
}

function formatMetricLine(label: string, metric: MetricResult): string {
  const icon = metric.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  return `  ${icon} ${label}: ${metric.score}/100`;
}

// ── Metric Implementations ──

/**
 * Metric 1: Content Density (weight 30%)
 * Ratio of user-written content vs template boilerplate.
 * Strips HTML comments, template instructions, and measures substantive text.
 */
function computeContentDensity(content: string, minDensity: number): MetricResult {
  const details: string[] = [];

  // Remove HTML comments (template instructions)
  const strippedComments = content.replace(/<!--[\s\S]*?-->/g, "");

  // Remove template instruction markers using constant patterns
  let strippedInstructions = strippedComments;
  for (const pattern of TEMPLATE_INSTRUCTION_PATTERNS) {
    strippedInstructions = strippedInstructions.replace(pattern, "");
  }

  // Remove template comment markers (> **Title:** format)
  const strippedMarkers = strippedInstructions.replace(/>\s*\*\*.+?\*\*:.*$/gm, "");

  // Remove markdown headings (template structure, not content)
  const strippedHeadings = strippedMarkers.replace(/^#{1,6}\s+.*$/gm, "");

  // Remove lines that are exclusively placeholder content
  const strippedPlaceholders = strippedHeadings
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep empty lines
      // Detect lines that are ONLY placeholder terms
      const placeholderOnly = /^(TODO[:\s]*.*|TBD[:\s]*.*|N\/A[.\s]*|n\/a[.\s]*|placeholder[.\s]*|lorem ipsum.*|a definir[.\s]*|pendente[.\s]*)$/i;
      return !placeholderOnly.test(trimmed);
    })
    .join("\n");

  // Count total non-whitespace chars in original
  const totalChars = content.replace(/\s/g, "").length;
  const substantiveChars = strippedPlaceholders.replace(/\s/g, "").length;

  if (totalChars === 0) {
    return { score: 0, weight: 30, passed: false, details: ["Artifact is empty"] };
  }

  const density = substantiveChars / totalChars;
  const densityPercent = Math.round(density * 100);
  const score = Math.min(100, Math.round((density / minDensity) * 100));
  const passed = density >= minDensity;

  details.push(`${densityPercent}% substantive content (min ${Math.round(minDensity * 100)}%)`);

  if (totalChars - substantiveChars > 0) {
    details.push(`Removed ${totalChars - substantiveChars} boilerplate chars`);
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    weight: 30,
    passed,
    details,
  };
}

/**
 * Metric 2: Section Completion (weight 25%)
 * Percentage of sections with >30 chars of non-placeholder text.
 */
function computeSectionCompletion(content: string, minCompletion: number): MetricResult {
  const details: string[] = [];
  const sections = extractSections(content);

  if (sections.length === 0) {
    return { score: 0, weight: 25, passed: false, details: ["No markdown sections found"] };
  }

  let completedSections = 0;
  for (const section of sections) {
    // Strip comments and instruction markers before measuring
    const clean = section.content
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\[Preencha[\s\S]*?\]/gi, "")
      .replace(/\[Adicione[\s\S]*?\]/gi, "")
      .replace(/\[Descreva[\s\S]*?\]/gi, "")
      .trim();

    if (clean.length > MIN_SECTION_CHARS) {
      completedSections++;
    } else {
      details.push(`Section "${section.heading}" has only ${clean.length} chars (min ${MIN_SECTION_CHARS})`);
    }
  }

  const completionRatio = sections.length > 0 ? completedSections / sections.length : 0;
  const score = Math.min(100, Math.round((completionRatio / minCompletion) * 100));
  const passed = completionRatio >= minCompletion;

  details.push(`${completedSections}/${sections.length} sections completed (${Math.round(completionRatio * 100)}%)`);

  return {
    score: Math.min(100, Math.max(0, score)),
    weight: 25,
    passed,
    details,
  };
}

/**
 * Metric 3: Specificity Score (weight 25%)
 * Presence of concrete names, values, file paths, numbers.
 * Higher score for more specific references.
 */
function computeSpecificity(content: string): MetricResult {
  const details: string[] = [];
  let totalMatches = 0;

  for (const pattern of SPECIFICITY_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      totalMatches += matches.length;
    }
  }

  // Penalize generic terms
  let genericCount = 0;
  const lowerContent = content.toLowerCase();
  for (const term of GENERIC_TERMS) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = lowerContent.match(regex);
    if (matches) {
      genericCount += matches.length;
    }
  }

  // Score: start at 100, subtract for generic terms, add for specific references
  // Each specific match adds, each generic term subtracts
  let rawScore = 50; // Base score
  rawScore += totalMatches * 5; // +5 per specific reference
  rawScore -= genericCount * 8; // -8 per generic term
  const score = Math.min(100, Math.max(0, rawScore));
  const passed = score >= 50;

  if (totalMatches > 0) {
    details.push(`${totalMatches} specific references found (paths, numbers, commands, class names)`);
  } else {
    details.push("No specific references found (file paths, numbers, commands, class names)");
  }

  if (genericCount > 0) {
    details.push(`${genericCount} generic/vague terms detected`);
  }

  return { score, weight: 25, passed, details };
}

/**
 * Metric 4: Placeholder Detection (weight 20%)
 * Flags known placeholder terms. Score = 100 - (penalty per unique term found).
 */
function computePlaceholderDetection(content: string, placeholderTerms: readonly string[]): MetricResult {
  const details: string[] = [];
  const lowerContent = content.toLowerCase();
  const foundTerms = new Set<string>();

  for (const term of placeholderTerms) {
    // Skip HTML comment markers that are structural
    if (term === "<!--" || term === "-->") continue;
    if (lowerContent.includes(term)) {
      foundTerms.add(term);
    }
  }

  // Also check for short placeholder-like patterns
  // e.g., sections with only template markers
  const sections = extractSections(content);
  let emptyTemplateSections = 0;
  for (const section of sections) {
    const clean = section.content
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s*\*\*.+?\*\*:/g, "")
      .trim();
    if (clean.length < 10) {
      emptyTemplateSections++;
    }
  }

  const totalPenalty = foundTerms.size * PLACEHOLDER_PENALTY_PER_TERM + emptyTemplateSections * 5;
  const score = Math.max(0, 100 - totalPenalty);
  const passed = score >= PLACEHOLDER_PASS_THRESHOLD;

  if (foundTerms.size > 0) {
    details.push(`Found ${foundTerms.size} placeholder term(s): ${[...foundTerms].join(", ")}`);
  } else {
    details.push("No placeholder terms detected");
  }

  if (emptyTemplateSections > 0) {
    details.push(`${emptyTemplateSections} section(s) appear mostly empty (template residue only)`);
  }

  return { score, weight: 20, passed, details };
}

// ── Helpers ──

interface ExtractedSection {
  heading: string;
  content: string;
}

function extractSections(md: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const lines = md.split("\n");
  let currentHeading: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
      }
      currentHeading = headingMatch[1]?.trim() ?? null;
      currentContent = [];
    } else if (currentHeading) {
      currentContent.push(line);
    }
  }

  // Push last section
  if (currentHeading) {
    sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
  }

  return sections;
}
