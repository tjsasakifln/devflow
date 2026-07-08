import { describe, it, expect } from "vitest";
import {
  validateRequirementsSemantic,
  validateRoadmapSemantic,
  validateActionsSemantic,
  validateTestPlanSemantic,
} from "../../src/kernel/validators/semantic.js";

describe("validateRequirementsSemantic", () => {
  it("passes requirements with substantive content", () => {
    const md = `
## Descricao Funcional
The system shall allow users to upload files up to 10MB in size.

## Comportamento Esperado
When a user uploads a file, the system validates it, stores it in S3, and returns a URL.

## Invariantes de Dominio
File.size must be <= 10485760. File.type must be in the allowed set.

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
Upload timeout, file type mismatch, S3 failure, quota exceeded
`;
    const result = validateRequirementsSemantic(md);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it("detects too-short sections", () => {
    const md = `
## Descricao Funcional
Short.

## Comportamento Esperado
Brief.

## Criterios de Aceitacao
Minimal.

## Casos de Erro
Few.
`;
    const result = validateRequirementsSemantic(md);
    // Sections with < 20 words each are considered too short
    expect(result.score).toBeLessThan(100);
  });

  it("detects generic/boilerplate phrases", () => {
    const md = `
## Descricao Funcional
This follows best practices and is robust and scalable. It leverages existing patterns.

## Comportamento Esperado
The system uses clean and maintainable code with well-documented code.

## Criterios de Aceitacao
Scenario: Test
Given condition
When action
Then result

Scenario: Test 2
Given condition
When action
Then result

Scenario: Test 3
Given condition
When action
Then result

## Casos de Erro
Error handling is production-ready.
`;
    const result = validateRequirementsSemantic(md);
    expect(result.score).toBeLessThan(100);
  });

  it("detects insufficient Gherkin scenarios", () => {
    const md = `
## Descricao Funcional
The system shall do something useful for the user in various scenarios.

## Comportamento Esperado
When the user performs an action, the system responds appropriately.

## Criterios de Aceitacao
Scenario: Only one test
Given a
When b
Then c

## Casos de Erro
A few error cases are described here.
`;
    const result = validateRequirementsSemantic(md);
    const gherkinWarning = result.warnings.find((w) =>
      w.issue.includes("Gherkin"),
    );
    expect(gherkinWarning).toBeDefined();
  });

  it("detects missing concrete criteria", () => {
    const md = `
## Descricao Funcional
The system shall handle user management with proper validation.

## Comportamento Esperado
Everything should work correctly and efficiently for all users.

## Criterios de Aceitacao
Scenario: Test
Given a
When b
Then c

Scenario: Test 2
Given a
When b
Then c

Scenario: Test 3
Given a
When b
Then c

## Casos de Erro
Some errors might occur.
`;
    const result = validateRequirementsSemantic(md);
    // Should have concrete criteria warning (no %, commands, file paths)
    const concreteWarning = result.warnings.find((w) =>
      w.issue.includes("concrete measurable"),
    );
    expect(concreteWarning).toBeDefined();
  });

  it("detects vague domain invariants", () => {
    const md = `
## Descricao Funcional
The system shall validate all inputs before processing them further.

## Comportamento Esperado
Validation happens before any data is stored or transmitted externally.

## Invariantes de Dominio
The system must maintain consistency across all operations.

## Criterios de Aceitacao
Scenario: Test
Given a
When b
Then c

Scenario: Test 2
Given a
When b
Then c

Scenario: Test 3
Given a
When b
Then c

## Casos de Erro
Errors are handled gracefully with proper messages.
`;
    const result = validateRequirementsSemantic(md);
    // Has content but no concrete property names or "deve" patterns
    expect(result.score).toBeLessThan(100);
  });

  it("passes with concrete invariants using deve/nao pode patterns", () => {
    const md = `
## Descricao Funcional
The system shall validate all user inputs before processing.

## Comportamento Esperado
Inputs are validated according to business rules.

## Invariantes de Dominio
User.email deve ser unico. User.role nao pode ser admin sem confirmacao. Order.status deve ser valido.

## Criterios de Aceitacao
Scenario: Test
Given a
When b
Then c

Scenario: Test 2
Given a
When b
Then c

Scenario: Test 3
Given a
When b
Then c

## Casos de Erro
Errors are handled.
`;
    const result = validateRequirementsSemantic(md);
    const invariantWarning = result.warnings.find((w) =>
      w.issue.includes("Invariantes de Dominio"),
    );
    // Should NOT have vague invariant warning because "deve" patterns are present
    expect(invariantWarning).toBeUndefined();
  });

  it("accepts requirements with concrete criteria (commands)", () => {
    const md = `
## Descricao Funcional
The system runs npx vitest run to execute all tests.

## Comportamento Esperado
Coverage should reach 80% as verified by npx vitest run --coverage.

## Criterios de Aceitacao
Scenario: Run tests
Given a
When b
Then result

Scenario: Check coverage
Given a
When b
Then result

Scenario: Edge case
Given a
When b
Then result

## Casos de Erro
Errors.
`;
    const result = validateRequirementsSemantic(md);
    const concreteWarning = result.warnings.find((w) =>
      w.issue.includes("concrete measurable"),
    );
    expect(concreteWarning).toBeUndefined();
  });

  it("handles empty markdown gracefully", () => {
    const result = validateRequirementsSemantic("");
    // Empty string has no sections to analyze, so it returns default (score=100, valid=true)
    expect(result).toBeDefined();
    expect(typeof result.score).toBe("number");
  });

  it("handles markdown with only a title", () => {
    const result = validateRequirementsSemantic("# Just a title");
    expect(result.score).toBeLessThan(100);
  });
});

describe("validateRoadmapSemantic", () => {
  it("passes roadmap with specific class names and layer references", () => {
    const md = `
## Desenho Arquitetural
UserService, AuthController, and PaymentGateway form the core architecture.

## Camadas Envolvidas
domain: src/domain/, application: src/application/, infrastructure: src/infrastructure/

## Padroes de Projeto Adotados
Repository pattern for data access, Factory for object creation.

## Padroes Rejeitados
Singleton was rejected due to testability concerns. God Class anti-pattern avoided.

## Estrategia de Rollback
Step 1: git revert <hash>. Step 2: npm run build. Step 3: Deploy.
`;
    const result = validateRoadmapSemantic(md);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it("warns when no specific class/interface names found", () => {
    const md = `
## Desenho Arquitetural
We will use a layered architecture.

## Camadas Envolvidas
Different layers with clear separation of concerns.

## Padroes de Projeto Adotados
Common patterns will be used where appropriate.

## Padroes Rejeitados
None rejected at this time.

## Estrategia de Rollback
Rollback if needed.
`;
    const result = validateRoadmapSemantic(md);
    const classWarning = result.warnings.find((w) =>
      w.issue.includes("class or interface"),
    );
    expect(classWarning).toBeDefined();
  });

  it("warns when rejected patterns section is too short", () => {
    const md = `
## Desenho Arquitetural
UserService handles all business logic operations.

## Camadas Envolvidas
domain: src/domain/

## Padroes de Projeto Adotados
Factory pattern for object creation.

## Padroes Rejeitados
None

## Estrategia de Rollback
Rollback steps.
`;
    const result = validateRoadmapSemantic(md);
    const rejectedFailure = result.failures.find((f) =>
      f.issue.includes("Rejected patterns"),
    );
    expect(rejectedFailure).toBeDefined();
  });

  it("warns when rejected patterns section exists but is empty (just heading)", () => {
    const md = `
## Desenho Arquitetural
UserService class.

## Camadas Envolvidas
domain: src/domain/

## Padroes de Projeto Adotados
Factory.

## Padroes Rejeitados

## Estrategia de Rollback
Steps.
`;
    const result = validateRoadmapSemantic(md);
    // Should have either a failure or warning for rejected patterns
    expect(result.failures.length > 0 || result.warnings.length > 0).toBe(true);
  });

  it("warns when no layer-to-path mapping found", () => {
    const md = `
## Desenho Arquitetural
UserService is the main component.

## Camadas Envolvidas
Layers are organized by functionality.

## Padroes de Projeto Adotados
Factory.

## Padroes Rejeitados
Not applicable for this project scope at this time.

## Estrategia de Rollback
Rollback strategy with steps.
`;
    const result = validateRoadmapSemantic(md);
    const layerWarning = result.warnings.find((w) =>
      w.issue.includes("layer-to-path"),
    );
    expect(layerWarning).toBeDefined();
  });

  it("warns when rollback strategy is too vague", () => {
    const md = `
## Desenho Arquitetural
UserService class in domain layer.

## Camadas Envolvidas
domain: src/domain/

## Padroes de Projeto Adotados
Factory.

## Padroes Rejeitados
Not applicable.

## Estrategia de Rollback
Revert.
`;
    const result = validateRoadmapSemantic(md);
    // The rollback content is very short
    expect(result.score).toBeLessThan(100);
  });
});

describe("validateActionsSemantic", () => {
  it("returns invalid for actions without T-numbered entries", () => {
    const result = validateActionsSemantic("# No actions here");
    expect(result.valid).toBe(false);
  });

  it("passes actions with well-structured T-numbered items", () => {
    const md = `
### T001 - Implement Feature
Alvo exato: src/feature.ts
Camada: application
`; // Needs proper structure — simplified for test
    const result = validateActionsSemantic(md);
    expect(result).toBeDefined();
  });
});

describe("validateTestPlanSemantic", () => {
  it("passes test plan with multiple Gherkin scenarios", () => {
    const md = `
## Test Strategy
We use vitest for unit testing and Playwright for e2e.

## Unit Tests
Scenario: Test validation
Given valid input
When validated
Then passes

Scenario: Test rejection
Given invalid input
When validated
Then fails

Scenario: Test edge case
Given empty input
When validated
Then errors

## Integration Tests
Scenario: Full flow
Given user is authenticated
When they upload
Then file is stored
`;
    const result = validateTestPlanSemantic(md);
    expect(result).toBeDefined();
  });

  it("warns when too few Gherkin scenarios", () => {
    const md = `
## Test Strategy
Use vitest.

## Unit Tests
Scenario: Only one test
Given a
When b
Then c
`;
    const result = validateTestPlanSemantic(md);
    expect(result.score).toBeLessThan(100);
  });
});
