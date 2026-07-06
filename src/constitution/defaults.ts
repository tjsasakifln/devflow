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
    },
    {
      id: "C8",
      description:
        "Nenhum TODO/FIXME em código de produção sem ticket ou issue associada.",
      category: "process",
      verification: {
        tool: "grep",
        command:
          "grep -rn 'TODO\\|FIXME' src/ --include='*.ts' | grep -v '// TODO' || true",
        expectedOutput: "zero",
        failMessage:
          "C8 violation: TODO/FIXME found without ticket reference. Format: // TODO(#123): description.",
      },
      blocking: true,
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

---

## Regras Estruturais

### C1 — Encapsulamento de Domínio
**Description:** Regras de negócio devem ficar encapsuladas em classes, serviços de domínio, use cases ou módulos coesos.
**Verification:** dependency-cruiser — domínio não pode importar infraestrutura.
**Severity:** 🔴 Bloqueante.

### C2 — Infraestrutura por Interfaces
**Description:** Infraestrutura (DB, HTTP, filesystem, SDKs, LLMs) deve ser acessada por interfaces, adapters ou repositories.
**Verification:** dependency-cruiser — camada de infra não é importada diretamente pelo domínio.
**Severity:** 🔴 Bloqueante.

### C3 — Dependências para Dentro
**Description:** Camadas internas não dependem de camadas externas. O sentido da dependência é sempre para dentro.
**Verification:** dependency-cruiser — forbid rule: src/domain → src/infrastructure.
**Severity:** 🔴 Bloqueante.

### C4 — Proibições Estruturais
**Description:** Proibido: estado global mutável, God objects, imports circulares, duplicação de lógica, dependências cruzadas entre features.
**Verification:** madge (circular), jscpd (duplicação), eslint (regras estruturais).
**Severity:** 🔴 Bloqueante.

---

## Regras de Arquitetura

### C5 — Exceções Documentadas
**Description:** Exceções às regras da constitution só são permitidas com ADR registrada e anotação \`@constitution-exception\` no código.
**Verification:** grep por \`@constitution-exception\` + referência a ADR.
**Severity:** 🟡 Advertência (não bloqueante).

---

## Regras de Qualidade

### C6 — Limites de Tamanho e Complexidade
**Description:** Funções ≤ 40 linhas, arquivos ≤ 400 linhas, complexidade ciclomática ≤ 10.
**Verification:** eslint com regras de complexidade e max-lines.
**Severity:** 🔴 Bloqueante.

### C7 — Cobertura de Testes
**Description:** Cobertura mínima de testes: 80% linhas, 100% branches em domínio.
**Verification:** vitest (ou framework de teste do projeto) com thresholds.
**Severity:** 🔴 Bloqueante.

---

## Regras de Processo

### C8 — TODO/FIXME Rastreáveis
**Description:** Nenhum TODO/FIXME em código de produção sem ticket ou issue associada.
**Verification:** grep — TODO/FIXME sem formato \`TODO(#123)\` ou \`FIXME(#456)\`.
**Severity:** 🟡 Advertência (bloqueante para feature-done).

---

## Notas

- **Revisão:** Esta constitution deve ser revisada a cada 3 meses ou após cada release major.
- **Emendas:** Para adicionar, remover ou modificar regras, crie uma ADR e submeta à aprovação do time.
- **Conflitos:** Em caso de conflito entre constitution e prática estabelecida, a constitution prevalece até que seja formalmente emendada.
`;
