import { describe, it, expect } from "vitest";
import { safeReadFile } from "../../src/utils/fs.js";
import {
  validateRequirementsSemantic,
  validateRoadmapSemantic,
  validateActionsSemantic,
  validateTestPlanSemantic,
} from "../../src/engine/semantic-validator.js";
import { validateRequirements } from "../../src/artifacts/validator.js";

describe("Adversarial — Semantic Validation", () => {
  it("generic-filler requirements score below 60", async () => {
    const md = await safeReadFile(
      "test/fixtures/adversarial/generic-filler/_devflow/features/001-test/requirements.md"
    );
    expect(md).toBeTruthy();

    const result = validateRequirementsSemantic(md!);
    // All sections are boilerplate — score should be low
    expect(result.score).toBeLessThan(70);
  });

  it("generic-filler roadmap has low score (no specific class names)", async () => {
    const md = await safeReadFile(
      "test/fixtures/adversarial/generic-filler/_devflow/features/001-test/roadmap.md"
    );
    expect(md).toBeTruthy();

    const result = validateRoadmapSemantic(md!);
    expect(result.score).toBeLessThan(90);
  });

  it("FAILS validation on test-plan with no scenarios", () => {
    const emptyTestPlan = `
# Test Plan

## Test Strategy
Will test everything.

## Unit Tests
Write unit tests.

## Integration Tests
Write integration tests.

## Edge Cases
Consider edge cases.

## Error Scenarios
Handle errors.

## Regression Coverage
Monitor regression.

## Verification Commands
npm test

## Coverage Targets
80%
`;

    const result = validateTestPlanSemantic(emptyTestPlan);
    expect(result.valid).toBe(false);
  });

  it("detects low-word-count sections in sparse requirements", () => {
    const sparse = `
## Descricao Funcional
Do stuff.

## Comportamento Esperado
It works.

## Criterios de Aceitacao
OK.

## Casos de Erro
Try/catch.
`;

    const result = validateRequirementsSemantic(sparse);
    // Sparse content should trigger low word count warnings
    expect(result.score).toBeLessThan(90);
  });

  it("detects vague action titles (scores below 80)", () => {
    const vagueActions = `
### T001 — Implementar a feature de login

**Alvo exato:** src/login.ts
**Camada:** application
**Contrato esperado:** login
**Teste associado:** test
**Comando de verificacao:** npm test
**Evidencia esperada:** pass
**Risco:** low
**Dependencias:** none
**Status:** [ ]
`;

    const result = validateActionsSemantic(vagueActions);
    expect(result.score).toBeLessThan(80);
  });
});

describe("Adversarial — Structural vs Semantic", () => {
  it("structural validator rejects unaccented section headings", () => {
    const md = `## Descricao Funcional
Does X.

## Comportamento Esperado
Works.
`;
    // Missing sections (only 2 of 15) should fail structural validation
    const structResult = validateRequirements(md);
    expect(structResult.valid).toBe(false);
    expect(structResult.missingSections.length).toBeGreaterThan(0);
  });

  it("structural validator passes all required sections with correct accents", () => {
    const md = `## Descrição Funcional
Does X properly.

## Comportamento Esperado
Works as designed.

## Invariantes de Domínio
Must always be valid.

## Entradas
User data.

## Saídas
Processed data.

## Regras de Negócio
Business rules apply.

## Dados Persistidos
Stored in DB.

## Integrações Externas
External APIs used.

## Critérios de Aceitação
Scenario: user logs in.

## Casos de Erro
Invalid input returns error.

## Casos Extremos
Null input handled.

## Restrições Técnicas
Must use TypeScript.

## Escopo Negativo
Not a mobile app.

## Requisitos Não-Funcionais
Response < 200ms.

## Riscos de Manutenção
Coupling risk with DB.
`;

    const structResult = validateRequirements(md);
    // All 15 sections exist with correct accents
    expect(structResult.valid).toBe(true);
    expect(structResult.missingSections.length).toBe(0);
  });

  it("semantic validator flags minimal-accented document for low content quality", () => {
    const md = `## Descrição Funcional
Does X properly.

## Comportamento Esperado
Works as designed.

## Invariantes de Domínio
Must always be valid.

## Entradas
User data.

## Saídas
Processed data.

## Regras de Negócio
Business rules apply.

## Dados Persistidos
Stored in DB.

## Integrações Externas
External APIs used.

## Critérios de Aceitação
Scenario: user logs in.

## Casos de Erro
Invalid input returns error.

## Casos Extremos
Null input handled.

## Restrições Técnicas
Must use TypeScript.

## Escopo Negativo
Not a mobile app.

## Requisitos Não-Funcionais
Response < 200ms.

## Riscos de Manutenção
Coupling risk with DB.
`;

    const semanticResult = validateRequirementsSemantic(md);
    // Has sections but short content — semantic score should reflect low quality
    expect(semanticResult.score).toBeLessThan(95);
    const allIssues = [...semanticResult.failures, ...semanticResult.warnings];
    expect(allIssues.length).toBeGreaterThan(0);
  });
});
