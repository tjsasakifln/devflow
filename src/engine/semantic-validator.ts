export interface SemanticValidation {
  valid: boolean;
  artifact: string;
  score: number; // 0-100
  failures: SemanticFailure[];
  warnings: SemanticWarning[];
}

export interface SemanticFailure {
  section: string;
  issue: string;
  evidence: string;
}

export interface SemanticWarning {
  section: string;
  issue: string;
}

// Phrases that indicate generic/template filler content
const GENERIC_PHRASES = [
  // Portuguese boilerplate
  "usar boas práticas",
  "implementar feature",
  "implementar a feature",
  "seguir padrões",
  "fazer testes",
  "escrever testes",
  "criar testes",
  "testar feature",
  "testar a feature",
  "adicionar validação",
  "melhorar código",
  "refatorar código",
  "seguir boas práticas de código",
  "usar padrões de projeto",
  "definir arquitetura",
  "criar arquitetura",
  "implementar solução",
  "codificar solução",
  "seguindo as melhores práticas",
  "de acordo com os requisitos",
  "implementação robusta e escalável",
  "código limpo e bem documentado",
  "garantir qualidade",
  "seguir os princípios",
  "aplicar padrões",
  // English boilerplate
  "follows best practices",
  "robust and scalable",
  "leverages existing patterns",
  "follows industry standards",
  "clean and maintainable",
  "well-documented code",
  "comprehensive test coverage",
  "production-ready",
  "state-of-the-art",
  "cutting-edge",
];

const MIN_WORDS_PER_SECTION = 20;

/**
 * Validate that requirements.md has real semantic content, not just template boilerplate.
 */
export function validateRequirementsSemantic(md: string): SemanticValidation {
  const failures: SemanticFailure[] = [];
  const warnings: SemanticWarning[] = [];

  // Extract sections
  const sections = extractSections(md);

  // Check each section for substance
  let totalScore = 100;
  const requiredSections = [
    "Descricao Funcional",
    "Comportamento Esperado",
    "Criterios de Aceitacao",
    "Casos de Erro",
  ];

  for (const sectionName of requiredSections) {
    const section = sections.find((s) =>
      s.heading.toLowerCase().includes(sectionName.toLowerCase().replace(/\s+/g, ""))
    );
    if (!section) continue;

    // Check minimum word count (excluding template comments)
    const cleanContent = stripComments(section.content);
    const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;

    if (wordCount < MIN_WORDS_PER_SECTION) {
      totalScore -= 15;
      failures.push({
        section: section.heading,
        issue: `Section has only ${wordCount} substantive words (minimum: ${MIN_WORDS_PER_SECTION})`,
        evidence: cleanContent.slice(0, 200),
      });
    }

    // Check for generic phrases
    for (const phrase of GENERIC_PHRASES) {
      if (cleanContent.toLowerCase().includes(phrase.toLowerCase())) {
        totalScore -= 10;
        failures.push({
          section: section.heading,
          issue: `Generic placeholder phrase detected: "${phrase}"`,
          evidence: cleanContent.slice(
            Math.max(0, cleanContent.toLowerCase().indexOf(phrase.toLowerCase()) - 20),
            cleanContent.toLowerCase().indexOf(phrase.toLowerCase()) + phrase.length + 20
          ),
        });
      }
    }
  }

  // Check for Gherkin scenarios
  const gherkinCount = (md.match(/Scenario:/g) || []).length;
  if (gherkinCount < 3) {
    totalScore -= 20;
    warnings.push({
      section: "Criterios de Aceitacao",
      issue: `Only ${gherkinCount} Gherkin scenarios found (minimum: 3, including error cases)`,
    });
  }

  // Check for concrete acceptance criteria (numbers, percentages, file paths)
  const hasConcreteCriteria =
    /\d+%/.test(md) ||
    /\d+\s*(ms|seconds|minutes)/.test(md) ||
    /`npx\s/.test(md) ||
    /`curl\s/.test(md) ||
    /src\//.test(md);

  if (!hasConcreteCriteria) {
    totalScore -= 10;
    warnings.push({
      section: "Criterios de Aceitacao",
      issue: "No concrete measurable criteria found (percentages, commands, file paths)",
    });
  }

  // Check for domain invariants with property names
  const invariantMatch = md.match(/Invariantes de Dom[íi]nio\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (invariantMatch && invariantMatch[1]) {
    const invariantContent = invariantMatch[1].trim();
    const hasConcreteInvariants =
      /[A-Z][a-z]+\.[a-z]+/.test(invariantContent) || // Object.property pattern
      /\bdeve(m|rá)\s/.test(invariantContent) ||       // "deve" / "deverá" constraints
      /\bnão\s+pode(m|rá)\s/.test(invariantContent);   // "não pode" / "não poderá" constraints

    if (!hasConcreteInvariants && invariantContent.length > 0) {
      totalScore -= 5;
      warnings.push({
        section: "Invariantes de Dominio",
        issue: "Domain invariants lack concrete property names or formal constraints",
      });
    }
  }

  const score = Math.max(0, totalScore);

  return {
    valid: failures.length === 0 && score >= 40,
    artifact: "requirements",
    score,
    failures,
    warnings,
  };
}

/**
 * Validate that roadmap.md has real architectural decisions, not generic guidance.
 */
export function validateRoadmapSemantic(md: string): SemanticValidation {
  const failures: SemanticFailure[] = [];
  const warnings: SemanticWarning[] = [];
  let totalScore = 100;

  // Check for specific class/interface names
  const hasClassNames = /[A-Z][a-zA-Z]+(Service|Repository|Controller|Adapter|Factory|UseCase|Entity|Model|Gateway|Handler|Provider)/.test(md);
  if (!hasClassNames) {
    totalScore -= 15;
    warnings.push({
      section: "Desenho Arquitetural",
      issue: "No specific class or interface names found — roadmap may be too generic",
    });
  }

  // Check for rejected patterns with rationale
  const hasRejectedPatterns = /Padr[õo]es Rejeitados/i;
  const rejectedSection = md.match(/Padr[õo]es Rejeitados\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (rejectedSection && rejectedSection[1]) {
    const content = rejectedSection[1].trim();
    if (content.length < 50) {
      totalScore -= 10;
      failures.push({
        section: "Padroes Rejeitados",
        issue: "Rejected patterns section lacks rationale — each rejection needs a reason",
        evidence: content.slice(0, 200),
      });
    }
  } else if (hasRejectedPatterns) {
    totalScore -= 5;
    warnings.push({
      section: "Padroes Rejeitados",
      issue: "Rejected patterns section is empty — should list evaluated alternatives",
    });
  }

  // Check for concrete layer references
  const hasLayerReferences =
    /\b(domain|infrastructure|application|presentation|api|controller|service|repository|adapter)\b.*\b(src\/|lib\/|app\/)/.test(md);
  if (!hasLayerReferences) {
    totalScore -= 10;
    warnings.push({
      section: "Camadas Envolvidas",
      issue: "No concrete layer-to-path mapping found",
    });
  }

  // Check for rollback strategy with steps
  const rollbackMatch = md.match(/Estrat[ée]gia de Rollback\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (rollbackMatch && rollbackMatch[1]) {
    const content = rollbackMatch[1].trim();
    if (content.length < 30) {
      totalScore -= 10;
      warnings.push({
        section: "Estrategia de Rollback",
        issue: "Rollback strategy too vague — need concrete steps or commands",
      });
    }
  }

  const score = Math.max(0, totalScore);

  return {
    valid: failures.length === 0 && score >= 40,
    artifact: "roadmap",
    score,
    failures,
    warnings,
  };
}

/**
 * Validate that actions.md has specific, verifiable tasks.
 */
export function validateActionsSemantic(md: string): SemanticValidation {
  const failures: SemanticFailure[] = [];
  const warnings: SemanticWarning[] = [];
  let totalScore = 100;

  // Extract T001 entries
  const actionBlocks = md.match(/###\s+T\d+\s*[-–]\s*.+?(?=\n###|\n##|\n*$)/gs) || [];

  if (actionBlocks.length === 0) {
    return {
      valid: false,
      artifact: "actions",
      score: 0,
      failures: [{ section: "actions.md", issue: "No T001-format action blocks found", evidence: md.slice(0, 300) }],
      warnings: [],
    };
  }

  let vagueActions = 0;
  let actionsWithoutFile = 0;
  let actionsWithoutVerification = 0;

  for (const block of actionBlocks) {
    const titleMatch = block.match(/###\s+(T\d+)\s*[-–]\s*(.+)/);
    const title = titleMatch?.[2]?.trim() || "";

    // Check for vague action titles
    const vaguePatterns = [
      /^implementar\s+(a\s+)?feature/i,
      /^codificar\s+(a\s+)?feature/i,
      /^fazer\s+(o\s+)?feature/i,
      /^criar\s+(o\s+)?sistema/i,
      /^desenvolver\s+(o\s+)?módulo/i,
    ];

    if (vaguePatterns.some((p) => p.test(title))) {
      vagueActions++;
      warnings.push({
        section: title,
        issue: "Action title is vague — specify exact file, class, or function to create/modify",
      });
    }

    // Check for file path references
    if (!/[a-zA-Z0-9_/]+\.[a-z]{2,4}/.test(block)) {
      actionsWithoutFile++;
    }

    // Check for verification command
    if (
      !/Comando de verificac[ãa]o/i.test(block) ||
      !/`[a-z]+\s/.test(block.match(/Comando de verificac[ãa]o[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n###|$)/i)?.[1] || "")
    ) {
      actionsWithoutVerification++;
    }
  }

  if (vagueActions > 0) {
    totalScore -= vagueActions * 10;
    failures.push({
      section: "actions.md",
      issue: `${vagueActions} action(s) have vague titles — use specific file/class names`,
      evidence: `Total actions: ${actionBlocks.length}, vague: ${vagueActions}`,
    });
  }

  if (actionsWithoutFile > actionBlocks.length * 0.3) {
    totalScore -= 10;
    warnings.push({
      section: "actions.md",
      issue: `${actionsWithoutFile}/${actionBlocks.length} actions lack concrete file path references`,
    });
  }

  if (actionsWithoutVerification > 0) {
    totalScore -= actionsWithoutVerification * 10;
    warnings.push({
      section: "actions.md",
      issue: `${actionsWithoutVerification} action(s) lack explicit verification commands`,
    });
  }

  const score = Math.max(0, totalScore);

  return {
    valid: failures.length === 0 && score >= 40,
    artifact: "actions",
    score,
    failures,
    warnings,
  };
}

/**
 * Validate that test-plan.md has concrete test cases, not generic placeholders.
 */
export function validateTestPlanSemantic(md: string): SemanticValidation {
  const failures: SemanticFailure[] = [];
  const warnings: SemanticWarning[] = [];
  let totalScore = 100;

  // Check for concrete test case names
  const testCasePattern = /(?:Test:|Cen[áa]rio:|-\s+\*\*Teste\s+\d)/gi;
  const testCases = md.match(testCasePattern) || [];

  if (testCases.length < 5) {
    totalScore -= 20;
    failures.push({
      section: "Test Plan",
      issue: `Only ${testCases.length} concrete test cases found (minimum: 5)`,
      evidence: md.slice(0, 300),
    });
  }

  // Check for edge cases with specific inputs
  const edgeCasesMatch = md.match(/(?:Edge Cases|Casos Extremos|Casos de Borda)\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (edgeCasesMatch && edgeCasesMatch[1]) {
    const content = edgeCasesMatch[1].trim();
    const hasSpecificInputs =
      /\d+/.test(content) || // numeric values
      /\bnull\b/.test(content) || // null handling
      /\bundefined\b/.test(content) || // undefined handling
      /\bempty\b|\bvazio\b/.test(content); // empty state

    if (!hasSpecificInputs) {
      totalScore -= 10;
      warnings.push({
        section: "Edge Cases",
        issue: "Edge cases lack specific input values (numbers, null, empty, boundary)",
      });
    }
  } else {
    totalScore -= 15;
    failures.push({
      section: "Edge Cases",
      issue: "No edge cases section found with concrete scenarios",
      evidence: "Section 'Edge Cases' or 'Casos Extremos' missing or empty",
    });
  }

  // Check for error scenarios
  const errorMatch = md.match(/(?:Error Scenarios|Cen[áa]rios de Erro)\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!errorMatch || !errorMatch[1] || errorMatch[1].trim().length < 20) {
    totalScore -= 15;
    warnings.push({
      section: "Error Scenarios",
      issue: "Error scenarios missing or too brief — every feature has failure modes",
    });
  }

  // Check for coverage targets with numbers
  if (!/\d{2,3}%/.test(md)) {
    totalScore -= 5;
    warnings.push({
      section: "Coverage Targets",
      issue: "No numeric coverage targets specified (e.g., 80%)",
    });
  }

  const score = Math.max(0, totalScore);

  return {
    valid: failures.length === 0 && score >= 40,
    artifact: "test-plan",
    score,
    failures,
    warnings,
  };
}

// ── Helpers ──

interface ExtractedSection {
  heading: string;
  content: string;
}

function extractSections(md: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const pattern = /^##\s+(.+)$\n([\s\S]*?)(?=^##\s|\n*$)/gm;
  let match;
  while ((match = pattern.exec(md)) !== null) {
    if (match[1] && match[2]) {
      sections.push({ heading: match[1].trim(), content: match[2].trim() });
    }
  }
  return sections;
}

function stripComments(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s*\*\*.+?\*\*:/g, "") // Remove template comment markers
    .replace(/\[Preencha[\s\S]*?\]/g, "") // Remove Brazilian template placeholders
    .trim();
}
