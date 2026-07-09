<!--
Template de corpo do requirements.md para projetos GREENFIELD.
Projetos novos, sem código legado, sem extração reversa.

REGRAS DE PREENCHIMENTO:
- Mantenha a ordem das seções obrigatórias.
- Não apague seções marcadas como obrigatórias.
- Comentários inline (entre <!-- -->) só devem ser removidos quando a seção correspondente estiver totalmente preenchida.
- Para projetos greenfield: descreva O QUE VAI SER CONSTRUÍDO, não o que já existe.
-->

# Requirements: <NOME DA FEATURE>

> Identificador: `<NNN>-<short-name>`
> Data: `YYYY-MM-DD`
> Projeto: Greenfield (novo)

## 1. Resumo executivo

<!--
Até cinco linhas. Diga o quê a feature entrega, para quem, e qual problema ela resolve.
NÃO descreva como será implementada.
-->

## 2. Personas e cenários de uso

<!-- Quem usa, com qual objetivo, em qual frequência. -->

| Persona | Objetivo | Cenário-chave |
|---------|----------|---------------|
| <persona> | <objetivo> | <descrição em uma frase> |

## 3. Regras de negócio

<!--
Cada regra como item numerado.
-->

1. **RN-01:** <descrição>
   - Tipo: nova
2. **RN-02:** ...

## 4. Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de aceite |
|----|-----------|------------|--------------------|
| RF-01 | <descrição> | Must | <critério verificável> |
| RF-02 | <descrição> | Should | <critério verificável> |

## 5. Requisitos Não Funcionais

| Tipo | Requisito | Justificativa |
|------|-----------|---------------|
| Desempenho | <requisito> | <rationale> |
| Segurança | <requisito> | <rationale> |
| Observabilidade | <requisito> | <rationale> |

## 6. Critérios de Aceitação

```gherkin
Cenário: <título>
  Dado <pré-condição>
  Quando <ação do ator>
  Então <resultado observável>

Cenário: <título do caso negativo>
  Dado <pré-condição>
  Quando <ação inválida>
  Então <comportamento esperado de falha>
```

## 7. Prioridade MoSCoW

| Item | MoSCoW | Justificativa |
|------|--------|---------------|
| RF-01 | Must | <razão> |
| RF-02 | Should | <razão> |
| RNF de desempenho | Should | <razão> |

## 8. Esclarecimentos

<!--
Esta seção é preenchida conforme dúvidas são resolvidas durante o desenvolvimento.
-->

> Nenhum esclarecimento registrado ainda.

## 9. Histórico de alterações

| Data | Alteração | Autor |
|------|-----------|-------|
| YYYY-MM-DD | Versão inicial | autor |
