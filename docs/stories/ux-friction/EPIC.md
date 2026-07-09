# Epic: UX Friction Reduction — Devflow Onboarding

**Epic ID:** EPIC-UX-FRICTION
**Created:** 2026-07-08
**Author:** River (Scrum Master) + Uma (UX Design Expert)
**Source:** [Auditoria UX do Devflow](../../../home/tjsasakifln/.claude/plans/neste-projeto-n-o-temos-piped-salamander.md)

## Contexto

Auditoria de experiência de uso do Devflow CLI (v1.0.0) sob a ótica do **usuário preguiçoso e não técnico** identificou 24 pontos de fricção em 8 dimensões: instalação, primeiro uso, jornada greenfield, jornada brownfield, fardo de artefatos, fadiga de gates, qualidade das instruções, e resultado de qualidade de código.

O problema central: o Devflow foi projetado para engenheiros disciplinados que leem documentação. O usuário real é um desenvolvedor que quer "só fazer funcionar" e tende a contornar gates em vez de segui-los.

## Objetivo

Reduzir o tempo até o primeiro prompt de implementação de ~35 minutos para <5 minutos, eliminar "banhos de vermelho" desmotivadores, e garantir que mesmo o usuário preguiçoso produza código com qualidade real (não apenas artifacts com placeholder).

## Histórias por Sprint

### Sprint 1 — Curto Prazo (Bloqueantes)

| ID | Story | Priority | Effort |
|----|-------|----------|--------|
| [1.1](1.1.quick-mode.story.md) | Modo Rápido — `feature new --quick` | P0 | 5p |
| [1.2](1.2.stage-aware-dod.story.md) | Stage-Aware DoD Checks | P0 | 3p |
| [1.3](1.3.solo-detection.story.md) | Detecção Automática de Solo Developer | P0 | 2p |
| [1.4](1.4.tool-verification.story.md) | Verificação de Ferramentas no Adversarial Review | P1 | 2p |

### Sprint 2 — Médio Prazo (Estruturais)

| ID | Story | Priority | Effort |
|----|-------|----------|--------|
| [2.1](2.1.greenfield-templates.story.md) | Templates Separados por Contexto | P0 | 5p |
| [2.2](2.2.discover-quick.story.md) | Discover Quick — 3 Relatórios Essenciais | P1 | 5p |
| [2.3](2.3.express-onboarding.story.md) | Express Onboarding — `devflow quickstart` | P1 | 3p |
| [2.4](2.4.feedback-hooks.story.md) | Feedback Loop Contínuo — Hooks Pré-Comando | P1 | 3p |

### Sprint 3 — Longo Prazo (Defesa em Profundidade)

| ID | Story | Priority | Effort |
|----|-------|----------|--------|
| [3.1](3.1.sanity-score.story.md) | Sanity Score para Artefatos | P1 | 5p |
| [3.2](3.2.safe-defaults.story.md) | Safe Defaults — Detecção de "Desespero" | P1 | 3p |

**Total:** 10 stories, 36 pontos, 3 sprints

## Métricas de Sucesso

- Tempo install → primeiro prompt: **de 35min para <5min**
- Taxa de abandono no onboarding: **de ~80% para <20%** (estimado)
- Pass rate no primeiro `feature complete`: **de ~20% para >60%**
- Artifacts com placeholder: **de ~40% para <10%**
- Usuários que burlam gates sistematicamente: **de ~30% para <5%** (via safe defaults)

## Dependências entre Stories

```
Sprint 1: todas independentes entre si
  1.1 (quick mode) ──┐
  1.2 (stage-aware) ─┤ sem dependências
  1.3 (solo detect) ─┤
  1.4 (tool verify) ─┘

Sprint 2: depende de Sprint 1 concluído
  2.1 (templates) ──── depende de 1.2 (stage-aware) para DoD adaptation
  2.2 (discover) ──── independente
  2.3 (quickstart) ── independente
  2.4 (hooks) ─────── depende de 1.2 (stage-aware) para health summary

Sprint 3: depende de Sprint 1 + 2
  3.1 (sanity score) ─ depende de 2.1 (templates) para conhecer seções
  3.2 (safe defaults) ─ depende de 1.2 (stage-aware) + 2.4 (hooks)
```

## Validação PO — 2026-07-08

**Validator:** Pax (Product Owner)
**Checklist:** 10-point story draft validation
**Resultado final:** 10/10 GO ✅

### Scores por Story

| Story | 1-Title | 2-Desc | 3-AC | 4-Scope | 5-Deps | 6-Effort | 7-Value | 8-Risks | 9-DoD | 10-Align | Total | Veredito |
|-------|---------|--------|------|---------|--------|----------|---------|---------|-------|----------|-------|----------|
| 1.1 quick-mode | 1 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 1 | **7** | GO |
| 1.2 stage-aware | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 0 | 1 | 1 | **8** | GO |
| 1.3 solo-detect | 1 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 1 | **7** | GO |
| 1.4 tool-verify | 1 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 1 | **7** | GO |
| 2.1 templates | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 0 | 1 | 1 | **8** | GO |
| 2.2 discover | 1 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 1 | **7** | GO |
| 2.3 quickstart | 1 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 1 | **7** | GO |
| 2.4 hooks | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 1 | 1 | **9** | GO ✅ |
| 3.1 sanity | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 0 | 1 | 1 | **8** | GO |
| 3.2 bypass-detect | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 1 | 1 | **9** | GO ✅ |

**Média:** 7.7/10 | **GO:** 10/10 | **NO-GO:** 0/10

### Gap Sistêmico

**Risco documentado (critério 8):** 10/10 stories sem seção formal de riscos. Padrão consistente — stories documentam o que fazer (AC, DoD) mas não o que pode dar errado (edge cases, failure modes, mitigations). Não bloqueante para GO, mas recomendado antes de `feature-coding-ready`.

### Notas

- Stories 2.4 e 3.2 foram corrigidas após NO-GO inicial (escopo, dependências, título, epic alignment). Revalidaram como 9/10.
- Stories 1.1-2.3 e 3.1 mantiveram scores originais (7-8/10). Gaps são escopo/dependências não explícitos e risco não documentado — não bloqueantes.
- Próximo passo: `@dev *develop {story-id}` para iniciar implementação do Sprint 1.
