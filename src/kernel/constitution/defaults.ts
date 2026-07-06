import type { ConstitutionDocument } from "../types/constitution.js";

export const DEFAULT_CONSTITUTION: ConstitutionDocument = {
  version: "1.0.0",
  projectName: "project",
  ratified: new Date().toISOString(),
  rules: [
    {
      id: "C1",
      description:
        "Regras de negócio devem ficar encapsuladas em classes, serviços de domínio, use cases ou módulos coesos.",
      category: "structure",
      verification: {
        tool: "dependency-cruiser",
        command:
          "npx dependency-cruiser --config .devflow/dependency-cruiser.constitution.js src/",
        expectedOutput: "zero",
        failMessage:
          "C1 violation: Business logic found outside domain layer. Encapsulate in classes, domain services, or use cases.",
      },
      blocking: true,
      severity: "critical",
      approvalCondition: "auto",
      refusalMessage:
        "C1 — Encapsulamento de Domínio: Regras de negócio fora da camada de domínio. Mova a lógica para domain services, use cases ou entidades.",
      humanReviewRequired: false,
    },
    {
      id: "C2",
      description:
        "Infraestrutura (DB, HTTP, filesystem, SDKs, LLMs) deve ser acessada por interfaces, adapters ou repositories.",
      category: "architecture",
      verification: {
        tool: "dependency-cruiser",
        command:
          "npx dependency-cruiser --config .devflow/dependency-cruiser.constitution.js src/",
        expectedOutput: "zero",
        failMessage:
          "C2 violation: Infrastructure accessed without adapter. Use interfaces or repository pattern.",
      },
      blocking: true,
      severity: "critical",
      approvalCondition: "auto",
      refusalMessage:
        "C2 — Infraestrutura por Interfaces: Acesso direto a banco, HTTP ou filesystem. Use adapters, repositories ou interfaces.",
      humanReviewRequired: false,
    },
    {
      id: "C3",
      description:
        "Camadas internas não podem depender de camadas externas. Dependências devem apontar para dentro.",
      category: "architecture",
      verification: {
        tool: "dependency-cruiser",
        command:
          "npx dependency-cruiser --config .devflow/dependency-cruiser.constitution.js src/",
        expectedOutput: "zero",
        failMessage:
          "C3 violation: Inner layer depends on outer layer. Invert the dependency.",
      },
      blocking: true,
      severity: "critical",
      approvalCondition: "auto",
      refusalMessage:
        "C3 — Dependências para Dentro: Camada interna depende de camada externa. Inverta a dependência com interface.",
      humanReviewRequired: false,
    },
    {
      id: "C4",
      description:
        "Proibido: estado global mutável, God objects, imports circulares, duplicação de lógica, dependências cruzadas entre features.",
      category: "structure",
      verification: {
        tool: "madge",
        command: "npx madge --circular --extensions ts src/",
        expectedOutput: "zero",
        failMessage:
          "C4 violation: Circular imports or cross-feature dependencies found.",
      },
      blocking: true,
      severity: "critical",
      approvalCondition: "auto",
      refusalMessage:
        "C4 — Proibições Estruturais: Import circular, God object ou estado global mutável detectado.",
      humanReviewRequired: false,
    },
    {
      id: "C5",
      description:
        "Exceções às regras da constitution só são permitidas com ADR registrada e anotação @constitution-exception no código.",
      category: "process",
      verification: {
        tool: "grep",
        command:
          "grep -r '@constitution-exception' src/ --include='*.ts' -l || true",
        expectedOutput: "pass",
        failMessage:
          "C5 violation: Constitution exceptions found without corresponding ADR.",
      },
      blocking: false,
      severity: "advisory",
      approvalCondition: "human-review",
      refusalMessage:
        "C5 — Exceções Documentadas: Exceção à constitution sem ADR. Registre um ADR em .devflow/decisions/ e anote @constitution-exception no código.",
      humanReviewRequired: true,
    },
    {
      id: "C6",
      description:
        "Funções ≤ 40 linhas, arquivos ≤ 400 linhas, complexidade ciclomática ≤ 10.",
      category: "quality",
      verification: {
        tool: "eslint",
        command: "npx eslint src/ --config .devflow/eslintrc.constitution.json",
        expectedOutput: "pass",
        failMessage:
          "C6 violation: Function or file exceeds size/complexity limits.",
      },
      blocking: true,
      severity: "blocking",
      approvalCondition: "auto",
      refusalMessage:
        "C6 — Limites de Tamanho e Complexidade: Função > 40 linhas, arquivo > 400 linhas ou complexidade > 10. Refatore.",
      humanReviewRequired: false,
      ooQualityMetrics: {
        maxComplexity: 10,
        maxLinesPerFunction: 40,
        maxLinesPerFile: 400,
      },
    },
    {
      id: "C7",
      description:
        "Cobertura mínima de testes: 80% linhas, 100% branches em domínio.",
      category: "quality",
      verification: {
        tool: "vitest",
        command: "npx vitest run --coverage",
        expectedOutput: "threshold",
        threshold: 80,
        failMessage:
          "C7 violation: Test coverage below 80% lines or domain branch coverage below 100%.",
      },
      blocking: true,
      severity: "blocking",
      approvalCondition: "auto",
      refusalMessage:
        "C7 — Cobertura de Testes: Cobertura abaixo de 80%. Adicione testes para comportamento novo e regressão.",
      humanReviewRequired: false,
      ooQualityMetrics: {
        minCoverage: 80,
      },
    },
    {
      id: "C8",
      description:
        "Nenhum TODO/FIXME em código de produção sem ticket ou issue associada.",
      category: "process",
      verification: {
        tool: "grep",
        command:
          "grep -rn 'TODO\\|FIXME' src/ --include='*.ts' | grep -v 'TODO(' | grep -v 'FIXME(' || true",
        expectedOutput: "zero",
        failMessage:
          "C8 violation: TODO/FIXME found without ticket reference. Format: // TODO(#123): description.",
      },
      blocking: true,
      severity: "blocking",
      approvalCondition: "auto",
      refusalMessage:
        "C8 — TODO/FIXME Rastreáveis: TODO/FIXME sem ticket. Use TODO(#issue): descrição.",
      humanReviewRequired: false,
    },
    // ── New rules (C9–C12) ──
    {
      id: "C9",
      description:
        "Acoplamento entre módulos deve ser controlado. Dependências cíclicas entre pacotes são proibidas.",
      category: "architecture",
      verification: {
        tool: "dependency-cruiser",
        command:
          "npx dependency-cruiser --config .devflow/dependency-cruiser.constitution.js src/ --output-type json 2>&1 || true",
        expectedOutput: "pass",
        failMessage:
          "C9 violation: Excessive coupling between modules detected.",
      },
      blocking: true,
      severity: "blocking",
      approvalCondition: "auto",
      refusalMessage:
        "C9 — Acoplamento Controlado: Módulos com acoplamento excessivo. Introduza interfaces para quebrar dependências diretas.",
      humanReviewRequired: false,
      ooQualityMetrics: {
        maxCoupling: 5,
      },
    },
    {
      id: "C10",
      description:
        "Módulos devem ter responsabilidade única e alta coesão. Módulo com mais de 20 arquivos ou responsabilidades mistas deve ser dividido.",
      category: "oo-design",
      verification: {
        tool: "eslint",
        command:
          "npx eslint src/ --config .devflow/eslintrc.constitution.json --format json 2>&1 || true",
        expectedOutput: "pass",
        failMessage:
          "C10 violation: Module cohesion too low — too many responsibilities per module.",
      },
      blocking: true,
      severity: "blocking",
      approvalCondition: "auto",
      refusalMessage:
        "C10 — Coesão de Módulos: Módulo com baixa coesão. Divida em módulos menores com responsabilidade única.",
      humanReviewRequired: false,
      ooQualityMetrics: {
        maxLinesPerFile: 400,
      },
    },
    {
      id: "C11",
      description:
        "Todo requisito funcional deve ter critério de aceitação verificável. Mínimo de 3 cenários Gherkin, incluindo casos de erro.",
      category: "domain",
      verification: {
        tool: "grep",
        command:
          "grep -c 'Scenario:' _devflow/features/*/test-plan.md 2>/dev/null || echo '0'",
        expectedOutput: "threshold",
        threshold: 3,
        failMessage:
          "C11 violation: Insufficient acceptance criteria. Each feature needs >= 3 Gherkin scenarios with error cases.",
      },
      blocking: true,
      severity: "blocking",
      approvalCondition: "auto",
      refusalMessage:
        "C11 — Aceitação Rastreável: Menos de 3 cenários Gherkin ou ausência de casos de erro. Adicione cenários verificáveis no test-plan.md.",
      humanReviewRequired: false,
    },
    {
      id: "C12",
      description:
        "Quem implementa não aprova. O agente implementador e o gatekeeper/reviewer devem ser atores diferentes.",
      category: "process",
      verification: {
        tool: "manual",
        command:
          "cat _devflow/features/*/implementation-log.jsonl 2>/dev/null | jq -r '.actor' | sort -u || echo 'manual-check'",
        expectedOutput: "pass",
        failMessage:
          "C12 violation: Same actor implemented and approved. Implementer and gatekeeper must be different.",
      },
      blocking: true,
      severity: "critical",
      approvalCondition: "human-review",
      refusalMessage:
        "C12 — Segregação de Papéis: Mesmo ator implementou e aprovou. O gatekeeper deve ser diferente do implementador.",
      humanReviewRequired: true,
    },
  ],
};

export const CONSTITUTION_MARKDOWN_TEMPLATE = `# Constitution de Engenharia — {{PROJECT_NAME}}

> **Version:** 1.0.0
> **Ratified:** {{TIMESTAMP}}
> **Project:** {{PROJECT_NAME}}
>
> Esta constitution é a lei do projeto. Nenhum código mergeado em main pode violá-la.
> Exceções exigem ADR registrada e anotação \`@constitution-exception\` no código.

---

## Princípios Fundamentais

1. **Spec-Driven Development:** Especificação precede implementação. Sempre.
2. **Baixo Acoplamento:** Módulos dependem de abstrações, não de implementações.
3. **Alta Coesão:** Cada módulo tem uma razão única para mudar.
4. **Testabilidade:** Código não testado é código quebrado esperando para acontecer.
5. **Manutenibilidade:** Código é lido 10x mais do que escrito. Clareza > performance prematura.
6. **Evidência sobre Alegação:** Commit messages dizendo "funciona" não são evidência. Logs, testes, comandos executados são.
7. **Segregação de Papéis:** Quem gera código não aprova código. A aprovação exige ator diferente.

---

## Regras Estruturais

### C1 — Encapsulamento de Domínio
**Description:** Regras de negócio devem ficar encapsuladas em classes, serviços de domínio, use cases ou módulos coesos.
**Category:** structure
**Severity:** 🔴 critical
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** dependency-cruiser — domínio não pode importar infraestrutura.
**Refusal Message:** C1 — Encapsulamento de Domínio: Regras de negócio fora da camada de domínio.

### C2 — Infraestrutura por Interfaces
**Description:** Infraestrutura (DB, HTTP, filesystem, SDKs, LLMs) deve ser acessada por interfaces, adapters ou repositories.
**Category:** architecture
**Severity:** 🔴 critical
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** dependency-cruiser — camada de infra não é importada diretamente pelo domínio.
**Refusal Message:** C2 — Infraestrutura por Interfaces: Acesso direto à infraestrutura.

### C3 — Dependências para Dentro
**Description:** Camadas internas não dependem de camadas externas. O sentido da dependência é sempre para dentro.
**Category:** architecture
**Severity:** 🔴 critical
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** dependency-cruiser — forbid rule: src/domain → src/infrastructure.
**Refusal Message:** C3 — Dependências para Dentro: Camada interna depende de externa.

### C4 — Proibições Estruturais
**Description:** Proibido: estado global mutável, God objects, imports circulares, duplicação de lógica, dependências cruzadas entre features.
**Category:** structure
**Severity:** 🔴 critical
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** madge (circular), jscpd (duplicação), eslint (regras estruturais).
**Refusal Message:** C4 — Proibições Estruturais: Import circular ou God object.

---

## Regras de Arquitetura

### C5 — Exceções Documentadas
**Description:** Exceções às regras da constitution só são permitidas com ADR registrada e anotação \`@constitution-exception\` no código.
**Category:** process
**Severity:** 🟡 advisory
**Approval Condition:** human-review
**Human Review Required:** true
**Verification:** grep por \`@constitution-exception\` + referência a ADR.
**Refusal Message:** C5 — Exceções Documentadas: Exceção sem ADR.

### C9 — Acoplamento Controlado
**Description:** Acoplamento entre módulos deve ser controlado. Dependências cíclicas entre pacotes são proibidas.
**Category:** architecture
**Severity:** 🔴 blocking
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** dependency-cruiser com regras de acoplamento.
**Refusal Message:** C9 — Acoplamento Controlado: Módulos excessivamente acoplados.

---

## Regras de Qualidade

### C6 — Limites de Tamanho e Complexidade
**Description:** Funções ≤ 40 linhas, arquivos ≤ 400 linhas, complexidade ciclomática ≤ 10.
**Category:** quality
**Severity:** 🔴 blocking
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** eslint com regras de complexidade e max-lines.
**Refusal Message:** C6 — Limites de Tamanho e Complexidade: Função/arquivo excede limites.

### C7 — Cobertura de Testes
**Description:** Cobertura mínima de testes: 80% linhas, 100% branches em domínio.
**Category:** quality
**Severity:** 🔴 blocking
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** vitest (ou framework de teste do projeto) com thresholds.
**Refusal Message:** C7 — Cobertura de Testes: Cobertura abaixo do mínimo.

### C10 — Coesão de Módulos
**Description:** Módulos devem ter responsabilidade única e alta coesão. Módulo inchado deve ser dividido.
**Category:** oo-design
**Severity:** 🔴 blocking
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** eslint com max-lines-per-file, análise de coesão por pasta.
**Refusal Message:** C10 — Coesão de Módulos: Módulo com baixa coesão.

---

## Regras de Domínio

### C11 — Aceitação Rastreável
**Description:** Todo requisito funcional deve ter critério de aceitação verificável em Gherkin.
**Category:** domain
**Severity:** 🔴 blocking
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** grep por cenários Gherkin no test-plan.md (mínimo 3, incluindo erro).
**Refusal Message:** C11 — Aceitação Rastreável: Cenários de aceitação insuficientes.

---

## Regras de Processo

### C8 — TODO/FIXME Rastreáveis
**Description:** Nenhum TODO/FIXME em código de produção sem ticket ou issue associada.
**Category:** process
**Severity:** 🔴 blocking
**Approval Condition:** auto
**Human Review Required:** false
**Verification:** grep — TODO/FIXME sem formato \`TODO(#123)\` ou \`FIXME(#456)\`.
**Refusal Message:** C8 — TODO/FIXME Rastreáveis: TODO/FIXME sem ticket.

### C12 — Segregação de Papéis
**Description:** Quem implementa não aprova. O agente implementador e o gatekeeper/reviewer devem ser atores diferentes.
**Category:** process
**Severity:** 🔴 critical
**Approval Condition:** human-review
**Human Review Required:** true
**Verification:** Análise do implementation-log.jsonl — atores de implementação e aprovação.
**Refusal Message:** C12 — Segregação de Papéis: Implementador e aprovador são o mesmo ator.

---

## Notas

- **Revisão:** Esta constitution deve ser revisada a cada 3 meses ou após cada release major.
- **Emendas:** Para adicionar, remover ou modificar regras, crie uma ADR e submeta à aprovação do time.
- **Conflitos:** Em caso de conflito entre constitution e prática estabelecida, a constitution prevalece até que seja formalmente emendada.
- **Human Review Required:** Regras marcadas como human-review-required NUNCA devem ser aprovadas automaticamente. A ausência de verificação automática não significa aprovação.
`;
