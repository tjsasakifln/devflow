# Story 3.2: Adicionar Testes para Stack Adapters

**Story ID:** STORY-TD-3.2
**Epic:** EPIC-TD-001
**Status:** Done
**Debito:** D-SYS-09
**Severidade:** MEDIUM
**Esforco:** 1-2 dias
**Prioridade:** MEDIA

## Descricao

Adicionar testes unitarios para todos os stack adapters de linguagem (TypeScript, Python, Go, Rust) cobrindo deteccao de padroes perigosos e registro de adapters.

## Acceptance Criteria

- [x] AC1: Testes para TypeScript dangerous patterns (21 testes)
- [x] AC2: Testes para Python dangerous patterns (26 testes)
- [x] AC3: Testes para Go dangerous patterns (23 testes)
- [x] AC4: Testes para Rust dangerous patterns (25 testes)
- [x] AC5: Testes para StackAdapter registry (17 testes)
- [x] AC6: `npm test` passa — 112 testes stack adapter

## Testes

- `test/adapters/stacks/index.test.ts` — 17 testes (registry)
- `test/adapters/stacks/typescript/dangerous-patterns.test.ts` — 21 testes
- `test/adapters/stacks/python/index.test.ts` — 26 testes
- `test/adapters/stacks/go/index.test.ts` — 23 testes
- `test/adapters/stacks/rust/index.test.ts` — 25 testes
- Fixture files em `test/adapters/stacks/{python,go,rust}/fixtures/`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-09 | 1.0.0 | Story file created. Implementation by @dev subagent (agent a63186ed). | @dev |
