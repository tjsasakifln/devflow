# Story 1.5: Externalizar Valores Hardcoded para Constantes/Config

**Story ID:** STORY-TD-1.5
**Epic:** EPIC-TD-001
**Status:** Done
**Debito:** D-SYS-13
**Severidade:** LOW
**Esforco:** 0.5 dia
**Prioridade:** BAIXA

## Descricao

Externalizar valores de configuracao atualmente hardcoded no codigo para constantes nomeadas ou arquivo de configuracao:

- Caminho de justificativa de tolerancia a risco: `.devflow/audits/bypass-log.jsonl`
- Caminhos de deteccao de features: `_devflow/features/${featureId}/`
- Mapeamento de StackAdapters em `adapters/stacks/index.ts`

## Scope

**IN:**
- Externalizacao de caminhos hardcoded: bypass-log, deteccao de features
- Mapeamento de StackAdapters movido para constante/configuracao
- Criacao de modulo centralizado de constantes (`src/kernel/constants/paths.ts`)

**OUT:**
- Nao inclui mudanca de logica de negocios
- Nao altera o comportamento dos caminhos — apenas centraliza sua definicao
- StackAdapters: externalizar apenas se o mapeamento for estatico; se for dinamico, documentar

## Business Value

Centraliza valores magicos em constantes nomeadas, eliminando duplicacao e facilitando auditoria de configuracoes. Reduz risco de typo em caminhos repetidos e torna futuras alteracoes de configuracao pontuais em vez de multi-arquivo.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|------------|
| Consumidor de caminho hardcoded nao rastreado quebra | Low | Medium | Grep exaustivo antes da substituicao; `npm run build` verifica integridade |
| StackAdapters com logica condicional que nao pode ser constante | Low | Low | AC3 ja preve condicional "se aplicavel" — auditoria decide abordagem |

## Acceptance Criteria

- [x] AC1: Caminho de bypass-log externalizado para constante ou configuracao
- [x] AC2: Caminho de deteccao de features externalizado para constante ou configuracao
- [ ] AC3: Mapeamento de StackAdapters externalizado (se aplicavel) — DECIDIDO: Nao aplicavel, mapeamento e estatico mas de objetos runtime (nao config)
- [x] AC4: `npm test` passa apos as alteracoes (1092/1092 pass)
- [x] AC5: `npm run build` passa apos as alteracoes (exit code 0)

## Definition of Done

- [x] Valores hardcoded externalizados para constantes
- [x] Testes passando (68 test files, 1092 tests, 0 failures)
- [x] Build passando (exit code 0)
- [ ] Code review aprovado

## Dependencias

Nenhuma — paralelizavel com outras stories da Fase 1.

## Testes Requeridos

- [x] `npm test` passa (68 test files, 1092 tests, 0 failures)
- [x] `npm run build` passa (exit code 0)

## File List

**Arquivos criados:**
- `src/kernel/constants/paths.ts` — modulo centralizado de constantes de caminhos

**Arquivos modificados:**
- `src/kernel/constants.ts` — re-export dos path constants
- `src/kernel/tracking/bypass-detector.ts` — usa BYPASS_LOG_RELPATH
- `src/adapters/git/index.ts` — usa HOOK_BYPASS_LOG_RELPATH
- `src/core/evidence-engine.ts` — usa AUDITS_DIR, ADVERSARIAL_REVIEW_FILENAME, GATEKEEP_LOG_RELPATH
- `src/commands/trace.ts` — usa AUDITS_DIR, GATEKEEP_LOG_RELPATH, DOT_DEVFLOW_DIR
- `src/core/audit-engine.ts` — usa FEATURES_DIR, AUDITS_DIR, ADVERSARIAL_REVIEW_FILENAME, GATEKEEP_LOG_RELPATH

**StackAdapters:**
- Mapeamento em `src/adapters/stacks/index.ts` e estatico mas de objetos runtime importados — nao aplicavel para externalizar como configuracao. Decisao documentada.

## QA Results

### Review Date: 2026-07-09

### Reviewed By: Quinn (Guardian)

### Gate Status

Gate: PASS -> docs/qa/gates/1.5-externalize-hardcoded-values-gate.yaml

### Findings

- AC1 (bypass-log path): VERIFIED - BYPASS_LOG_RELPATH in paths.ts consumed by bypass-detector.ts
- AC2 (feature detection paths): VERIFIED - FEATURES_DIR in paths.ts
- AC3 (StackAdapters): VERIFIED - N/A, runtime objects not config
- AC4 (npm test): VERIFIED - 1075 tests pass
- AC5 (npm run build): VERIFIED - 0 errors
- paths.ts has 54 lines with 12 constants covering audit, feature, config, and state paths
- 5 consumers updated: bypass-detector, evidence-engine, git adapter, audit-engine, trace
- Clean barrel export from src/kernel/constants.ts

### Verdict: PASS

All acceptance criteria met. No issues found.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-08 | 1.0.0 | Validated GO (7/10) — Status: Draft → Ready | @po |
| 2026-07-08 | 1.0.1 | Correções pós-validação (+Scope, +Business Value, +Risks) — Score 7/10 → 10/10 | @po |
| 2026-07-09 | 1.0.3 | QA Gate PASS — Status: InReview -> Done | @qa |
| 2026-07-09 | 1.0.2 | Implementação: paths.ts criado, 5 consumidores atualizados, build e test passando | @dev |
