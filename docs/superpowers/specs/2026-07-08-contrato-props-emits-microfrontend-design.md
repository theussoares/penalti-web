# Design — Contrato de props/emits do PenaltyGame (componente puro)

## Contexto

O card do ClickUp [Microfrontends de Jogos via Module Federation (Vite) + CDN
Cloudflare](https://app.clickup.com/t/9011027745/868h33vce) propõe que os
jogos (Penalti incluso) passem a ser remotes carregados dinamicamente pelo
App Pai (Host), comunicando-se só por props/emits nativos do Vue — sem
acoplamento a build/deploy do Host.

Esse trabalho tem duas frentes grandes e independentes:

1. **Contrato de dados (este spec)** — o `PenaltyGame` parar de buscar dados
   sozinho e virar um componente 100% de apresentação, recebendo tudo pronto
   via prop.
2. **Empacotamento como microfrontend remoto** (Module Federation, CDN,
   versionamento, CSP/CORS) — spec separado, feito depois deste.

Diferente do padrão usado hoje na Roleta
(`play-components-web/src/composables/useGerarSorteio.ts`), que já embute o
conhecimento da API real (`roletas/:nsu`, `roletas/giros/v2`, `otpToken`,
`praca_id`) dentro do jogo, o Penalti deve ficar **agnóstico** — quem builda o
Host decide como busca os dados e como mapeia pra o contrato abaixo; o jogo só
encena.

Hoje (`app/composables/game/useGameSession.ts`) o componente faz fetch
próprio de duas coisas: lista de jogos (`fetchGames`) e sequência de jogadas
(`fetchPlaySequence`), com fallback de mock via `USE_MOCK`/query string
(`app/utils/api-helpers.ts`). Isso tudo sai do componente.

## Contrato de dados

Prop único de entrada — a sequência completa e ordenada de resultados da
sessão, já resolvida pelo Host antes de montar o componente (sem streaming ou
paginação no meio da sessão — cada sessão é uma leva fechada):

```ts
interface PenaltyGameProps {
  resultados: PenaltyPlayResult[]
}
```

`PenaltyPlayResult` continua o mesmo tipo já existente em
`app/types/game.ts` (`tipo_acao`, `tipo_premio`, `nome`, `valor`,
`chave_giro`). A quantidade de chutes "reais" disponíveis e a contagem
regressiva continuam derivadas do próprio array via `chancesRestantes()`
(`app/game/session.ts`), que já filtra `tipo_acao === 'replay'` — isso não
muda.

Emit único de saída — disparado quando o usuário fecha o modal final de fim
de sessão (ganhou ou perdeu tudo):

```ts
defineEmits<{ fechar: [] }>()
```

Nenhum dado de prêmio volta pro Host nesse emit: ele já forneceu `resultados`,
e o resumo final é montado dentro do próprio componente a partir do
`history` acumulado.

`GameInfo`/`MOCK_GAMES`/`fetchGames`/`loadActiveGame` são removidos — não são
usados no template hoje (o texto do telão vem de imagem estática) e não fazem
parte do contrato de sessão.

## Fim de sessão e modais

Hoje, o "chutar tudo" sempre esgota a fila inteira (`podeChutarTudo` exige
`chancesRestantesValue > 1` e `processAllRemainingPlays` consome tudo de uma
vez) — ou seja, **toda sessão termina de exatamente duas formas**: o último
chute individual ou um "chutar tudo". Isso permite unificar o fim de sessão
num fluxo só:

- Chutes que não são o último da fila continuam mostrando o modal individual
  normal (`ModalGol` / `ModalDefendeu` / `ModalChuteExtra`), sem mudança.
- Quando a fila zera (`isSessionOver`), em vez de reabrir o jogo pra um novo
  chute (`jogarNovamente()` hoje faz `resetSession()` + `resetEngine()`), abre
  direto um **modal final único**, calculado sobre `history` (a sessão
  inteira, não só o lote do "chutar tudo" — hoje `useChutarTudo` só soma o
  lote consumido nesse clique, o que já é uma pequena inconsistência que este
  design corrige):
  - `filtrarPremiosGanhados(history)` não vazio → modal de resumo com a lista
    de prêmios ganhos na sessão (reaproveita o layout de
    `ModalResumoChutarTudo.vue`, renomeado/generalizado para não ficar preso
    ao vocabulário "lote").
  - `filtrarPremiosGanhados(history)` vazio → modal simples "não ganhou dessa
    vez", sem lista.
  - O botão desse modal final não é mais "Jogar novamente" — dispara
    `emit('fechar')`.

`useGameModals.ts` ganha os estados de fim de sessão (renomeando/estendendo
`resumo-tudo`) e perde a necessidade de qualquer estado de "reset".

`useGameSession.ts`/`useChutarTudo.ts`/`PenaltyGame.client.vue` perdem
`jogarNovamente()`/`resetSession()`/`resetEngine()` como fluxo de produto —
uma instância do componente serve exatamente uma sessão. Um novo "jogo" é uma
nova montagem do componente (o Host decide isso — ex.: nova compra ⇒ nova
instância do remote).

## Harness de dev (`app/pages/index.vue`)

Toda a lógica hoje em `useGameSession`/`api-helpers.ts` de mock e leitura de
query string (`USE_MOCK`, `?cenario=`, `?api=`, `mockPlayResult`,
`pickScenario`) sai do componente e migra para `pages/index.vue`, que passa a
simular o papel do Host:

- Gera (ou lê de `?cenario=`) um array `PenaltyPlayResult[]` mock e passa via
  `:resultados`.
- Ao receber `@fechar`, gera uma nova sequência mock e incrementa uma `:key`
  no `<PenaltyGame>`, remontando o componente do zero — simula uma "nova
  sessão/compra" pra facilitar teste manual em loop, sem precisar recarregar
  a página.

`app/utils/api-helpers.ts` é reorganizado: os helpers de mock/dev
(`mockPlayResult`, `pickScenario`, `MOCK_GAMES`, `USE_MOCK`, `getApiBaseUrl`,
`delay`) só são usados por `pages/index.vue` daqui pra frente — considerar
renomear o arquivo para deixar isso explícito (ex.
`app/mocks/devHostSimulator.ts`), mantendo `PenaltyPlayResult`/tipos
compartilhados em `app/types/game.ts`.

## Limpeza (achada durante a exploração, parte deste trabalho)

- `app/components/Modais/ModalGol.vue` e `app/components/HistoricoBar.vue`
  importam `PenaltyPlayResult` de `~/composables/useGameApi` — módulo já
  deletado no refactor em andamento. Corrigir import para `~/types/game`.
- `app/composables/useGameApi.spec.ts` testa um módulo que não existe mais —
  remover.
- `ModalGanhou.vue`, `ModalPerdeuTodos.vue`, `ModalResumo.vue`,
  `ModalFecharRaspadinha.vue`, `ModalRasparTodas.vue` (em
  `app/components/Modais/`) são sobras de outro jogo (Raspadinha/Roleta —
  usam `CONFIG_RASPADINHA`, Tailwind, tipos de `@/types/Raspadinha`), não são
  importados em lugar nenhum do Penalti e não seguem o design system atual
  (`ModalArea` + CSS puro). Remover.

## Fora de escopo

- Empacotamento Module Federation, CDN, versionamento, CSP/CORS — spec
  separado, próxima etapa.
- Streaming/paginação de resultados no meio da sessão (decidido: Host sempre
  entrega a sequência completa upfront).
- Qualquer emit de progresso por chute (ex. analytics/webhook) — só o
  `fechar` existe por enquanto; pode ser adicionado depois se surgir a
  necessidade.
- Comportamento real do Host em produção ao receber `fechar` (fechar
  iframe/modal, navegar, etc.) — decisão de quem consome o componente, fora
  do escopo deste projeto.

## Testes

- Lógica pura: `useGameSession`/`session.ts` continuam testáveis sem fetch —
  dado um array `PenaltyPlayResult[]` fixo, verificar `chancesRestantesValue`,
  consumo de fila e `sessaoEncerrada`.
- `filtrarPremiosGanhados(history)` sobre a sessão inteira (não só o lote do
  chutar-tudo) — testar que bate tanto no caminho "último chute individual"
  quanto no caminho "chutar tudo".
- Verificação manual no navegador via harness de `pages/index.vue`: sessão
  chutada um a um até o fim mostra o resumo certo; "chutar tudo" a partir de
  qualquer ponto também mostra o resumo certo (prêmios de antes do chutar
  tudo inclusos); sessão sem nenhum prêmio mostra o modal "não ganhou".
