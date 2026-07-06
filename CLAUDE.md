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

## Comandos Devflow

- `devflow status` — estado do projeto, confiança, evidências
- `devflow next` — próxima ação recomendada
- `devflow feature new <name>` — criar feature workspace
- `devflow feature complete <id>` — 25 checks de Definition of Done
- `devflow gatekeep <id>` — aprovação independente (implementer ≠ approver)
- `devflow adversarial-review <id>` — tentativa de rejeitar a feature (8 vetores de ataque)
- `devflow doctor` — diagnóstico e correção
- `devflow update-cockpit` — regenerar DEVFLOW.md

## Princípios

1. **CI é fonte de verdade** — sem CI verde, feature fica em review-required
2. **Quem gera não aprova** — Constitution C12, inviolável
3. **Evidência > Alegação** — "funcionou na minha máquina" não é verificação
4. **Gates bloqueantes** — check de qualidade, segurança, arquitetura = bloqueio
5. **Na dúvida, bloqueia** — otimismo automático é o veneno que o devflow neutraliza
