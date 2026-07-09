export interface ValidationResult {
  valid: boolean;
  missingSections: string[];
  emptySections: string[];
  doubts: number;
  errors: string[];
}

export type TemplateVariant = "brownfield" | "greenfield";

// ── Brownfield (15 sections — full, includes legacy/delta) ──
const REQUIREMENTS_BROWNFIELD_SECTIONS = [
  "Descrição Funcional",
  "Comportamento Esperado",
  "Invariantes de Domínio",
  "Entradas",
  "Saídas",
  "Regras de Negócio",
  "Dados Persistidos",
  "Integrações Externas",
  "Critérios de Aceitação",
  "Casos de Erro",
  "Casos Extremos",
  "Restrições Técnicas",
  "Escopo Negativo",
  "Requisitos Não-Funcionais",
  "Riscos de Manutenção",
];

// ── Greenfield (10 sections — no legacy/delta, simplified scope) ──
const REQUIREMENTS_GREENFIELD_SECTIONS = [
  "Descrição Funcional",
  "Comportamento Esperado",
  "Regras de Negócio",
  "Entradas",
  "Saídas",
  "Dados Persistidos",
  "Integrações Externas",
  "Critérios de Aceitação",
  "Casos de Erro",
  "Requisitos Não-Funcionais",
];

// ── Brownfield (13 sections — full architecture with legacy impact) ──
const ROADMAP_BROWNFIELD_SECTIONS = [
  "Desenho Arquitetural",
  "Camadas Envolvidas",
  "Classes",
  "Padrões de Projeto Adotados",
  "Padrões Rejeitados",
  "Interfaces Necessárias",
  "Repositories",
  "Adapters",
  "Serviços de Domínio",
  "Riscos de Acoplamento",
  "Impacto em Código Legado",
  "Estratégia de Rollback",
  "Verificação de Constitution",
];

// ── Greenfield (5 sections — simplified, no legacy) ──
const ROADMAP_GREENFIELD_SECTIONS = [
  "Descrição Técnica",
  "Decisões Técnicas",
  "Estrutura de Arquivos",
  "Dependências Externas",
  "Riscos",
];

// ── Backward-compatible aliases ──
// const REQUIREMENTS_SECTIONS = REQUIREMENTS_BROWNFIELD_SECTIONS; // preserved in git history
// const ROADMAP_SECTIONS = ROADMAP_BROWNFIELD_SECTIONS; // preserved in git history
const TEST_PLAN_SECTIONS = [
  "Test Strategy",
  "Unit Tests",
  "Integration Tests",
  "Edge Cases",
  "Error Scenarios",
  "Regression Coverage",
  "Verification Commands",
  "Coverage Targets",
];

export function validateRequirements(md: string): ValidationResult {
  return validateSections(md, REQUIREMENTS_BROWNFIELD_SECTIONS);
}

export function validateRequirementsVariant(md: string, variant: TemplateVariant): ValidationResult {
  const sections = variant === "greenfield" ? REQUIREMENTS_GREENFIELD_SECTIONS : REQUIREMENTS_BROWNFIELD_SECTIONS;
  return validateSections(md, sections);
}

export function validateRoadmap(md: string): ValidationResult {
  return validateSections(md, ROADMAP_BROWNFIELD_SECTIONS);
}

export function validateRoadmapVariant(md: string, variant: TemplateVariant): ValidationResult {
  const sections = variant === "greenfield" ? ROADMAP_GREENFIELD_SECTIONS : ROADMAP_BROWNFIELD_SECTIONS;
  return validateSections(md, sections);
}

export function validateTestPlan(md: string): ValidationResult {
  return validateSections(md, TEST_PLAN_SECTIONS);
}

export function validateActions(md: string): ValidationResult {
  const errors: string[] = [];

  // Check for action entries
  const actionPattern = /###\s+T\d{3}\s*[-–—]/g;
  const actions = md.match(actionPattern);

  if (!actions || actions.length === 0) {
    errors.push("No actions defined. Actions must use T001, T002, ... format.");
    return {
      valid: false,
      missingSections: [],
      emptySections: [],
      doubts: 0,
      errors,
    };
  }

  // Check each action has required fields
  const requiredFields = [
    "Alvo exato",
    "Camada",
    "Contrato esperado",
    "Teste associado",
    "Comando de verificação",
    "Evidência esperada",
    "Risco",
    "Dependências",
    "Status",
  ];

  const actionBlocks = md.split(/###\s+T\d{3}/g).slice(1);
  for (let i = 0; i < actionBlocks.length; i++) {
    const block = actionBlocks[i];
    if (!block) continue;
    for (const field of requiredFields) {
      if (!block.includes(field)) {
        errors.push(
          `T${String(i + 1).padStart(3, "0")}: Missing required field "${field}"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    missingSections: [],
    emptySections: [],
    doubts: 0,
    errors,
  };
}

function validateSections(
  md: string,
  requiredSections: string[]
): ValidationResult {
  const missingSections: string[] = [];
  const emptySections: string[] = [];
  const errors: string[] = [];

  let doubts = 0;
  const doubtPattern = /\[DOUBT\]/gi;
  const doubtMatches = md.match(doubtPattern);
  if (doubtMatches) {
    doubts = doubtMatches.length;
  }

  for (const section of requiredSections) {
    // Match markdown headings: ## Section Name or ### Section Name
    const headingRegex = new RegExp(
      `#{2,3}\\s+${escapeRegex(section)}[\\s\\n]`,
      "i"
    );
    const match = md.match(headingRegex);

    if (!match || match.index === undefined) {
      missingSections.push(section);
      continue;
    }

    // Check if section has content (not just the heading)
    const afterHeading = md.slice(match.index + match[0].length);
    const nextHeading = afterHeading.match(/^#{2,3}\s/m);
    const sectionContent = nextHeading
      ? afterHeading.slice(0, nextHeading.index).trim()
      : afterHeading.trim();

    const isEmpty =
      sectionContent.length === 0 ||
      sectionContent === "<!--" ||
      /^<!--.*-->$/.test(sectionContent) ||
      /^\s*-\s*$/.test(sectionContent) ||
      sectionContent === "-" ||
      sectionContent === "- <!--" ||
      /^<!--\s*-->$/m.test(sectionContent) ||
      // Multi-line HTML-comment-only content (pedagogical + placeholder comments)
      /^\s*(<!--[\s\S]*?-->\s*)+$/.test(sectionContent);

    if (isEmpty) {
      emptySections.push(section);
    }
  }

  // Check scope-related alternates (English headings)
  const negativeScopeRegex =
    /#{2,3}\s+(?:Escopo Negativo|Out of Scope|Negative Scope)/i;
  if (
    !md.match(negativeScopeRegex) &&
    missingSections.includes("Escopo Negativo")
  ) {
    // Also check for "Out of Scope" which is the English equivalent
    if (!md.match(/#{2,3}\s+Out of Scope/i)) {
      errors.push(
        "Missing 'Escopo Negativo' (Negative Scope) section — must explicitly state what is NOT included."
      );
    }
  }

  return {
    valid:
      missingSections.length === 0 &&
      emptySections.length === 0 &&
      (doubts === 0 || errors.length === 0),
    missingSections,
    emptySections,
    doubts,
    errors,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
