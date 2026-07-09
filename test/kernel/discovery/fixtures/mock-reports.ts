export interface MockScoutReport {
  directoryTree: string;
  languages: Record<string, number>;
  frameworks: Array<{ name: string; evidence: string; confidence: string }>;
  entryPoints: string[];
  conventions: string[];
  markdown: string;
}

export const TYPESCRIPT_SCOUT_REPORT: MockScoutReport = {
  directoryTree: ".\n./src\n./src/index.ts\n./test\n./package.json\n./tsconfig.json",
  languages: { ts: 15, js: 2, json: 3 },
  frameworks: [
    { name: "Express", evidence: "Dependency: express@4.18.2", confidence: "medium" },
    { name: "Vitest", evidence: "Dependency: vitest@1.0.0", confidence: "medium" },
  ],
  entryPoints: ["src/index.ts", "src/cli.ts"],
  conventions: ["TypeScript with strict mode (tsconfig.json detected)", "Source in src/, tests in test/"],
  markdown: "# Scout Report --- Surface Structure Scan\n\nGenerated report for TypeScript project.",
};

export const EMPTY_SCOUT_REPORT: MockScoutReport = {
  directoryTree: ".\n",
  languages: {},
  frameworks: [],
  entryPoints: [],
  conventions: [],
  markdown: "No scout data available.",
};

export interface MockComplexityResult { file: string; score: number; description: string; }
export interface MockControlFlowSummary { conditionals: number; switches: number; tryCatch: number; loops: number; }
export interface MockDataStructureInfo { interfaces: number; types: number; classes: number; enums: number; records: Array<{ name: string; kind: string; file: string }>; }

export interface MockArchaeologistReport {
  complexFiles: MockComplexityResult[];
  controlFlow: MockControlFlowSummary;
  dataStructures: MockDataStructureInfo;
  markdown: string;
}

export const COMPLEX_ARCHAEOLOGIST_REPORT: MockArchaeologistReport = {
  complexFiles: [
    { file: "src/processor.ts", score: 35, description: "High complexity (35) - refactoring recommended" },
    { file: "src/parser.ts", score: 22, description: "Moderate-high complexity (22) - consider simplification" },
    { file: "src/utils.ts", score: 14, description: "Moderate complexity (14) - monitor" },
  ],
  controlFlow: { conditionals: 45, switches: 3, tryCatch: 12, loops: 28 },
  dataStructures: {
    interfaces: 8, types: 15, classes: 4, enums: 2,
    records: [
      { name: "User", kind: "interface", file: "src/models.ts" },
      { name: "Config", kind: "type alias", file: "src/config.ts" },
      { name: "Processor", kind: "class", file: "src/processor.ts" },
      { name: "Status", kind: "enum", file: "src/status.ts" },
    ],
  },
  markdown: "# Archaeology Report --- Code Analysis\n\nComplexity hotspots and data structures.",
};

export const EMPTY_ARCHAEOLOGIST_REPORT: MockArchaeologistReport = {
  complexFiles: [],
  controlFlow: { conditionals: 0, switches: 0, tryCatch: 0, loops: 0 },
  dataStructures: { interfaces: 0, types: 0, classes: 0, enums: 0, records: [] },
  markdown: "No archaeologist data available.",
};

export interface MockBusinessRule { pattern: string; examples: string[]; file: string; description: string; }
export interface MockADREntry { date: string; author: string; message: string; type: string; }
export interface MockStateMachine { name: string; file: string; states: string[]; }

export interface MockDetectiveReport {
  businessRules: MockBusinessRule[];
  adrs: MockADREntry[];
  stateMachines: MockStateMachine[];
  markdown: string;
}

export const COMPLEX_DETECTIVE_REPORT: MockDetectiveReport = {
  businessRules: [
    { pattern: "Validation Rules", examples: ["validateInput(data)", "schema.parse(input)"], file: "src/validation.ts", description: "Input validation logic" },
    { pattern: "Guard Clauses", examples: ["canEdit(user, doc)", "guard(isAuthenticated)"], file: "src/auth.ts", description: "Authorization and access control" },
  ],
  adrs: [
    { date: "2026-06-15", author: "dev", message: "feat: migrate from REST to GraphQL", type: "architectural-decision" },
    { date: "2026-06-10", author: "dev", message: "fix: correct timeout handling", type: "fix" },
  ],
  stateMachines: [{ name: "orderState", file: "src/order.ts", states: ["PENDING", "ACTIVE", "COMPLETED", "FAILED"] }],
  markdown: "# Detective Report --- Business Logic Analysis\n\nBusiness rules and state machines.",
};

export const EMPTY_DETECTIVE_REPORT: MockDetectiveReport = {
  businessRules: [], adrs: [], stateMachines: [],
  markdown: "No detective data available.",
};

export interface MockModuleInfo { name: string; path: string; imports: string[]; exportedItems: string[]; }
export interface MockIntegration { name: string; evidence: string; type: "external-api" | "database" | "internal-module" | "file-system" | "message-queue"; }

export interface MockArchitectReport {
  c4ContextDiagram: string;
  c4ContainerDiagram: string;
  integrations: MockIntegration[];
  modules: MockModuleInfo[];
  erd: string | null;
  hasSchema: boolean;
  markdown: string;
}

export const COMPLEX_ARCHITECT_REPORT: MockArchitectReport = {
  c4ContextDiagram: "C4Context\n  title System Context Diagram\n  System_Boundary(project, \"Project\") {\n    System(project_core, \"Core Application\")\n  }",
  c4ContainerDiagram: "C4Container\n  title Container Diagram\n  System_Boundary(app, \"Application\", \"typescript\") {\n    Container(container_1, \"src\", \"Module\", \"Contains: index, cli\")",
  integrations: [
    { name: "REST API Client", evidence: "Dependencies: axios", type: "external-api" },
    { name: "Database ORM", evidence: "Dependencies: prisma", type: "database" },
  ],
  modules: [
    { name: "index", path: "src/index.ts", imports: ["./cli", "fs", "path"], exportedItems: ["main", "run"] },
    { name: "cli", path: "src/cli.ts", imports: ["./commands", "picocolors"], exportedItems: ["execute"] },
  ],
  erd: "erDiagram\n    User {\n        string id PK\n        string name\n    }",
  hasSchema: true,
  markdown: "# Architecture Report --- Reconstruction\n\nC4 diagrams and integration map.",
};

export const EMPTY_ARCHITECT_REPORT: MockArchitectReport = {
  c4ContextDiagram: "", c4ContainerDiagram: "", integrations: [], modules: [], erd: null, hasSchema: false,
  markdown: "No architect data available.",
};
