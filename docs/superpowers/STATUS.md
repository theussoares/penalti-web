# Status do projeto — Penalti Premiado 3D

> Nota de retomada. Última atualização: 2026-07-03 (sessão longa: motor 3D +
> ambientação + fundo de imagem + mira automática). Se você é uma sessão nova
> pegando este projeto, leia isto primeiro, depois os planos/specs
> referenciados abaixo.

## Feito nesta rodada: mira automática + resultado pré-definido pela API

**`docs/superpowers/specs/2026-07-03-mira-automatica-resultado-api-design.md`**
(spec) + **`docs/superpowers/plans/2026-07-03-mira-automatica-resultado-api.md`**
(plano, 5 tasks, executado via `subagent-driven-development`, todas as
tasks + revisão final de branch aprovadas sem Critical/Important) —
a mira deixou de ser por toque/arraste e passou a ser automática (vaivém
esquerda↔direita, altura fixa do goleiro, `WorldLayout.keeperHeight`) com um
botão "Chutar"; o resultado (gol/defesa + prêmio) vem de uma sequência
pré-buscada da API no primeiro chute (`fetchPlaySequence`, reaproveitando o
vocabulário `tipo_acao`/`tipo_premio`/`chave_giro` dos mocks de Roleta), e o
goleiro só "encena" esse resultado já definido — mergulha exato se for
defesa, longe se for gol (`computeDiveTarget`). O desfecho "pra fora" foi
removido (`ShotOutcome` agora é só `'goal' | 'save'`).

Saíram do código (motor 3D e UI, não o motor 2D morto — ver "Decisões
importantes" abaixo): `aimInput.ts` (raycasting de mira por toque),
`decideShot`/`ShotDecision` (`goalkeeperAI.ts`), `submitPlay`/`mockPrize`/
`Prize`/`PrizeType`/`formatMoney` (`useGameApi.ts`), os handlers
`onPointerDown/Move/Up` e o modal de "Pra fora!" (`PenaltyGame.client.vue`).

Pendências abertas desta rodada (Minor, não bloqueantes, registradas na
revisão final):
- `maybeRefill`/`nextPlayResult` (`PenaltyGame.client.vue`) não têm
  `.catch` — inofensivo com `USE_MOCK = true` (a promise nunca rejeita),
  mas travaria o botão "Chutar" permanentemente se a API real falhar.
  Adicionar `try/catch` antes de trocar `USE_MOCK` para `false`.
- `MOCK_GAMES.headline` em `useGameApi.ts` ainda menciona "números da
  sorte", mas esse tipo de prêmio não existe mais na sequência (só
  `valor`/`cota`) — copy desatualizada, cosmético.

## Onde as coisas estão

O jogo foi migrado de Canvas 2D (`app/game/engine.ts`, ainda existe no repo
mas não é mais usado) para Three.js/WebGL (`app/game/engine3d/`), orquestrado
por `PenaltyEngine3D` (`app/game/engine3d/penaltyEngine3d.ts`), já ligado em
`app/components/PenaltyGame.client.vue`.

Quatro rodadas de trabalho até agora:

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
   (plano, 5 tasks) — mira automática + resultado pré-definido pela API (ver
   secção "Feito nesta rodada" acima). Executado via `subagent-driven-development`
   nesta mesma sessão, todas as tasks e a revisão final de branch aprovadas.

**As rodadas 1 e 2 foram executadas por duas sessões de Claude Code rodando
em paralelo no mesmo repositório**, sem coordenação direta entre si — o que
gerou alguma confusão (resets de estado durante testes manuais, hot-reload
cruzado). Se você notar comportamento estranho num teste manual, considere
que pode haver outra sessão mexendo nos mesmos arquivos ao mesmo tempo.

## Decisões importantes já tomadas (não reabrir sem necessidade)

- **Câmera é estática** — sem dolly/shake dinâmico. O usuário pediu
  explicitamente para simplificar isso (ver commit `34012da`).
- **Personagens (goleiro parado/batedor) são procedurais** (cápsulas
  low-poly, `proceduralCharacter.ts`) — não existe pacote gratuito de
  jogador+goleiro riggado com chute/mergulho pronto pra uso.
- **Exceção**: o goleiro usa o modelo `.glb` real fornecido pelo usuário
  (`public/models/goalkeeper-dive.glb`) para TODAS as fases agora (idle com
  o clipe base em loop, e os 3 clipes de mergulho por direção) — o
  procedural só aparece como fallback enquanto o `.glb` carrega
  assíncronamente ou se falhar ao carregar.
- **Sem sombras dinâmicas nem pós-processamento** — tudo sombra falsa
  (`blobShadow.ts`) e `MeshBasicMaterial`, alvo de performance é Android de
  entrada/médio.
- **Bola tem física real de pós-impacto** (gravidade + quique + rede
  segurando no gol) — não congela mais no ar em defesa/fora como numa
  versão intermediária.
- **Fundo é uma imagem estática gerada por IA**, não mais 3D procedural —
  `buildCrowdBillboard`, `buildStadiumLights`, `buildAdBoards` e
  `buildAmbientEffects` (torcida, refletores, telão, fumaça/bandeiras — toda
  a Task 2 do plano de ambientação) **foram removidos do orquestrador**
  (`penaltyEngine3d.ts`) nesta terceira rodada, embora os arquivos-fonte
  ainda existam em `app/game/engine3d/` sem uso. `buildFieldAtmosphere`
  (partículas/sheen) foi o único efeito ambiente 3D mantido, como brilho
  sutil por cima da foto. O renderer roda com `alpha: true` para a imagem
  aparecer atrás da cena WebGL.

## Pendências conhecidas

1. **Task 16 do plano `motor-3d-threejs.md`** (remover `app/game/engine.ts`,
   o motor 2D antigo) — ainda não foi feita. O arquivo continua no repo, sem
   uso. Fazer só depois de ter certeza que o motor 3D está estável.
2. **Revisão final de branch** (whole-diff review) do plano `motor-3d-threejs.md`
   (rodada 1) antes de considerar a migração 100% fechada — ainda não rodada.
   (A revisão final da rodada 4 — mira automática — já rodou e foi aprovada,
   ver secção "Feito nesta rodada".)
3. **Limpeza de histórico do git**: dois arquivos binários grandes foram
   commitados sem querer direto no histórico (fora do fluxo normal, via
   commits manuais do usuário) e já foram enviados ao GitHub:
   - Um `.glb` de ~10.6MB (commit `c068e7d`)
   - Um `.glb` de ~9.78MB (commit posterior)
   Ambos já foram removidos do HEAD atual (substituídos pelas versões
   comprimidas em `public/models/`), mas continuam ocupando espaço no
   histórico. Limpeza (`git filter-repo`/BFG + `push --force`) foi
   **adiada deliberadamente pelo usuário** — não fazer sem confirmar de
   novo, já que exige force-push.
4. **Modais/mocks de "Roleta"** (`app/components/Modais/*`,
   `app/mocks/*`) — arquivos de outro projeto da empresa (jogo de
   raspadinha/roleta, "Baú do Milhão"), com imports quebrados
   (`@/types/Roleta`, `@/stores/roletaTestMode` não existem aqui, projeto
   não tem Pinia). O usuário pediu para usar **só como referência
   visual/estrutural** para os modais de prêmio do jogo de pênalti, e depois
   apagar — isso ficou pendente, nunca foi retomado depois que o foco virou
   o motor 3D. Os modais de vitória/derrota atuais continuam embutidos
   direto em `PenaltyGame.client.vue` (funcionam, mas não usam o estilo dos
   arquivos de Roleta).
5. **Convenção de commit**: este repo não tem `ssh-agent` rodando para a
   chave SSH configurada como `gpg.format=ssh` — todo commit precisa de
   `git commit --no-gpg-sign` (autorizado explicitamente pelo usuário). Não
   tentar reabilitar assinatura nem usar `git commit` puro sem confirmar
   antes.
6. Sem `vue-tsc`/lint configurado no projeto — cada implementador tipa
   manualmente sem `any` implícito; não há checagem automática de tipos no
   CI/build local além dos testes Vitest (`npm run test:unit`, cobre só a
   lógica pura: `worldGeometry`, `goalkeeperAI`, `ballFlight`, `netRipple`).
7. **Cosmético, achado na revisão da Task 5 de `ambientacao-premio.md`**:
   `fieldAtmosphere.ts` tem uma função `respawnParticle` morta (nunca
   chamada — a lógica equivalente está duplicada inline dentro de
   `buildParticles`'s `update()`), com um cast `as unknown as {...}`
   type-unsafe. Não afeta o funcionamento, só limpeza pendente.

## Se for continuar

- Os planos (`motor-3d-threejs.md`, `ambientacao-premio.md`,
  `mira-automatica-resultado-api.md`) têm o checklist de tasks marcado — dá
  pra ver rapidamente o que falta em cada um.
- Antes de mexer em `app/game/engine3d/*`, rode `git status` e `git log
  --oneline -10` para confirmar que não há outra sessão com mudanças não
  commitadas no meio do caminho (ver aviso acima sobre sessões paralelas).
- O ledger de execução (subagent-driven-development) está em
  `.superpowers/sdd/progress.md` (gitignored, local apenas) — tem o histórico
  completo da rodada 1 e da rodada 4 (mira automática); a rodada 2
  (ambientação) foi tocada por outra sessão sem esse ledger.
- Próximos passos sugeridos, nenhum decidido ainda: (a) trocar `USE_MOCK`
  por uma API real em `useGameApi.ts` (exige antes o `try/catch` no
  `PenaltyGame.client.vue` citado na secção "Feito nesta rodada"); (b) Task
  16 de `motor-3d-threejs.md` (remover o motor 2D morto); (c) retomar os
  modais de Roleta como referência visual (pendência 4 abaixo).
