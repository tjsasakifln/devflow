# Reversa

> Framework de Engenharia Reversa instalado neste projeto.

## Como usar

Use o fluxo adequado no chat:

- `/reversa` — descobrir e documentar um sistema existente
- `/reversa-new` — criar PRD e specs para um projeto novo
- `/reversa-forward` — implementar ou evoluir código a partir das specs
- `/reversa-migrate` — planejar a migração de um sistema legado
- `/reversa-docs` — gerar o mini-site visual da documentação
- `/reversa-agents-help` — consultar o catálogo completo de agentes

## Comportamento ao ativar

Quando o usuário digitar `/reversa` ou a palavra `reversa` sozinha em uma mensagem:

1. Ative o skill `reversa` disponível em `.claude/skills/reversa/SKILL.md`
2. Se não encontrar em `.claude/skills/`, tente `.agents/skills/reversa/SKILL.md`
3. Leia o SKILL.md na íntegra e siga exatamente as instruções do Reversa

## Regra não-negociável

Nunca apague, modifique ou sobrescreva arquivos pré-existentes do projeto legado.
O Reversa escreve apenas em `.reversa/`, `_reversa_sdd/`, `_reversa_docs/` e `_reversa_forward/`.

---

# Devflow Harness

> **fool-resistant, evidence-driven, engineered-by-default**
>
> O Devflow não elimina julgamento humano. Mas reduz drasticamente a superfície de erro,
> eleva o custo de pular engenharia e produz evidência suficiente para revisão séria.
>
> Devflow nunca aprova implicitamente. Aprovação exige `--approve` explícito,
> todos os checks bloqueantes passando, CI verde (em modo strict/release),
> e ator diferente do implementador (Constitution C12).

## Instalação

```bash
npx @tjsasakinpm/devflow install    # primeiro uso guiado
npm install -g @tjsasakinpm/devflow # instalação global
```

## Comandos Devflow

### STABLE (implementados e testados)
- `devflow install [--dry-run] [--yes] [--review-mode]` — setup guiado primeiro uso
- `devflow init` — inicializar Devflow no diretório atual
- `devflow status` — estado do projeto, confiança, evidências
- `devflow next [--diagnose]` — próxima ação recomendada
- `devflow feature new <name> [--actor] [--non-interactive]` — criar feature workspace
- `devflow feature prompt <id> [--copy] [--save]` — gerar prompt de implementação para IA
- `devflow feature complete <id>` — 25 checks de Definition of Done
- `devflow gatekeep <id> --approve|--reject [--actor]` — aprovação independente
- `devflow adversarial-review <id>` — 12 vetores de ataque
- `devflow doctor [--fix] [--dry-run]` — diagnóstico e correção
- `devflow update-cockpit` — regenerar DEVFLOW.md
- `devflow index` — mapear estrutura do projeto
- `devflow config set <key> <value>` — configurar reviewMode, executionMode

### EXPERIMENTAL
- `devflow discover` — análise brownfield (4 relatórios em _devflow/discovery/)

Opção global: `--mode local|experimental|strict|release`

## Fluxos de Primeiro Uso

### Greenfield (projeto novo)
`install` → `feature new` → `next` → preencher artefatos → `feature prompt` → codar

### Brownfield (código existente)
`install` → `discover` → ler relatórios → `feature new` → `legacy-impact.md` → codar

### Com Agente de IA
Ler `DEVFLOW.md` → respeitar "Current Instruction for Agents" → nunca codar antes de `feature-coding-ready`

## Princípios

1. **CI é fonte de verdade** — em modo strict/release, CI verde é obrigatório e bloqueante
2. **Quem gera não aprova** — Constitution C12, inviolável. Atores desconhecidos bloqueados em strict.
3. **Evidência > Alegação** — logs incluem hash, commit SHA, branch, modo, versão
4. **Gates bloqueantes** — check de qualidade, segurança, arquitetura = bloqueio
5. **Na dúvida, bloqueia** — otimismo automático é o veneno que o devflow neutraliza
6. **Decisão explícita** — aprovação nunca é implícita; requer `--approve` consciente
7. **Auditável** — cada aprovação é um pacote auditável: condições, arquivos (hash), commit, ator, regra
