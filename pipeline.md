# Workflow: Pipeline de Desenvolvimento (v2)

## Papéis e modelos

| Papel              | Modelo     | Responsabilidade principal                                 |
| ------------------ | ---------- | ---------------------------------------------------------- |
| Product Owner      | Opus 4.8   | Valida requisitos, critérios de aceite e regras de negócio |
| CTO                | Opus 4.8   | Aprova arquitetura, mitiga riscos técnicos                 |
| Arquiteto          | Opus 4.8   | Desenha a solução, define camadas e contratos              |
| Engenheiro         | Opus 4.8   | Quebra escopo, distribui tarefas, integra branches         |
| Code Reviewer      | Opus 4.8   | Review estrito, checagem de tipos, padrões de projeto      |
| Dev Frontend 1/2/3 | Sonnet 5 | Implementação Vue 3 / Nuxt 3 / Pinia / Tailwind            |
| QA Tester 1/2      | Sonnet 5 | Testes Vitest + Vue Test Utils, relatório de falhas        |

**Nem todo papel é acionado em toda task** — o tier definido em F0.3 decide
quantos entram. Ver Fase 0.

---

## Fase 0 — Recepção e clareza de requisitos

**Agente: Product Owner (Opus 4.8)**

0.1. Recebe o objetivo do usuário em linguagem natural. 0.2. Extrai e
documenta: - Critérios de aceite mensuráveis (o que "feito" significa) - Escopo
negativo (o que NÃO está incluído) - Impacto em i18n (strings novas em pt e
es?) - Impacto em stores Pinia existentes

0.3. **Classifica a complexidade da task** — isso decide quantas fases e
agentes serão realmente acionados. Não rodar o pipeline completo por padrão;
o tier abaixo é que determina o caminho:

| Tier          | Critério                                                                                              | Caminho                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟢 Trivial    | 1 arquivo, sem store/composable novo, não toca pagamento/checkout (ex: texto, classe, chave i18n isolada) | Pula F1/F2 → Dev direto (F3, **sem** worktree isolado) → lint/test → commit (F7). Sem Code Review nem QA dedicados — Dev valida e commita.        |
| 🟡 Média      | Componente/composable novo em camada existente, sem nova store, sem tocar `useStoreDeCompra`/`usePaymentStore`/`useCheckoutStore` | F1 só com Arquiteto (sem CTO) → F2 → F3 → F5 (Code Review) → F7. QA dedicado (F6) só se o critério de aceite exigir caso de borda; senão o Dev escreve o teste em F3. |
| 🔴 Alta       | Nova store, mudança cross-camada, ou qualquer alteração em pagamento/checkout/dados sensíveis          | Pipeline completo (F0→F7), como descrito nas fases a seguir.                                                                                     |

0.4. Gera um `spec.md` estruturado (com o tier classificado) e devolve para
aprovação do usuário antes de prosseguir.

**Gate: usuário aprova spec (e o tier) antes de avançar. Em caso de dúvida
entre dois tiers, classifique no tier mais alto.**

---

## Fase 1 — Exploração do codebase (Research-first)

**Agentes: CTO + Arquiteto (Opus 4.8) — em paralelo**

1.1. [CTO] Lê `CLAUDE.md`, `nuxt.config.ts`, estrutura de `camadas/`, `store/`,
`composables/` e `types/`. 1.2. [Arquiteto] Busca componentes, stores e
composables existentes relacionados ao escopo. - Usa Grep/Glob para localizar
código relevante antes de propor qualquer coisa nova. - Mapeia: quais arquivos
serão criados, quais modificados, quais lidos. 1.3. [Arquiteto] Produz um
`solution-design.md` com: - Camada alvo para cada arquivo novo (ex:
`camadas/ui`, `camadas/compra`) - Nomes de composables/stores a criar ou
reutilizar, já quebrados por responsabilidade única (fetch, estado, lógica de
negócio, UI state nunca no mesmo composable) - Contrato de tipos TypeScript
(interfaces/types novos) - Strings i18n necessárias (chave + valor pt + valor
es) - Árvore de dependências entre subtarefas (o que bloqueia o que) 1.4. [CTO]
Aprova o `solution-design.md` ou solicita ajuste.

**Gate: `solution-design.md` aprovado pelo CTO.**

---

## Fase 2 — Quebra de escopo e distribuição

**Agente: Engenheiro de Software (Opus 4.8)**

2.1. Lê o `solution-design.md` aprovado. 2.2. Divide em subtarefas atômicas: -
Cada subtarefa tem: arquivo(s) alvo, contrato de interface, critério de
conclusão. - Subtarefas independentes são marcadas como `[PARALELO]`. -
Subtarefas com dependência são marcadas como `[SEQUENCIAL: depende de X]`. 2.3.
Distribui para Dev Frontend 1, 2, 3 com contexto completo: - Caminho absoluto
dos arquivos - Interfaces TypeScript esperadas - Chaves i18n a adicionar -
Composables/stores a reutilizar (não recriar)

---

## Fase 3 — Implementação paralela

**Agentes: Dev Frontend 1, 2, 3 (Sonnet 5)**

**Isolamento (`isolation: "worktree"`) só quando 2+ Devs rodam em paralelo em
arquivos que poderiam conflitar.** Worktree tem custo real de setup e disco —
para tier 🟢 Trivial ou subtarefa única (sem paralelismo), rodar direto no
workspace atual, sem isolamento.

Para cada subtarefa `[PARALELO]`:

3.1. [Dev] Lê os arquivos relevantes listados na tarefa antes de escrever
qualquer linha. 3.2. [Dev] Implementa seguindo: - Composition API com
`<script setup lang="ts">` - Tailwind CSS (sem CSS inline) - Tipos explícitos em
props, emits e retornos de composables - Strings de UI sempre via chave i18n
(nunca hardcoded) - Convenções de casing por tipo de identificador
(`.instructions.md`: componentes `PascalCase`, composables `use` + camelCase,
stores `useXxxStore`, constantes `SCREAMING_SNAKE_CASE`) - Componente nunca
contém `$fetch`/`useFetch`/`useAsyncData` nem manipula store diretamente —
lógica sempre em composable dedicado, com responsabilidade única (SRP) 3.3.
[Dev] Após implementar, roda localmente: -
`npm run lint:fix` → corrige formatação - `vue-tsc --noEmit` → checa tipos -
`npm run test:unit` → executa testes da unidade afetada 3.4. [Dev] Se
lint/types/testes passam → reporta conclusão ao Engenheiro. [Dev] Se falha →
corrige e repete 3.3 (até 3 tentativas; se persistir, escala ao Engenheiro).

**Subtarefas `[SEQUENCIAL]` aguardam a conclusão das dependências antes de
iniciar.**

---

## Fase 4 — Integração e checagem de i18n

**Agente: Engenheiro de Software (Opus 4.8)**

4.1. Recebe relatórios de conclusão dos Devs. 4.2. Integra os worktrees (merge
das branches isoladas). 4.3. Roda `npm run lint` no código integrado. 4.4.
Verifica checklist de i18n: - Toda chave adicionada em `pt` existe também em
`es`? - Nenhuma string de UI está hardcoded nos templates Vue? 4.5. Se i18n
incompleto → devolve para o Dev responsável com instrução específica. 4.6. Se
tudo ok → encaminha para Code Review.

---

## Fase 5 — Code Review

**Agente: Code Reviewer (Opus 4.8)**

5.1. Recebe o diff completo (arquivos modificados vs. branch base). 5.2.
Avalia: - Corretude lógica e regras de negócio (vs. `spec.md`) - Arquitetura:
está na camada certa? reutilizou o que existia? - Componente sem `$fetch`/
manipulação direta de store; lógica extraída para composable - Composables
respeitam SRP (sem fetch+transformação+estado de UI misturados) e casing
correto (`use` + camelCase) - TypeScript: sem `any`
implícito, props tipadas, retornos tipados - Performance: sem watchers
desnecessários, sem re-renders evitáveis - Acessibilidade: atributos ARIA onde
necessário - Segurança: sem dados sensíveis expostos, sem XSS - i18n:
confirmação final de paridade pt/es 5.3. Resultado: - **APROVADO**: avança para
Fase 6. - **REPROVADO com comentários**: devolve para o Dev responsável com
anotações precisas (arquivo, linha, problema, sugestão). Dev corrige e retorna à
Fase 3.3. - **BLOQUEADO (problema arquitetural)**: escala para Arquiteto (Fase
1.3 revisada).

**Máximo de 2 ciclos de review antes de escalar ao Arquiteto.**

---

## Fase 6 — QA e testes

**Agentes: QA Tester 1 e 2 (Sonnet 5) — em paralelo**

6.1. Recebem o `spec.md` (critérios de aceite) e o código integrado. 6.2. [QA 1]
Escreve e executa testes unitários com **Vitest + Vue Test Utils**: - Testa
composables de forma isolada - Testa stores Pinia (state, getters, actions) -
Testa componentes com `mount`/`shallowMount` 6.3. [QA 2] Verifica cobertura dos
critérios de aceite do `spec.md`: - Cada critério tem ao menos um teste
correspondente? - Casos de borda cobertos (empty state, erro de API, loading)?
6.4. Rodam `npm run test:unit` no suite completo. 6.5. Resultado: - **TODOS
PASSAM**: avança para Fase 7. - **FALHA**: QA gera relatório de falha com: -
Teste que falhou (nome + arquivo) - Erro exato (stack trace) - Hipótese de causa
Relatório é enviado de volta ao Dev responsável → Dev corrige (Fase 3) → retorna
à Fase 6.

**Handback QA → Dev deve ser autocontido**: o relatório de falha (6.5) precisa
trazer stack trace + hipótese de causa suficientes para o Dev corrigir sem
precisar re-explorar o codebase do zero — isso é o que evita que cada ciclo
recomece o contexto do zero. Se a hipótese de causa não é clara, o Dev usa a
skill `systematic-debugging` (diagnóstico dirigido por evidência) em vez de
tentativa-e-erro.

**Self-healing: o ciclo QA → Dev → QA pode ocorrer até 3 vezes antes de escalar
ao Arquiteto + Code Reviewer.**

---

## Fase 7 — Commit e fechamento

**Agente: Engenheiro de Software (Opus 4.8)**

7.1. Prepara o commit: - Tipo correto: `feat`, `fix`, `refactor`, `test`,
`chore` - Escopo correto: nome da camada ou módulo (ex: `compra`, `ui`,
`checkout`) - Mensagem descritiva no imperativo 7.2. Confirma que nenhum arquivo
`.env*` foi staged. 7.3. **Product Owner** faz validação final contra os
critérios de aceite do `spec.md`. 7.4. Se aprovado: tarefa concluída. Branch
pronta para PR. 7.5. Se reprovado: PO especifica o gap → volta à Fase 0.3
(refinamento do spec).

---

## Tratamento de falhas e rollback

| Situação                                     | Ação                                                         |
| -------------------------------------------- | ------------------------------------------------------------ |
| Dev não consegue implementar em 3 tentativas | Escala ao Engenheiro com contexto completo                   |
| Lint/types falham após 3 tentativas          | Escala ao Arquiteto para revisar o design                    |
| Review bloqueado (problema arquitetural)     | Arquiteto revisita `solution-design.md`                      |
| QA falha 3 ciclos consecutivos               | Escala ao Arquiteto + Code Reviewer simultaneamente          |
| PO reprova na validação final                | Volta ao spec; worktrees descartados (`git worktree remove`) |
| Conflito de merge na integração              | Engenheiro resolve; se complexo, escala ao Arquiteto         |

---

## Fluxo resumido

**O tier definido em F0.3 decide quais caixas abaixo são acionadas** — o
diagrama mostra o caminho completo (tier 🔴 Alta). Tier 🟢 pula direto para
Dev → lint/test → commit; tier 🟡 pula CTO e QA dedicado quando não há caso
de borda a cobrir.

```
Usuario
  |
  v
[F0: Product Owner] → spec.md (+ tier) → usuario aprova?
  |--[NAO]--> revisa spec
  v [SIM]
[F1: CTO + Arquiteto] (paralelo, só tier Alta) → solution-design.md → CTO aprova?
  |--[NAO]--> Arquiteto revisa
  v [SIM]
[F2: Engenheiro] → subtarefas atomicas [PARALELO] e [SEQUENCIAL]
  |
  +--[Dev 1]--+--[Dev 2]--+--[Dev 3]  (worktree isolado só se 2+ em paralelo)
  le → implementa → lint:fix → vue-tsc → test:unit
  falhou? --> corrige (max 3x) | persiste --> escala Engenheiro
  v [PASSOU]
[F4: Engenheiro] → integra worktrees → lint → checa i18n
  |--[i18n incompleto]--> Dev → F3
  v [OK]
[F5: Code Reviewer] → diff completo
  |--[REPROVADO]--> Dev → F3.3 (max 2 ciclos)
  |--[BLOQUEADO]--> Arquiteto → F1.3
  v [APROVADO]
[F6: QA 1 + QA 2] (paralelo) → Vitest + Vue Test Utils
  |--[FALHA]--> Dev → F3 → F6 (max 3 ciclos)
  v [TODOS PASSAM]
[F7: Engenheiro + PO] → npm run commit → hook Husky → PO valida
  |--[REPROVADO]--> F0.3
  v [APROVADO]
Branch pronta para PR
```

---

## Mapeamento para Claude Code SDK

```
# Fase 3 — só usar isolation quando 2+ Devs rodam em paralelo (custo de setup/disco)
Agent(
  subagent_type: "claude",
  isolation: "worktree",       # branch + worktree limpos por agente — SÓ se houver risco de conflito
  run_in_background: true,     # Dev 1, 2, 3 disparam em paralelo
  prompt: "..."
)

# Tier 🟢 Trivial / subtarefa única — sem isolation, sem spawn de agente extra
# implementa direto na sessão atual

# Fase 5 — Code Review com skill dedicada
Skill("code-review", args="--effort high")

# Fase 6 — handback de falha usa systematic-debugging em vez de retry cego
Skill("superpowers:systematic-debugging")

# Fase 7 — commit via commitizen (nunca git commit direto)
Bash("npm run commit")
```
