# Devflow — Brownfield PRD

> **Versão:** 1.0.0 | **Autor:** Morgan (PM) | **Data:** 2026-07-08
> **Status:** Draft
> **Projeto:** `@tjsasakinpm/devflow` v0.4.6

---

## 1. Intro Project Analysis and Context

### 1.1 Existing Project Overview

**Analysis Source:** IDE-based fresh analysis (2026-07-08). Document-project não foi executado
formalmente; análise direta do source tree com 160+ arquivos TypeScript.

#### Current Project State

Devflow é um CLI Node.js (TypeScript, Commander.js) que implementa governança local
para código gerado por IA. Hoje faz: auditar mudanças antes do PR, impor workflow
spec-driven (requirements → design → test-plan → code), rodar 25 checks de Definition
of Done, revisão adversarial (12 vetores), gatekeep com separação implementador ≠
aprovador, e gerar relatórios de risco para PR.

Publicado no npm como `@tjsasakinpm/devflow`. Distribuído via `npx` ou instalação
local/global. Roda completamente local — sem SaaS, sem telemetria, sem envio de
código para serviços externos.

| Dimensão | Status |
|----------|--------|
| **Linguagem** | TypeScript 5.6 |
| **Runtime** | Node.js >= 18 |
| **Build** | `tsc` |
| **Testes** | Vitest — 18 arquivos, 194 testes, todos passando |
| **LOC** | ~23,550 (14,437 src/ + 9,214 kernel/) |
| **Pacote** | npm público |
| **CI/CD** | GitHub Actions (documentado, CI runner local-first) |

#### Estrutura de Módulos

```
src/
├── main.ts              # Entry point, Commander.js program
├── cli/                 # CLI commands (audit, review-pr)
├── commands/            # Business logic por comando (14 stable + 2 experimental)
├── engine/              # State detector, confidence scorer, validators, next-action
├── kernel/              # Refactoring em progresso (39% migrado)
│   ├── validators/      # loop, oo, semantic, structural
│   ├── dod/             # 8 checks (requirements, roadmap, actions, constitution, tests, typecheck, lint, coverage)
│   ├── audit/           # Chain verifier, generator
│   ├── evidence/        # Confidence scorer, gatherer
│   ├── constitution/    # Checker, loader, defaults (12 artigos)
│   └── ...
├── artifacts/           # Templates de documentos (requirements.md, roadmap.md, etc.)
├── adapters/            # Git, stacks (TS, Python, Go, Rust), modelos (Anthropic, OpenAI, Ollama)
├── guards/              # Pipeline, pre-action, refusal
├── renderers/           # Output: JSON, markdown, HTML, badges
├── intelligence/        # LangGraph state, RAG context, read-only tools
└── types/               # Type definitions
```

#### Disponibilidade de Documentação

- [x] Tech Stack Documentation (README.md)
- [x] Source Tree/Architecture (DEVFLOW.md cockpit auto-gerado)
- [x] Coding Standards (inferido do código)
- [ ] API Documentation (ausente)
- [ ] External API Documentation (ausente)
- [ ] UX/UI Guidelines (N/A — ferramenta CLI)
- [x] Technical Debt Documentation (implícito — duplicação kernel/src)
- [x] docs/ (faq, guides, integrations, local-first, security, use-cases)

### 1.2 Enhancement Scope Definition

**Enhancement Type:** Major Feature Modification + Technology Stack Upgrade

**Enhancement Description:**

Evoluir Devflow de "governança de PR para código de IA" para **orquestrador universal
de workflows de desenvolvimento**. O Devflow deve absorver e sintetizar os padrões de
ouro de 4 ecossistemas:

| Fonte | O que absorver |
|-------|---------------|
| **Reversa** | Análise brownfield completa — scout → archaeologist → detective → architect → writer → reviewer. Documentação executável de sistemas legados. |
| **AIOX Core** | Agent-driven development — PM/PO/SM/Dev/QA/DevOps com autoridade, stories, epics, constitution gates. |
| **LangGraph / LangChain** | Workflow state machines — transições determinísticas, checkpoint/resume, branching condicional. |
| **CrewAI** | Multi-agent orchestration — spawn de especialistas, handoff protocol, fan-out/ fan-in. |

O resultado: um CLI que **elimina carga cognitiva**. O desenvolvedor não precisa
saber qual o próximo passo — o Devflow sabe. Não precisa lembrar de rodar teste,
lint, typecheck — o Devflow bloqueia se não rodar. Não precisa decidir entre
começar com requirements ou design — o Devflow impõe a sequência correta para o
contexto (greenfield vs brownfield, feature vs bugfix, solo vs time).

**Impact Assessment:** Significant Impact (architectural changes required)

A migração kernel precisa ser concluída. Os 9 comandos PREVIEW precisam ser
implementados. A arquitetura de state machine precisa ser robustecida para suportar
workflows compostos (ex: encadear brownfield discovery → epic creation → story
implementation → QA gate).

### 1.3 Goals

- Eliminar atrito cognitivo — `devflow next` sempre sabe o próximo passo
- Unificar greenfield e brownfield sob o mesmo state machine engine
- Completar migração kernel (eliminar duplicação src/ ↔ src/kernel/)
- Implementar 9 comandos PREVIEW com lógica real
- Adicionar multi-agent orchestration (fan-out para análises paralelas)
- Integrar padrão Reversa como workflow brownfield oficial
- Subir coverage de testes para >= 80%
- Publicar v1.0.0 como ferramenta estável e completa

### 1.4 Background Context

Devflow nasceu como resposta ao problema de código gerado por IA sem evidência de
qualidade. A versão 0.4.6 já entrega governança real — audita, revisa, bloqueia.
Mas o escopo está artificialmente limitado a "governança de PR".

A visão real é maior: **ser a camada de orquestração entre o desenvolvedor e
qualquer ferramenta de IA**. O Devflow deve ser o "tech lead invisível" — aquele
que sempre sabe o estado do projeto, qual o próximo passo, e quais gates precisam
passar antes de seguir.

O mercado está fragmentado: Reversa faz brownfield, AIOX faz agent-driven, LangGraph
faz state machines, CrewAI faz multi-agent. Nenhum unifica. Todos exigem que o
usuário aprenda o framework. Devflow inverte: o framework aprende o projeto e guia
o usuário.

### 1.5 Change Log

| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial | 2026-07-08 | 1.0.0 | Brownfield PRD creation | Morgan (PM) |

---

## 2. Requirements

### 2.1 Functional Requirements

- **FR1:** `devflow next` deve recomendar a próxima ação baseada no estado atual
  do projeto, detectando automaticamente se é greenfield ou brownfield.
- **FR2:** Todo workflow (greenfield, brownfield, bugfix, review) deve ser modelado
  como state machine com transições determinísticas, estados bem definidos e
  checkpoints resumíveis.
- **FR3:** Brownfield discovery deve executar análise completa do código legado
  (scout → archaeologist → detective → architect → writer), gerando documentação
  executável em `.reversa/`.
- **FR4:** Agent-driven development deve suportar delegação para agentes
  especializados (PM, PO, SM, Dev, QA, DevOps, Architect) com matriz de autoridade
  explícita e segregação de responsabilidades.
- **FR5:** Multi-agent orchestration deve permitir fan-out paralelo (ex: 3 análises
  simultâneas de dimensões diferentes do código) e fan-in (consolidação dos
  resultados).
- **FR6:** Todos os gates (typecheck, lint, tests, coverage, circular-deps,
  adversarial-review) devem ser bloqueantes por padrão, com override consciente
  via `--approve`.
- **FR7:** `devflow status` deve mostrar com clareza absoluta: estado atual,
  confiança, evidências coletadas, próximos passos, blockers.
- **FR8:** O sistema de artifacts (requirements.md, roadmap.md, test-plan.md,
  actions.md) deve ser shared source of truth entre desenvolvedor e agentes de IA.
- **FR9:** Slash commands para Claude Code (`/devflow`) e Cursor devem ser
  gerados automaticamente na instalação e mantidos em sync com a versão do CLI.
- **FR10:** CI/CD integration deve funcionar como GitHub Actions sem enviar código
  para serviços externos — processamento local no CI runner.
- **FR11:** Handoff protocol entre agentes deve preservar contexto (story, decisões,
  arquivos modificados, blockers) em artifact compacto (<500 tokens).
- **FR12:** Comandos PREVIEW (`ai init`, `requirements audit`, `design review`,
  `tests review`, `actions generate`, `drift check`, `adversarial-review-ai`,
  `trace`, `promote`) devem ser implementados com lógica real, não stubs.

### 2.2 Non-Functional Requirements

- **NFR1:** Performance — `devflow status` deve responder em <2s em projetos até
  100k LOC.
- **NFR2:** Performance — `devflow next` deve responder em <3s, mesmo com análise
  de estado complexa.
- **NFR3:** Confiabilidade — todos os gates determinísticos (typecheck, lint,
  tests, coverage) devem ter circuit breaker: timeout → warn-and-proceed, nunca
  bloquear desenvolvimento por falha de infra.
- **NFR4:** Portabilidade — CLI deve funcionar identicamente em Linux, macOS, e
  Windows (WSL2), Node.js 18+.
- **NFR5:** Segurança — nenhum código fonte deve ser enviado para serviços
  externos. Telemetria zero. Verificável por inspeção do source.
- **NFR6:** Manutenibilidade — eliminar duplicação src/ ↔ src/kernel/. Um único
  source of truth por domínio.
- **NFR7:** Testabilidade — coverage >= 80%. Todo comando público deve ter teste
  de CLI (pipe-safe: stdout JSON, stderr banner).
- **NFR8:** Documentação — todo comando documentado em README.md e `--help`.
  Gerada automaticamente do source onde possível.

### 2.3 Compatibility Requirements

- **CR1:** Existing API compatibility — comandos STABLE atuais não podem quebrar
  assinatura. Novos flags devem ser backward-compatible.
- **CR2:** Node.js API compatibility — `main.ts` exports devem manter contrato
  público (programmatic usage).
- **CR3:** Config file compatibility — `.devflow/config.json` schema deve ser
  forward-compatible. Campos novos com defaults sensatos.
- **CR4:** Integration compatibility — Claude Code slash command (`/devflow`),
  GitHub Actions workflow, e npm package bin devem continuar funcionando sem
  mudança no setup do usuário.

---

## 3. Technical Constraints and Integration Requirements

### 3.1 Existing Technology Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Linguagem** | TypeScript | 5.6 |
| **Runtime** | Node.js | >= 18 |
| **CLI Framework** | Commander.js | ^12.1 |
| **UI Prompts** | @clack/prompts | ^0.7 |
| **Estilo** | picocolors | ^1.1 |
| **Testes** | Vitest | ^2.1 |
| **Build** | tsc (tsconfig.build.json) | — |
| **Package Manager** | npm | — |
| **CI** | GitHub Actions | — |

### 3.2 Integration Approach

**Workflow Engine Integration:**
O state machine engine existente (`src/engine/state-detector.ts`, `src/engine/transition-table.ts`,
`src/engine/next-action.ts`) será consolidado no kernel como `src/kernel/workflow/` —
motor único que serve greenfield, brownfield, e agent-driven workflows.

**Multi-Agent Integration:**
O padrão CrewAI de spawn de agentes será implementado via subprocessos isolados
(worktrees git opcionais), com handoff protocol já definido em
`.claude/rules/agent-handoff.md`. Cada agente recebe contexto compacto e retorna
resultado estruturado.

**Reversa Integration:**
Os skills do Reversa (`.claude/skills/reversa/`) serão invocáveis via CLI como
etapas do workflow brownfield. O comando `devflow discover` (hoje experimental)
será expandido para orquestrar a sequência completa.

**Code Intelligence:**
O módulo `src/intelligence/` será expandido com provider interface para análise
estática (hoje tem LangGraph state e RAG context). Provider padrão: análise
local de AST via TypeScript compiler API.

### 3.3 Code Organization and Standards

- **File Structure:** Consolidar em `src/kernel/` — remover duplicação em `src/engine/`,
  `src/artifacts/`, `src/constitution/`, `src/cockpit/`.
- **Naming:** Kebab-case para arquivos, camelCase para funções, PascalCase para tipos.
- **Coding Standards:** TypeScript strict mode. Sem `any` exceto com justificativa
  documentada.
- **Documentation:** JSDoc em funções públicas. README-driven para comandos novos.
- **Imports:** Absolute imports com `src/` como base (AIOX Article VI).

### 3.4 Deployment and Operations

- **Build:** `tsc -p tsconfig.build.json` → `dist/`
- **Deploy:** `npm publish` (manual ou CI)
- **Distribuição:** `npx @tjsasakinpm/devflow` + instalação local/global
- **Versionamento:** Semver. Versão atual 0.4.6 → target 1.0.0
- **Changelog:** Conventional commits. `chore: bump to x.y.z` para releases.

### 3.5 Risk Assessment and Mitigation

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Duplicação kernel/src divergir em comportamento | HIGH | Completar migração antes de adicionar features. Testes de consistência entre paths. |
| Refactoring quebrar comandos STABLE | HIGH | Testes de regressão CLI (pipe-safe JSON). CI blocking. |
| Escopo ambicioso → never ship v1.0.0 | MEDIUM | Estruturar em epics independentes. Cada epic entrega valor standalone. |
| Multi-agent consumir tokens excessivos | MEDIUM | Handoff protocol com compacção (max 500 tokens). Limite configurável de agents paralelos. |
| Integração Reversa acoplar demais | LOW | Reversa skills são invocáveis mas independentes. CLI apenas orquestra — não reimplementa. |
| CI/CD quebrar por falta de runner | LOW | Circuit breaker em todos os gates. warn-and-proceed em timeout. |

---

## 4. Epic and Story Structure

### 4.1 Epic Approach

**Epic Structure Decision:** 4 epics sequenciais, cada um entregando valor standalone.
Estrutura escolhida porque: (1) migração kernel é pré-requisito para novas features,
(2) workflow engine é fundação para tudo, (3) multi-agent e Reversa são features
independentes sobre a base, (4) PREVIEW commands e qualidade são polish final.

Sequência: Fundação → Engine → Features → Polish.

---

### 4.2 Epic 1: Kernel Consolidation

**Epic Goal:** Eliminar duplicação src/ ↔ src/kernel/. Um source of truth por domínio.

**Integration Requirements:** Nenhum comando STABLE pode quebrar. Testes existentes
devem continuar passando. CI deve permanecer verde.

#### Story 1.1: Consolidate Validators

**Scope:** IN: `src/engine/loop-validator.ts`, `oo-validator.ts`, `semantic-validator.ts` → redirect to `src/kernel/validators/`. OUT: `src/engine/state-detector.ts`, `src/engine/next-action.ts` (permanecem — serão migrados no Epic 2).
**Complexity:** S (3 arquivos, sem nova lógica)
**Risks:** Baixo — mudança mecânica. Único risco: import paths quebrados em comandos não testados.

As a **developer**,
I want **all validator logic in `src/kernel/validators/` without duplicate code in `src/engine/`**,
so that **there is a single source of truth for loop, OO, semantic, and structural validation**.

**Acceptance Criteria:**
1. `src/engine/loop-validator.ts` removido — imports redirecionados para `src/kernel/validators/loop.ts`
2. `src/engine/oo-validator.ts` removido — imports redirecionados para `src/kernel/validators/oo.ts`
3. `src/engine/semantic-validator.ts` removido — imports redirecionados para `src/kernel/validators/semantic.ts`
4. Todos os 194 testes existentes passando
5. Comandos `feature complete`, `adversarial-review`, `gatekeep` funcionais

**Integration Verification:**
1. IV1: `npm test` passa sem modificação de testes
2. IV2: `npx devflow feature complete <id>` executa checks de validação idênticos
3. IV3: Tempo de execução não degrada >10%

#### Story 1.2: Consolidate Artifacts

**Scope:** IN: `src/artifacts/` (12 templates + validator.ts) → `src/kernel/artifacts/`. OUT: `src/kernel/artifacts/` (destino — já existe, precisa receber validator.ts).
**Complexity:** S (12 arquivos, 1 adição de validator)
**Risks:** Baixo — templates são reexportados. Validator.ts tem lógica de validação que precisa ser preservada.

As a **developer**,
I want **all artifact logic in `src/kernel/artifacts/` without duplicate in `src/artifacts/`**,
so that **template management has a single source of truth**.

**Acceptance Criteria:**
1. `src/artifacts/` removido — imports redirecionados para `src/kernel/artifacts/`
2. `validator.ts` portado para kernel
3. Template generation (requirements.md, roadmap.md, etc.) funcional
4. `devflow feature new` cria workspace com artifacts corretos

**Integration Verification:**
1. IV1: `devflow feature new test-epic1` cria estrutura de diretórios esperada
2. IV2: Templates gerados têm conteúdo idêntico ao pré-migração
3. IV3: `devflow status` detecta estados baseados em artifacts existentes

#### Story 1.3: Consolidate Constitution

**Scope:** IN: `src/constitution/` (checker.ts, defaults.ts, loader.ts) → `src/kernel/constitution/`. OUT: Nada — remoção total do diretório legado.
**Complexity:** S (3 arquivos, sem nova lógica)
**Risks:** Baixo — arquivos idênticos. Verificar se há imports diretos de `src/constitution/` em comandos ou testes.

As a **developer**,
I want **constitution logic in `src/kernel/constitution/` only**,
so that **constitutional checks have a single code path**.

**Acceptance Criteria:**
1. `src/constitution/` removido — imports redirecionados para `src/kernel/constitution/`
2. 12 artigos constitucionais preservados
3. `devflow doctor` verifica constitution integrity

**Integration Verification:**
1. IV1: Constitution checker reporta mesmas violações pré/pós-migração
2. IV2: Gatekeep valida constitution compliance identicamente

#### Story 1.4: Consolidate Cockpit

**Scope:** IN: `src/cockpit/` (generator.ts, sections.ts) → `src/kernel/cockpit/`. OUT: Nada — remoção total do diretório legado.
**Complexity:** S (2 arquivos, sem nova lógica)
**Risks:** Baixo — arquivos idênticos. Validar output byte-identical de `devflow update-cockpit`.

As a **developer**,
I want **cockpit generation in `src/kernel/cockpit/` only**,
so that **DEVFLOW.md generation is unified**.

**Acceptance Criteria:**
1. `src/cockpit/` removido — imports redirecionados para `src/kernel/cockpit/`
2. `devflow update-cockpit` gera DEVFLOW.md idêntico

**Integration Verification:**
1. IV1: Conteúdo de DEVFLOW.md byte-identical pré/pós-migração
2. IV2: `devflow install` gera cockpit correto

---

### 4.3 Epic 2: Universal Workflow Engine

**Epic Goal:** State machine engine unificado que serve greenfield, brownfield,
bugfix, e review workflows. `devflow next` sempre sabe o próximo passo.

**Integration Requirements:** Kernel consolidado (Epic 1 completo). Comandos STABLE
mantidos. Estados existentes (22 estados) preservados.

#### Story 2.1: Design Workflow State Machine

**Scope:** IN: Documento de design da state machine (DSL ou YAML), 22 estados existentes mapeados, novos estados brownfield, visualização Mermaid. OUT: Implementação do engine (Story 2.2).
**Complexity:** M (design puro, sem código, mas requer análise completa dos 22 estados)
**Risks:** Médio — design incompleto quebra stories subsequentes. Mitigação: validar contra todos os fluxos documentados antes de prosseguir.
**Dependencies:** Epic 1 completo (kernel consolidado — paths de engine unificados).

As a **developer**,
I want **a unified state machine definition that covers all 4 workflow types**,
so that **every project state and transition is explicitly modeled and testable**.

**Acceptance Criteria:**
1. State machine DSL ou config file que define: estados, transições, guards, efeitos
2. 22 estados existentes mapeados + novos estados brownfield
3. Transições cobrem: greenfield (15 estados feature pipeline), brownfield
   (discovery → epic → story → implement → verify), bugfix (simplificado),
   review (QA loop)
4. Cada transição tem: condição de guarda, efeito colateral, próximo estado
5. Visualização da state machine gerável (Mermaid/Graphviz)

**Integration Verification:**
1. IV1: State machine spec validada contra todos os fluxos documentados
2. IV2: `devflow next` para cada estado produz recomendação correta (teste parametrizado)

#### Story 2.2: Implement Workflow Engine Core

**Scope:** IN: Runtime engine (state machine executor), state persistence (`.devflow/state.json` v2), checkpoint/resume, `--dry-run` mode, `devflow next` integrado. OUT: Workflows específicos (brownfield, agent-driven — Stories 2.3, 2.4).
**Complexity:** L (motor central do sistema, ~500-800 LOC estimado)
**Risks:** ALTO — regressão em `devflow next` quebra fluxo principal. Mitigação: testes parametrizados comparando output pré/pós migração.
**Dependencies:** Story 2.1 (design), Epic 1 completo.

As a **developer**,
I want **a runtime engine that executes the state machine, persists state, and supports checkpoint/resume**,
so that **workflows can be interrupted and resumed without losing context**.

**Acceptance Criteria:**
1. Engine lê state machine definition e executa transições
2. State persistence em `.devflow/state.json` com schema versionado
3. Checkpoint/resume: estado salvo a cada transição. Resume carrega e continua.
4. `devflow next` usa engine para recomendação (substitui lógica atual em
   `src/engine/next-action.ts`)
5. Modo `--dry-run` para simular transições sem efeitos colaterais

**Integration Verification:**
1. IV1: Fluxo greenfield completo (feature-new → feature-done) executado sem regressão
2. IV2: Interrupção no meio do fluxo → `devflow status` mostra estado correto →
   resume funciona
3. IV3: `devflow next` pré/pós-migração produz mesmas recomendações para estados
   equivalentes

#### Story 2.3: Brownfield Discovery Workflow

**Scope:** IN: Workflow brownfield completo (scout → archaeologist → detective → architect → writer), `devflow discover` renovado, output em `_devflow/discovery/`, flag `--phase`. OUT: Reversa skills (integração como provider é opcional — funciona standalone).
**Complexity:** L (5 fases, cada uma com lógica própria. Considerar split em 2 sub-stories se escopo estourar: 2.3a scout+archaeologist+detective, 2.3b architect+writer)
**Risks:** Médio — 5 fases ambicioso para uma story. Scope creep possível. Mitigação: flag `--phase` permite entrega incremental. Cada fase pode ser validada independentemente.
**Dependencies:** Story 2.2 (engine core).

As a **developer**,
I want **`devflow discover` to execute a complete brownfield analysis workflow**,
so that **I can understand any legacy codebase without manual documentation**.

**Acceptance Criteria:**
1. Workflow brownfield implementado: scout → archaeologist → detective → architect → writer
2. `devflow discover` orquestra as fases sequencialmente
3. Output em `_devflow/discovery/`: system-architecture.md, SCHEMA.md, technical-debt.md,
   TECHNICAL-DEBT-REPORT.md
4. Cada fase pode rodar independente: `devflow discover --phase=scout`
5. Integração com Reversa skills como providers opcionais

**Integration Verification:**
1. IV1: Rodar `devflow discover` no próprio repo Devflow → relatórios gerados
2. IV2: Conteúdo dos relatórios referenceável por stories subsequentes
3. IV3: `devflow next` após discover recomenda criar epic/story baseado nos findings

#### Story 2.4: Agent-Driven Development Workflow

**Scope:** IN: Agent delegation matrix no engine (PM→SM→PO→Dev→QA→DevOps), tags `agent: <role>` nos steps, handoff protocol (<500 tokens), worktree isolation. OUT: Multi-agent paralelo (Epic 3).
**Complexity:** M (integração de conceitos existentes: handoff protocol do AIOX + engine da Story 2.2)
**Risks:** Médio — worktree isolation é custoso (~200-500ms setup). Mitigação: opcional, fallback para subprocesso simples.
**Dependencies:** Story 2.2 (engine core).

As a **developer**,
I want **workflow steps that delegate to specialized AI agents with authority boundaries**,
so that **complex development tasks are handled by the right agent at the right time**.

**Acceptance Criteria:**
1. Agent delegation matrix implementada no engine (PM→SM→PO→Dev→QA→DevOps)
2. Cada step do workflow pode ser tagged com `agent: <role>` — engine spawna
   agente correto
3. Handoff protocol entre agentes usando artifact compacto (<500 tokens)
4. Agentes são subprocessos isolados (worktree git opcional)
5. Agent authority enforced: Dev não pode push, QA não pode implement, etc.

**Integration Verification:**
1. IV1: Workflow com múltiplos agentes executado sem quebra de autoridade
2. IV2: Handoff artifact gerado entre cada transição de agente
3. IV3: Agente sem autoridade para operação → bloqueado com mensagem clara

---

### 4.4 Epic 3: Multi-Agent Orchestration

**Epic Goal:** Fan-out/fan-in para análises paralelas. Orquestração de múltiplos
agentes especialistas simultâneos.

**Integration Requirements:** Workflow engine (Epic 2) completo. Handoff protocol
funcional.

#### Story 3.1: Parallel Agent Spawner

**Scope:** IN: Spawn de N agentes paralelos, `devflow analyze --parallel=<dimensions>`, 6 dimensões padrão, consolidação automática, limite configurável. OUT: Verify pattern (3.2), Critic pattern (3.3).
**Complexity:** M (subprocess management + result consolidation)
**Risks:** Médio — subprocessos paralelos consomem memória e CPU. Mitigação: limite default min(16, cpu-2), timeout individual.
**Dependencies:** Story 2.2 (engine core), Story 2.4 (agent isolation pattern).

As a **developer**,
I want **to spawn N agents in parallel, each analyzing a different dimension of the code**,
so that **comprehensive analysis completes in wall-clock time of the slowest agent, not sum of all**.

**Acceptance Criteria:**
1. `devflow analyze --parallel=<dimensions>` spawna agentes isolados simultâneos
2. Dimensions: security, performance, architecture, tests, docs, deps
3. Cada agente recebe contexto focado (apenas arquivos relevantes)
4. Resultados consolidados automaticamente ao final
5. Limite configurável de agents paralelos (default: min(16, cpu cores - 2))

**Integration Verification:**
1. IV1: Análise paralela de 6 dimensões completa em < tempo da soma sequencial
2. IV2: Resultados consolidados sem conflitos ou duplicação
3. IV3: Timeout individual por agente não mata os outros

#### Story 3.2: Adversarial Verify Pattern

**Scope:** IN: Pattern de verificação adversarial: N findings → N verifiers independentes, lenses (correctness, security, repro), threshold >=2 de 3, integração com `adversarial-review`. OUT: Adversarial com LLM (Story 4.3).
**Complexity:** M (3 verifiers por finding, fan-out/fan-in)
**Risks:** Médio — falso-positivo sobrevivendo a 3 verifiers (raro mas possível). Mitigação: findings com veredit 2-1 (split decision) são marcados como "disputed" e escalados para revisão humana.
**Dependencies:** Story 3.1 (Parallel Agent Spawner).

As a **developer**,
I want **findings from any analysis to be adversarially verified by independent agents**,
so that **false positives are caught before they become tasks**.

**Acceptance Criteria:**
1. Pattern: N findings → spawn N verifiers → cada um tenta REFUTAR
2. Finding sobrevive se >=2 de 3 verificadores independentes não refutam (split decision 2-1 = "disputed", escalado para revisão humana)
3. Verifiers usam lenses diferentes: correctness, security, repro
4. Integrado ao `devflow adversarial-review` existente

**Integration Verification:**
1. IV1: Finding falso-positivo → refutado por >=2 verifiers → removido
2. IV2: Finding real → sobrevive a 3 verifiers → mantido
3. IV3: Verificação não adiciona >2x ao tempo da análise original

#### Story 3.3: Completeness Critic Pattern

**Scope:** IN: Critic agent pós-análise, output de gaps (dimensões não cobertas, fontes não lidas, claims não verificadas), loop-until-dry (max 5 iterações), integração com `devflow next --diagnose`. OUT: Correção automática dos gaps (responsabilidade do usuário ou do @dev).
**Complexity:** S (um agente, um padrão de loop)
**Risks:** Baixo — critic pode gerar falsos positivos (gaps que não são gaps reais). Mitigação: loop para após 2 rodadas consecutivas com 0 itens não cobertos (dry condition objetiva).
**Dependencies:** Story 3.1 (Parallel Agent Spawner).

As a **developer**,
I want **a final agent that asks "what's missing?" after every analysis**,
so that **no dimension, claim, or source goes unexamined**.

**Acceptance Criteria:**
1. Critic agent roda após cada análise (discover, review, audit)
2. Output: lista do que não foi coberto, fontes não lidas, claims não verificadas
3. Output do critic vira input para próxima rodada (loop-until-dry)
4. Dry condition: critic report contém 0 itens não cobertos em 2 rodadas consecutivas — encerra loop
5. Integrado ao `devflow next --diagnose`

**Integration Verification:**
1. IV1: Após discover, critic identifica módulo não analisado → próxima ação
   recomendada
2. IV2: Loop-until-dry: N rodadas até critic retornar vazio (max 5)

---

### 4.5 Epic 4: PREVIEW Commands & Quality

**Epic Goal:** Implementar 9 comandos PREVIEW com lógica real. Subir coverage para
>=80%. Preparar release v1.0.0.

**Integration Requirements:** Todos os epics anteriores completos.

#### Story 4.1: Implement PREVIEW Commands (Batch 1)

**Scope:** IN: `ai init` (config providers Anthropic/OpenAI/Ollama, validação API key), `requirements audit` (checklist qualidade contra requirements.md), `design review` (roadmap.md vs patterns, detect over-engineering). OUT: Batches 2 e 3.
**Complexity:** M (3 comandos, ~150-250 LOC cada)
**Risks:** Baixo — comandos são autocontidos. Único risco: `ai init` lida com secrets (API keys) — garantir que .env é gitignored.
**Dependencies:** Epic 2 completo (workflow engine — comandos integram com `devflow next`).

As a **developer**,
I want **`ai init`, `requirements audit`, `design review` with real logic**,
so that **the preview tier becomes functional**.

**Acceptance Criteria:**
1. `devflow ai init` — configura providers AI (Anthropic, OpenAI, Ollama) com
   validação de API key
2. `devflow requirements audit` — verifica requirements.md contra checklist de
   qualidade (clareza, cobertura, testabilidade)
3. `devflow design review` — verifica roadmap.md contra architecture patterns,
   detecta over-engineering

**Integration Verification:**
1. IV1: Cada comando tem teste CLI (pipe-safe JSON)
2. IV2: Comandos falham com mensagem clara quando prerequisites ausentes
3. IV3: Integrados ao `devflow next` como ações recomendadas

#### Story 4.2: Implement PREVIEW Commands (Batch 2)

**Scope:** IN: `tests review` (test-plan.md vs implementação, gaps de coverage), `actions generate` (GitHub Actions workflow do project config), `drift check` (requirements.md vs implementation-log.jsonl). OUT: Batch 3.
**Complexity:** M (3 comandos, `drift check` mais complexo — diff semântico entre docs)
**Risks:** Médio — `drift check` usa heurísticas para comparar docs vs código. Pode gerar falsos positivos. Mitigação: flag `--strict` vs `--heuristic`.
**Dependencies:** Story 4.1 completo.

As a **developer**,
I want **`tests review`, `actions generate`, `drift check` with real logic**,
so that **the preview tier is fully functional**.

**Acceptance Criteria:**
1. `devflow tests review` — verifica test-plan.md contra implementação, detecta
   gaps de coverage
2. `devflow actions generate` — gera GitHub Actions workflow a partir do project
   config
3. `devflow drift check` — compara requirements.md vs implementation-log.jsonl,
   detecta divergências

**Integration Verification:**
1. IV1: Cada comando tem teste CLI (pipe-safe JSON)
2. IV2: Actions generate produz YAML válido e funcional
3. IV3: Drift check detecta AC implementada mas não documentada (e vice-versa)

#### Story 4.3: Implement PREVIEW Commands (Batch 3)

**Scope:** IN: `adversarial-review-ai` (LLM-powered complementar à determinística), `trace` (execution trace visual), `promote` (feature local→staging→prod com gates), tier system removido, `--list-tiers` depreciado. OUT: Nada — último batch antes do hardening.
**Complexity:** M (3 comandos + remoção de tier system)
**Risks:** Médio — `adversarial-review-ai` depende de LLM provider (custo, latência). Mitigação: fallback para determinístico se provider indisponível. `promote` requer CI integration (se CI não configurado, warn-and-proceed).
**Dependencies:** Story 4.2 completo.

As a **developer**,
I want **`adversarial-review-ai`, `trace`, `promote` with real logic**,
so that **all PREVIEW commands are stable and the tier system is eliminated**.

**Acceptance Criteria:**
1. `devflow adversarial-review-ai` — revisão adversarial usando LLM (complementar
   à determinística)
2. `devflow trace` — visualização de execution trace (timeline de decisões,
   ações, gates)
3. `devflow promote` — promoção de feature entre ambientes (local → staging → prod)
   com gates
4. Tier system removido — todos os comandos são STABLE
5. `--list-tiers` depreciado ou removido

**Integration Verification:**
1. IV1: Todos os 23+ comandos têm teste CLI
2. IV2: Coverage >= 80%
3. IV3: `devflow --list-tiers` mostra todos como STABLE

#### Story 4.4: Quality Hardening & v1.0.0

**Scope:** IN: Coverage >=80% (lines + branches), zero CVSS >=7, benchmark performance (`status` <2s, `next` <3s), README atualizado, changelog 0.4.6→1.0.0, `npm publish` tag `latest`. OUT: Nada — última story antes do release.
**Complexity:** M (qualidade distribuída — toca todos os módulos)
**Risks:** ALTO — `npm publish` é irreversível. Mitigação: dry-run primeiro, verificar tree de publicação (`npm pack --dry-run`), testar instalação limpa em projeto virgem.
**Dependencies:** Todos os epics anteriores completos.

As a **developer**,
I want **comprehensive test coverage, security audit, and performance baseline**,
so that **v1.0.0 ships as a stable, trusted tool**.

**Acceptance Criteria:**
1. Coverage >= 80% (linhas e branches)
2. Zero dependências com CVSS >= 7 (HIGH/CRITICAL)
3. Performance: `devflow status` < 2s, `devflow next` < 3s em projeto médio
4. README.md atualizado com todos os comandos
5. Changelog completo 0.4.6 → 1.0.0
6. `npm publish` com tag `latest`

**Integration Verification:**
1. IV1: `npm test` passa limpo
2. IV2: `npm run typecheck` passa limpo
3. IV3: `npm audit` sem vulnerabilidades HIGH/CRITICAL
4. IV4: Instalação limpa em projeto virgem: `npx @tjsasakinpm/devflow install`

---

## Appendix A: Command Maturity Target

| Comando | v0.4.6 | v1.0.0 |
|---------|--------|--------|
| audit | STABLE | STABLE |
| init | STABLE | STABLE |
| status | STABLE | STABLE |
| next | STABLE | STABLE (enhanced com workflow engine) |
| feature new/complete/prompt | STABLE | STABLE |
| gatekeep | STABLE | STABLE |
| adversarial-review | STABLE | STABLE (enhanced com multi-agent verify) |
| review-pr | STABLE | STABLE |
| doctor | STABLE | STABLE |
| update-cockpit | STABLE | STABLE |
| index | STABLE | STABLE |
| config | STABLE | STABLE |
| discover | EXPERIMENTAL | STABLE (Reversa-integrated) |
| eval run | EXPERIMENTAL | STABLE |
| ai init | PREVIEW | STABLE |
| requirements audit | PREVIEW | STABLE |
| design review | PREVIEW | STABLE |
| tests review | PREVIEW | STABLE |
| actions generate | PREVIEW | STABLE |
| drift check | PREVIEW | STABLE |
| adversarial-review-ai | PREVIEW | STABLE |
| trace | PREVIEW | STABLE |
| promote | PREVIEW | STABLE |
| analyze (novo) | — | STABLE (multi-agent fan-out) |

## Appendix B: Inspired By

| Projeto | URL | O que Devflow absorve |
|---------|-----|----------------------|
| Reversa | github.com/sandeco/reversa | Brownfield discovery pipeline, documentação executável, scout→writer sequence |
| AIOX Core | github.com/SynkraAI/aiox-core | Agent authority matrix, story-driven development, constitution gates, handoff protocol |
| LangGraph | github.com/langchain-ai/langgraph | State machine workflow, checkpoint/resume, conditional branching, loop-until patterns |
| CrewAI | github.com/crewAI/crewAI | Multi-agent spawn, role-based delegation, fan-out/fan-in orchestration |
