# Status do projeto — Penalti Premiado 3D

> Nota de retomada. Última atualização: 2026-07-03 (sessão longa: motor 3D +
> ambientação + fundo de imagem + mira automática + jogo profissionalizado +
> modelo real do batedor). Se você é uma sessão nova pegando este projeto,
> leia isto primeiro, depois os planos/specs referenciados abaixo.

## Feito nesta rodada: modelo real do batedor + histórico no telão

Sem spec/plano formal — trabalho direto de continuação, pendência já
documentada abaixo (commit `d789ba7`):

- **`jogador_final.glb`** (fornecido pelo usuário, com idle e chute,
  11.6MB) comprimido para `public/models/kicker-run-kick.glb` (1.23MB)
  via `gltf-transform optimize` (meshopt + webp); bruto movido para
  `raw-assets/jogador-final.glb` (gitignorado, mesmo padrão do goleiro).
  Loader novo em `app/game/engine3d/kickerModel.ts`, espelhando
  `keeperDiveModel.ts`. **Detalhe importante**: o `.glb` só tem 2 clipes
  (`mixamo.com` = idle, nome padrão que o Mixamo dá quando não
  renomeado; `Kick` = chute) — **sem ciclo de corrida dedicado**. O idle
  toca em loop também durante o `runup` (o deslocamento até a bola
  sempre foi só posição, não animação). O clipe de chute usa uma janela
  de tempo mais generosa (`TIMINGS.strike + TIMINGS.flight`, não só
  `strike`) para não ficar comprimido a ~12x a velocidade. Escala
  calibrada visualmente em `KICKER_SCALE = 0.024` — o `.glb` bruto usa
  uma unidade de mundo ~40x maior que metros (bbox do bind pose tem
  ~71 de altura). Mesmo padrão do goleiro: o modelo real assume TODAS
  as fases assim que carrega; o procedural (`proceduralCharacter.ts`)
  só aparece como fallback durante o carregamento assíncrono.
- **Histórico movido para o telão**: `HistoricoBar` saiu de cima dos
  botões de chute e passou a ficar dentro do `.jumbotron`, abaixo do
  logo — pedido explícito do usuário ("mover", não duplicar).

Verificado no navegador: idle/corrida/chute do novo modelo sem erros de
console, goleiro real seguiu funcionando normalmente, histórico aparece
no telão com o ícone certo por resultado (gol/defendeu/replay).
`npm run test:unit`: 34/34.

**Nota de ferramenta**: durante esta rodada, `preview_screenshot` e
`preview_eval` travaram por ~1min logo após uma sequência de edições
rápidas + reinício automático do Nuxt (Vite re-otimizando dependências
ao descobrir `three` dinamicamente) — não era bug do app (zero erros no
console, `document.title` respondia normal via eval). Resolvido
parando e subindo o preview de novo (`preview_stop` + `preview_start`),
que criou uma aba nova. Se acontecer de novo, tentar isso antes de
assumir que é regressão de código.

## Feito na rodada anterior: jogo profissionalizado (sessão de chances, histórico, chutar tudo, replay, modais da Roleta)

**`docs/superpowers/specs/2026-07-03-jogo-profissionalizado-design.md`**
(spec) + **`docs/superpowers/plans/2026-07-03-jogo-profissionalizado.md`**
(plano, 8 tasks, executado via `subagent-driven-development`, todas as
tasks + revisão final de branch aprovadas sem Critical/Important) — o jogo
deixou de ser "infinito" (lotes de 10 resultados reabastecidos pra sempre) e
passou a ter uma **sessão de chances finita vinda da API**:

- `fetchPlaySequence` agora é chamado **uma única vez por sessão**, no
  primeiro "Chutar" (`MOCK_SESSION_SIZE = 5` no mock). Removidos
  `SEQUENCE_BATCH_SIZE`/`REFILL_THRESHOLD`/`maybeRefill`/`nextPlayResult`.
- **Prêmio de replay ("Chute Extra")**: `tipo_acao`/`tipo_premio` ganharam o
  valor `'replay'` (igual ao padrão real da Roleta, confirmado direto no
  código-fonte de `play-components-web/src/components/Roleta`). Replay não
  decrementa `chancesRestantes` (`app/game/session.ts`), mas ainda precisa
  ser "jogado" (a sessão só acaba quando a fila fica vazia,
  `isSessionOver`). O goleiro anima normalmente (fisicamente sempre como
  `'save'`, já que a engine só tem `'goal'|'save'`), e quem decide o modal
  certo é `onResult()` lendo `tipo_acao`, não o resultado físico.
- **Contador de chances** (`.chances-hud`) sobre o telão, e **barra de
  histórico** (`HistoricoBar.vue`, últimos 8 resultados com ícone por tipo)
  acima do botão "Chutar".
- **"Chutar tudo"**: habilitado com mais de 1 chance restante. Ao contrário
  da primeira ideia (re-animar a engine por chute), segue o padrão real da
  Roleta (`confirmarGirarTodas` em `useGirarRoleta.ts`) — resolve todos os
  itens restantes **só nos dados**, com um loading falso de 1.5s, sem
  disparar `engine.shoot()` por item. Modal de confirmação + progresso
  (`ModalChutarTudoConfirm.vue`) e resumo final só com os prêmios ganhos
  (`ModalResumoChutarTudo.vue`, via `filtrarPremiosGanhados`).
- **Modais reais**: os cards de vitória/derrota inline em
  `PenaltyGame.client.vue` viraram componentes de verdade em
  `app/components/Modais/` — `ModalArea`/`Botao` (base reutilizável),
  `ModalGol`/`ModalDefendeu`/`ModalChuteExtra` (resultado),
  `ModalChutarTudoConfirm`/`ModalResumoChutarTudo` (lote). Estruturados no
  mesmo espírito dos modais da Roleta, mas sem Pinia/PIX/checkout (não
  existem nesse projeto).
- **Mocks de cenário fixo** (`app/mocks/penaltySequences.ts`,
  `PENALTY_SCENARIOS`) selecionáveis via `?cenario=<chave>` (ex.
  `?cenario=todas_derrotas`) para testar fluxos manualmente sem depender do
  gerador aleatório — chaves disponíveis: `todas_derrotas`,
  `todos_ganhos_valor`, `todos_ganhos_cota`, `todos_replays`, `alternado`,
  `valores_altos`, `replay_depois_ganho`.

Verificação manual feita direto nesta sessão (não por subagente, já que
exige interação com o navegador via Claude Preview): fluxo normal,
`todas_derrotas` (5x "Defendeu!", "Jogar novamente" no último),
`todos_replays` (5x "Chute Extra!", contador nunca decrementa, sessão
termina por fila vazia mesmo com contador em 0 o tempo todo), `alternado` +
"Chutar tudo" (resumo lista só o prêmio ganho certo, exclui replay/derrota),
"Chutar tudo" desabilitado com ≤1 chance — tudo passou, zero erros de
console. `npm run test:unit`: 34 testes, 8 arquivos, tudo verde.

**Nota de ferramenta** (não é bug do jogo): durante a verificação manual,
clicar via `document.querySelector(...).click()` dentro de `preview_eval`
produziu 4 invocações fantasmas do mesmo handler por clique (unrelated à
lógica do app — confirmado com uma instrumentação temporária de
`console.log` depois revertida). Usar sempre `preview_click`/`preview_fill`
para interação real nesse projeto; `preview_eval` só para leitura de
estado/DOM.

## Onde as coisas estão

O jogo foi migrado de Canvas 2D (`app/game/engine.ts`, ainda existe no repo
mas não é mais usado) para Three.js/WebGL (`app/game/engine3d/`), orquestrado
por `PenaltyEngine3D` (`app/game/engine3d/penaltyEngine3d.ts`), já ligado em
`app/components/PenaltyGame.client.vue`.

Seis rodadas de trabalho até agora:

1. **`docs/superpowers/specs/2026-07-03-motor-3d-threejs-design.md`** (spec) +
   **`docs/superpowers/plans/2026-07-03-motor-3d-threejs.md`** (plano, 16
   tasks) — motor gráfico base: geometria de mundo, IA do goleiro portada
   1:1, física de bola/rede, personagem procedural, câmera, mira por
   raycast, e integração do modelo real do goleiro (`.glb` fornecido pelo
   usuário, comprimido com `gltf-transform` para ~635KB, com 4 clipes:
   `DiveLeft`/`DiveRight`/`CatchCenter`/clipe base de idle).
2. **`docs/superpowers/plans/2026-07-03-ambientacao-premio.md`** (plano, 5
   tasks) — segunda rodada de polimento visual 3D: partículas/sheen no
   gramado, fumaça + bandeirinhas atrás do gol, LED giratório de anúncios,
   refletores com pulso, torcida com celebração de gol (onda + flashes).
3. **Sem plano formal** — troca da ambientação 3D procedural por uma imagem
   de fundo gerada por IA (`public/images/stadium-bg-{portrait,landscape}.webp`,
   escolhida por proporção de tela via JS em `PenaltyGame.client.vue`, canvas
   3D transparente por cima mostrando só gol/bola/personagens/sombras). Feito
   direto (sem SDD formal) por já estar em modo de iteração visual rápida com
   o usuário. Commit `4c83f05`.
4. **`docs/superpowers/specs/2026-07-03-mira-automatica-resultado-api-design.md`**
   (spec) + **`docs/superpowers/plans/2026-07-03-mira-automatica-resultado-api.md`**
   (plano, 5 tasks) — mira automática (vaivém esquerda↔direita, altura fixa
   do goleiro) com botão "Chutar"; resultado vem pronto da API antes da
   jogada, goleiro só encena (`computeDiveTarget`). Desfecho "pra fora"
   removido (`ShotOutcome` só `'goal'|'save'`).
5. **`docs/superpowers/specs/2026-07-03-jogo-profissionalizado-design.md`**
   (spec) + **`docs/superpowers/plans/2026-07-03-jogo-profissionalizado.md`**
   (plano, 8 tasks) — sessão de chances finita, replay/"Chute Extra",
   contador de chances, barra de histórico, "Chutar tudo", modais reais
   estruturados como os da Roleta.
6. **Sem plano formal** — modelo real do batedor (`jogador_final.glb`)
   integrado, histórico movido para o telão (ver secção "Feito nesta
   rodada" acima). Commit `d789ba7`.

**As rodadas 1 e 2 foram executadas por duas sessões de Claude Code rodando
em paralelo no mesmo repositório**, sem coordenação direta entre si. Isso
**terminou** a partir da rodada 4 — o usuário confirmou explicitamente que só
há uma sessão trabalhando no projeto agora.

## Decisões importantes já tomadas (não reabrir sem necessidade)

- **Câmera é estática** — sem dolly/shake dinâmico. O usuário pediu
  explicitamente para simplificar isso (ver commit `34012da`).
- **Personagens são procedurais só como fallback** (cápsulas low-poly,
  `proceduralCharacter.ts`) — não existe pacote gratuito de
  jogador+goleiro riggado com chute/mergulho pronto pra uso, então os
  rigs procedurais existem apenas para cobrir a janela assíncrona antes
  do `.glb` real carregar (ou se falhar ao carregar). **Os dois
  personagens (goleiro e batedor) já usam modelo real para TODAS as
  fases** — ver os dois itens abaixo.
- O goleiro usa `public/models/goalkeeper-dive.glb` (idle com o clipe
  base em loop, e os 3 clipes de mergulho por direção).
- O batedor usa `public/models/kicker-run-kick.glb` (rodada 6): idle em
  loop (`mixamo.com`) também durante a corrida (não há clipe de corrida
  dedicado — o deslocamento até a bola sempre foi só posição) e `Kick`
  no chute. Escala calibrada em `KICKER_SCALE = 0.024`
  (`penaltyEngine3d.ts`) — o `.glb` bruto usa uma unidade de mundo ~40x
  maior que metros, não mexer nesse valor sem entender o porquê.
- **Sem sombras dinâmicas nem pós-processamento** — tudo sombra falsa
  (`blobShadow.ts`) e `MeshBasicMaterial`, alvo de performance é Android de
  entrada/médio.
- **Bola tem física real de pós-impacto** (gravidade + quique + rede
  segurando no gol) — não congela mais no ar em defesa/fora como numa
  versão intermediária.
- **Fundo é uma imagem estática gerada por IA**, não mais 3D procedural —
  `buildCrowdBillboard`, `buildStadiumLights`, `buildAdBoards` e
  `buildAmbientEffects` **foram removidos do orquestrador**
  (`penaltyEngine3d.ts`), embora os arquivos-fonte ainda existam em
  `app/game/engine3d/` sem uso. `buildFieldAtmosphere` (partículas/sheen)
  foi o único efeito ambiente 3D mantido. O renderer roda com `alpha: true`
  para a imagem aparecer atrás da cena WebGL.
- **Sessão de jogo é finita e vem da API** (rodada 5) — nada de
  reabastecimento automático de resultados; replay não conta como chance
  mas ainda precisa ser jogado; "Chutar tudo" resolve em lote só nos dados,
  sem re-animar a engine por item.

## Pendências conhecidas

1. ~~Integrar `jogador_final.glb`~~ — **feito na rodada 6** (commit `d789ba7`).
2. **Task 16 do plano `motor-3d-threejs.md`** (remover `app/game/engine.ts`,
   o motor 2D antigo) — ainda não foi feita. O arquivo continua no repo, sem
   uso. Fazer só depois de ter certeza que o motor 3D está estável.
3. **Revisão final de branch** (whole-diff review) do plano `motor-3d-threejs.md`
   (rodada 1) antes de considerar a migração 100% fechada — ainda não rodada.
   (As revisões finais das rodadas 4 e 5 já rodaram e foram aprovadas.)
4. **Limpeza de histórico do git**: dois arquivos binários grandes foram
   commitados sem querer direto no histórico (fora do fluxo normal, via
   commits manuais do usuário) e já foram enviados ao GitHub:
   - Um `.glb` de ~10.6MB (commit `c068e7d`)
   - Um `.glb` de ~9.78MB (commit posterior)
   Ambos já foram removidos do HEAD atual (substituídos pelas versões
   comprimidas em `public/models/`), mas continuam ocupando espaço no
   histórico. Limpeza (`git filter-repo`/BFG + `push --force`) foi
   **adiada deliberadamente pelo usuário** — não fazer sem confirmar de
   novo, já que exige force-push.
5. **Arquivos soltos de "Roleta" ainda sem uso**: `app/components/Modais/ModalBase.vue`,
   `ModalGanhou.vue`, `ModalReplay.vue`, `ModalResumo.vue`,
   `ModalRasparTodas.vue`, `ModalPerdeuTodos.vue`, `ModalErro.vue`,
   `ModalFecharRaspadinha.vue` e `app/mocks/index.ts` vieram de um commit
   manual anterior do usuário (`19dbb8f`) como referência da Roleta, têm
   imports quebrados (`@/types/Roleta`, Pinia) e **não são usados por
   nenhum código** — `PenaltyGame.client.vue` importa só os 5 modais novos
   de `app/components/Modais/` (`ModalGol`/`ModalDefendeu`/`ModalChuteExtra`/
   `ModalChutarTudoConfirm`/`ModalResumoChutarTudo`, ver rodada 5). Seguro
   apagar quando alguém tiver um momento, mas não bloqueia nada.
6. **Convenção de commit**: este repo não tem `ssh-agent` rodando para a
   chave SSH configurada como `gpg.format=ssh` — todo commit precisa de
   `git commit --no-gpg-sign` (autorizado explicitamente pelo usuário). Não
   tentar reabilitar assinatura nem usar `git commit` puro sem confirmar
   antes.
7. Sem `vue-tsc`/lint configurado no projeto — cada implementador tipa
   manualmente sem `any` implícito; não há checagem automática de tipos no
   CI/build local além dos testes Vitest (`npm run test:unit`, cobre só a
   lógica pura: `worldGeometry`, `goalkeeperAI`, `ballFlight`, `netRipple`,
   `session`, `useGameApi`, `penaltySequences`).
8. **Cosmético, achado na revisão da Task 5 de `ambientacao-premio.md`**:
   `fieldAtmosphere.ts` tem uma função `respawnParticle` morta (nunca
   chamada — a lógica equivalente está duplicada inline dentro de
   `buildParticles`'s `update()`), com um cast `as unknown as {...}`
   type-unsafe. Não afeta o funcionamento, só limpeza pendente.
9. **Real API ainda não existe** — `USE_MOCK = true` em `useGameApi.ts`.
   Trocar por uma API real exige revisar o contrato descrito no topo do
   arquivo (`GET /games`, `GET /games/{id}/play-sequence?count=N`).

## Se for continuar

- Os planos (`motor-3d-threejs.md`, `ambientacao-premio.md`,
  `mira-automatica-resultado-api.md`, `jogo-profissionalizado.md`) têm o
  checklist de tasks marcado — dá pra ver rapidamente o que falta em cada um.
- Antes de mexer em `app/game/engine3d/*` ou `PenaltyGame.client.vue`, rode
  `git status` — o usuário às vezes edita esses arquivos diretamente no
  editor dele enquanto uma sessão está rodando testes automatizados, o que
  pode parecer um bug transitório (HMR falhando, estado preso) sem ser um.
- O ledger de execução (subagent-driven-development) está em
  `.superpowers/sdd/progress.md` (gitignored, local apenas) — tem o
  histórico completo das rodadas 1, 4 e 5; a rodada 2 (ambientação) foi
  tocada por outra sessão sem esse ledger.
- Próximos passos sugeridos, nenhum decidido ainda: (a) trocar `USE_MOCK`
  por uma API real (pendência 9); (b) Task 16 de `motor-3d-threejs.md`
  (remover o motor 2D morto, pendência 2); (c) apagar os arquivos soltos de
  Roleta sem uso (pendência 5); (d) revisão final de branch do plano
  `motor-3d-threejs.md`, rodada 1 (pendência 3).
