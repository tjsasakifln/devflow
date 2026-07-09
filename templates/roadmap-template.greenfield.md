<!--
Template de corpo do roadmap.md para projetos GREENFIELD.
Projetos novos, sem código legado, sem delta arquitetural.

REGRAS DE PREENCHIMENTO:
- Escreva descrevendo O QUE VAI SER CONSTRUÍDO, não o que já existe.
- Decisões de arquitetura e tecnologia são especulativas — marque premissas claramente.
- Detalhes profundos de modelo de dados vão para data-delta.md (se aplicável).
- Detalhes profundos de contrato externo vão para interfaces/<nome>.md (se aplicável).
-->

# Roadmap: <NOME DA FEATURE>

> Identificador: `<NNN>-<short-name>`
> Data: `YYYY-MM-DD`
> Requirements: `<feature-dir>/requirements.md`
> Projeto: Greenfield (novo)

## 1. Descrição Técnica

<!--
Até dez linhas. Em prosa, explique o caminho técnico escolhido.
Foque no que será construído, sem referências a legado.
-->

## 2. Decisões Técnicas

<!--
Liste as principais decisões de tecnologia e arquitetura.
Cada decisão deve ter justificativa e alternativas consideradas.
-->

| ID | Decisão | Justificativa | Alternativas descartadas |
|----|---------|----------------|--------------------------|
| D-01 | <decisão> | <razão objetiva> | <a, b, c> |
| D-02 | <decisão> | <razão objetiva> | <a, b> |

## 3. Estrutura de Arquivos

<!--
Liste os principais arquivos e diretórios que serão criados.
Inclua tanto código fonte quanto artefatos de configuração.
-->

```
<projeto>/
├── src/
│   ├── <módulo>/
│   │   ├── <arquivo>.ts
│   │   └── <arquivo>.ts
│   └── <módulo>/
│       └── <arquivo>.ts
├── tests/
│   └── <teste>.test.ts
└── <config>.json
```

## 4. Dependências Externas

<!--
Liste bibliotecas, serviços, APIs e ferramentas que serão utilizadas.
Para cada uma, indique a versão prevista e o propósito.
-->

| Dependência | Versão | Propósito |
|-------------|--------|-----------|
| <biblioteca> | <versão> | <propósito> |
| <serviço> | <versão> | <propósito> |

## 5. Riscos e Mitigações

<!--
Identifique riscos do desenvolvimento greenfield: tecnologia não testada, 
complexidade de integração, incertezas de escopo.
-->

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| <risco> | alto / médio / baixo | alto / médio / baixo | <ação> |

## 6. Histórico de alterações

| Data | Alteração | Autor |
|------|-----------|-------|
| YYYY-MM-DD | Versão inicial | autor |
