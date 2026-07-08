import { describe, it, expect } from "vitest";
import {
  validateRequirements,
  validateRoadmap,
  validateTestPlan,
  validateActions,
} from "../../src/kernel/validators/structural.js";

const REQ_WITH_ALL_SECTIONS = `
# Requirements

## Descrição Funcional
Some description

## Comportamento Esperado
Expected behavior

## Invariantes de Domínio
Domain invariants

## Entradas
Inputs

## Saídas
Outputs

## Regras de Negócio
Business rules

## Dados Persistidos
Persisted data

## Integrações Externas
External integrations

## Critérios de Aceitação
Acceptance criteria

## Casos de Erro
Error cases

## Casos Extremos
Edge cases

## Restrições Técnicas
Technical constraints

## Escopo Negativo
Negative scope

## Requisitos Não-Funcionais
Non-functional reqs

## Riscos de Manutenção
Maintenance risks
`;

const ROADMAP_WITH_ALL_SECTIONS = `
# Roadmap

## Desenho Arquitetural
Architecture design

## Camadas Envolvidas
Layers

## Classes
Classes

## Padrões de Projeto Adotados
Adopted patterns

## Padrões Rejeitados
Rejected patterns

## Interfaces Necessárias
Needed interfaces

## Repositories
Repositories

## Adapters
Adapters

## Serviços de Domínio
Domain services

## Riscos de Acoplamento
Coupling risks

## Impacto em Código Legado
Legacy impact

## Estratégia de Rollback
Rollback strategy

## Verificação de Constitution
Constitution verification
`;

const TEST_PLAN_WITH_ALL_SECTIONS = `
# Test Plan

## Test Strategy
Strategy

## Unit Tests
Unit tests

## Integration Tests
Integration tests

## Edge Cases
Edge cases

## Error Scenarios
Error scenarios

## Regression Coverage
Regression

## Verification Commands
Commands

## Coverage Targets
Coverage
`;

describe("Structural Validator - validateRequirements", () => {
  it("returns valid for markdown with all required sections", () => {
    const result = validateRequirements(REQ_WITH_ALL_SECTIONS);
    expect(result.valid).toBe(true);
    expect(result.missingSections).toHaveLength(0);
    expect(result.emptySections).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns missing sections when markdown has none", () => {
    const result = validateRequirements("# Only title");
    expect(result.valid).toBe(false);
    expect(result.missingSections.length).toBeGreaterThan(0);
    expect(result.missingSections).toContain("Descrição Funcional");
    expect(result.missingSections).toContain("Comportamento Esperado");
  });

  it("reports empty sections that contain only comments", () => {
    const md = `
## Descrição Funcional
<!-- TODO: fill me -->

## Comportamento Esperado
-

## Invariantes de Domínio
Some content
`;
    const result = validateRequirements(md);
    expect(result.emptySections).toContain("Descrição Funcional");
    expect(result.emptySections).toContain("Comportamento Esperado");
    expect(result.emptySections).not.toContain("Invariantes de Domínio");
  });

  it("counts [DOUBT] markers", () => {
    const md = `
## Descrição Funcional
[DOUBT] Is this correct?

## Comportamento Esperado
Should work [DOUBT] another doubt

## Invariantes de Domínio
OK
`;
    const result = validateRequirements(md);
    expect(result.doubts).toBe(2);
  });

  it("handles empty string gracefully", () => {
    const result = validateRequirements("");
    expect(result.valid).toBe(false);
    expect(result.missingSections.length).toBeGreaterThan(0);
  });

  it("accepts English 'Out of Scope' as alternative for 'Escopo Negativo'", () => {
    const md = `
## Descrição Funcional
desc

## Comportamento Esperado
behavior

## Invariantes de Domínio
invariants

## Entradas
inputs

## Saídas
outputs

## Regras de Negócio
rules

## Dados Persistidos
data

## Integrações Externas
ext

## Critérios de Aceitação
criteria

## Casos de Erro
errors

## Casos Extremos
edge

## Restrições Técnicas
constraints

## Out of Scope
Not included

## Requisitos Não-Funcionais
nfr

## Riscos de Manutenção
risks
`;
    const result = validateRequirements(md);
    // "Escopo Negativo" stays in missingSections (section iteration), but no error is added
    expect(result.errors).not.toContain(expect.stringContaining("Escopo Negativo"));
    expect(result.errors).not.toContain(expect.stringContaining("Negative Scope"));
  });
});

describe("Structural Validator - validateRoadmap", () => {
  it("returns valid for markdown with all roadmap sections", () => {
    const result = validateRoadmap(ROADMAP_WITH_ALL_SECTIONS);
    expect(result.valid).toBe(true);
    expect(result.missingSections).toHaveLength(0);
  });

  it("detects missing sections", () => {
    const result = validateRoadmap("# Only title");
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain("Desenho Arquitetural");
    expect(result.missingSections).toContain("Classes");
  });

  it("accepts ### heading level for sections", () => {
    const md = `
### Desenho Arquitetural
Architecture

### Camadas Envolvidas
Layers

### Classes
Classes

### Padrões de Projeto Adotados
Patterns

### Padrões Rejeitados
Rejected

### Interfaces Necessárias
Interfaces

### Repositories
Repos

### Adapters
Adapters

### Serviços de Domínio
Services

### Riscos de Acoplamento
Coupling risks

### Impacto em Código Legado
Legacy

### Estratégia de Rollback
Rollback

### Verificação de Constitution
Verification
`;
    const result = validateRoadmap(md);
    expect(result.valid).toBe(true);
  });
});

describe("Structural Validator - validateTestPlan", () => {
  it("returns valid for markdown with all test plan sections", () => {
    const result = validateTestPlan(TEST_PLAN_WITH_ALL_SECTIONS);
    expect(result.valid).toBe(true);
    expect(result.missingSections).toHaveLength(0);
  });

  it("detects missing test strategy", () => {
    const result = validateTestPlan("# No strategy");
    expect(result.missingSections).toContain("Test Strategy");
  });
});

describe("Structural Validator - validateActions", () => {
  it("returns error when no actions defined", () => {
    const result = validateActions("# No actions here");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("No actions defined");
  });

  it("returns error when action missing required fields", () => {
    const md = `
### T001 - Some Action
Some description
`;
    const result = validateActions(md);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("T001");
    expect(result.errors[0]).toContain("Alvo exato");
  });

  it("passes for well-formed actions with all required fields", () => {
    const md = `
### T001 - Implement Feature

Alvo exato: src/feature.ts
Camada: application
Contrato esperado: contract
Teste associado: test/feature.test.ts
Comando de verificação: npm test
Evidência esperada: test pass
Risco: medium
Dependências: none
Status: pending

### T002 - Add Tests

Alvo exato: test/feature.test.ts
Camada: test
Contrato esperado: coverage
Teste associado: self
Comando de verificação: npm run test:coverage
Evidência esperada: >=80%
Risco: low
Dependências: T001
Status: pending
`;
    const result = validateActions(md);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("handles em dash (—) in action names", () => {
    const md = `
### T001 — Implement Feature

Alvo exato: src/feature.ts
Camada: application
Contrato esperado: contract
Teste associado: test.test.ts
Comando de verificação: npm test
Evidência esperada: pass
Risco: medium
Dependências: none
Status: pending
`;
    const result = validateActions(md);
    expect(result.valid).toBe(true);
  });
});
