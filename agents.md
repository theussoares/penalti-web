# Equipe de Desenvolvimento IA

- **use o [pipeline](./pipeline.md)** — comece pela Fase 0, que classifica a
  task em tier (🟢 Trivial / 🟡 Média / 🔴 Alta) e decide quantos agentes abaixo
  entram
- **use subagents com moderação** — cada spawn é caro (recomeça sem contexto);
  prefira 1 sessão fazendo múltiplos papéis a vários agentes paralelos, exceto
  quando há paralelismo real ou volume que justifique
- **se atente ao [CLAUDE.md](./CLAUDE.md)**
- **SEMPRE SEGUIR [AS INSTRUCTIONS](./.instructions.md)**
- **ao final sempre ver se esta de acordo também com as [ADRs](./docs/adr)**

## Claude Opus 4.8 (Decisões de Alto Impacto)

Reservado para raciocínio estratégico, ambiguidade de regras de negócio e
revisão de risco. Não usar em tarefas mecânicas ou de execução direta.

- **Product Owner** Interpreta o requisito do usuário e valida se a solução
  proposta cobre a regra de negócio da plataforma (rifas, capitalização,
  mecânicas de jogo). Conhece o domínio: fluxo de compra de títulos, combos,
  order bumps, roleta, raspadinha. Produz: `spec.md` estruturado com critérios
  de aceite mensuráveis.

- **Arquiteto de Software** Decide em qual camada (`camadas/checkout`,
  `camadas/compra`, `camadas/escolha-produto`, `camadas/my-purchases`,
  `camadas/ui`, `camadas/core`) cada funcionalidade deve residir. Garante que
  novos composables não dupliquem lógica existente em `/composables/`, que cada
  composable tenha responsabilidade única (fetch, estado, lógica de negócio e UI
  state nunca misturados no mesmo composable) e que stores Pinia sigam o padrão
  `useStoreDeX`. Valida impacto em SSR (Nuxt 3) antes de aprovar. Produz: mapa
  de arquivos a criar/modificar, contratos de interface entre camadas.

- **CTO** Aprova a arquitetura técnica global, mitiga riscos e lê o codebase
  antes de decidir. Responsável por validar o `solution-design.md` gerado pelo
  Arquiteto.

- **Engenheiro de Software** Quebra o escopo em subtarefas atômicas, distribui
  para os Devs com contexto completo (caminhos absolutos, interfaces esperadas,
  chaves i18n), integra worktrees após implementação e gerencia escalações.

- **Code Reviewer Sênior** Revisão de risco: detecta vazamentos de estado entre
  camadas, uso incorreto de `useAsyncData`/`useFetch` no SSR, mutações diretas
  de estado Pinia sem actions, componentes com `$fetch`/manipulação de store
  direto (deveria estar em composable), composables violando responsabilidade
  única, e violações de segurança (dados sensíveis expostos, CryptoJS mal
  usado). Atua em todas as mudanças; revisão aprofundada obrigatória em stores
  críticas (`useStoreDeCompra`, `usePaymentStore`, `useCheckoutStore`) e fluxos
  de pagamento.

---

## Claude Sonnet 5 (Execução Especializada — Paralela)

Subagents paralelos com contexto especializado. Cada spawn de agente é caro
(recomeça do zero, precisa re-explorar contexto) — por padrão, **um único Dev
Vue/Nuxt acumula todos os chapéus abaixo na mesma sessão**. Só promover um
chapéu a agente paralelo dedicado quando o volume dentro da subtarefa justificar
(ex: 15+ chaves i18n de uma vez, refactor de tipos tocando 10+ arquivos, nova
store crítica de pagamento em paralelo à implementação da UI).

- **Dev Vue/Nuxt (1, 2 ou 3 em paralelo — só quando há subtarefas independentes
  de verdade)** Implementa componentes Vue 3 com Composition API
  (`<script setup lang="ts">`), priorizando Dumb Components: nenhum
  `$fetch`/`useFetch`/`useAsyncData` ou manipulação direta de store no
  componente — sempre extraído para composable dedicado com responsabilidade
  única. Segue convenções do projeto: sem semicolons, aspas simples, 2 espaços,
  trailing commas = none (ESLint + Prettier), casing por tipo de identificador
  (componentes `PascalCase`, composables `use` + camelCase, constantes
  `SCREAMING_SNAKE_CASE`). Usa classes Tailwind e CSS variables de
  `~/assets/css/main.css`. Conhece breakpoints customizados (`3xs`, `2xs`, `xs`,
  `tablet`). Não cria CSS inline. Isolamento em worktree só quando 2+ Devs rodam
  em paralelo sobre arquivos que poderiam conflitar.

  Por padrão, o mesmo Dev também cobre, dentro da subtarefa:
  - **Stores Pinia**: cria/modifica seguindo
    `defineStore('x', { state, getters, actions })`; verifica stores existentes
    antes de criar; garante `storeToRefs()` nos consumidores.
  - **Tipos TypeScript**: mantém `/types/` coeso por domínio (`product`,
    `pagamento`, `orderBumpNew`, `template-skin`); valida contra schemas Zod em
    `/schemas/`.
  - **i18n**: toda string de UI via `$t()`/`useI18n()`, chave criada em `pt` e
    `es` juntas.
  - **Tracking & Analytics**: eventos via GTM (`useGtm`), Facebook Pixel
    (`useFacebookPixel`), Sentry — sem duplicar disparo em fluxos de compra
    existentes.

- **Dev de Stores Pinia / Tipos TypeScript / i18n / Tracking (agente dedicado em
  paralelo)** Mesma responsabilidade dos chapéus acima, mas como agente separado
  — acionar só quando o volume de um chapéu específico é grande o bastante para
  valer o custo de um spawn novo (ex: adicionar type coeso em 10+ arquivos,
  sincronizar 15+ chaves i18n, ou tracking novo cobrindo vários fluxos de compra
  ao mesmo tempo).

- **QA / Test Engineer (1 ou 2 em paralelo — só em tier 🔴 Alta, ou tier 🟡
  quando o critério de aceite exige caso de borda; ver `pipeline.md` Fase 0)**
  Escreve testes com **Vitest** + Vue Test Utils + ambiente jsdom. Testes
  unitários em `camadas/*/test/*.spec.ts` e em `tests/unit/`. Cobre composables,
  stores Pinia e componentes. Não usa PHPUnit nem Cypress — o projeto não tem
  esses frameworks. Fora desses casos, o próprio Dev escreve o teste da unidade
  que implementou.

---

## Regras de uso dos modelos

| Situação                                                              | Modelo   |
| --------------------------------------------------------------------- | -------- |
| Ambiguidade de regra de negócio, decisão de arquitetura cross-camadas | Opus 4.8 |
| Revisão de stores de pagamento, checkout, dados sensíveis             | Opus 4.8 |
| Implementação, testes, tipos, traduções, tracking, componentes Vue    | Sonnet 5 |
| Code review de componentes UI e composables simples                   | Sonnet 5 |
