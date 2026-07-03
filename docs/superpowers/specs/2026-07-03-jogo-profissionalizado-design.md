# Design — Profissionalizar o jogo: sessão de chances, histórico, chutar tudo e modais da Roleta

## Contexto

O motor 3D e a mecânica de mira automática + resultado pré-definido pela API
já estão prontos e testados (ver
`docs/superpowers/specs/2026-07-03-mira-automatica-resultado-api-design.md`).
Hoje o jogo é "infinito": busca lotes de 10 resultados e reabastece pra
sempre, sem noção de quantas chances o jogador tem.

Este round aproxima o jogo do padrão já usado na Roleta/Raspadinha da
empresa ("Baú do Milhão", projeto `play-components-web/src/components/Roleta`,
consultado diretamente para este design): sessão com quantidade finita de
chances vinda da API, histórico visível, um botão de jogar tudo de uma vez,
prêmio de replay (chute extra), e modais reais (não mais cards inline) no
mesmo padrão estrutural da Roleta.

## Contrato de dados (atualizado)

Replay existe como prêmio, igual à Roleta:

```ts
export interface PenaltyPlayResult {
  id: number
  chave_giro: string
  tipo_acao: 'ganhou' | 'nao_ganhou' | 'replay'
  tipo_premio: 'valor' | 'cota' | 'nao_ganhou' | 'replay'
  nome: string
  valor: string | null
}
```

`useGameApi.fetchPlaySequence(gameId)` passa a ser chamado **uma única vez
por sessão**, no primeiro clique em "Chutar", retornando a sequência inteira
já decidida (mock: tamanho fixo configurável, `MOCK_SESSION_SIZE = 5`).
Remove-se `SEQUENCE_BATCH_SIZE`/`REFILL_THRESHOLD`/`maybeRefill` — não há
mais reabastecimento automático, a sessão é finita.

## Modelo de chances

Direto do padrão comprovado em `useGirarRoleta.ts` (`finalizarGiro`):

- `playQueue: PenaltyPlayResult[]` — fila com os itens ainda não jogados
  (inclui replays, na ordem que vieram da API).
- `history: PenaltyPlayResult[]` — itens já consumidos, em ordem.
- `chancesRestantes = playQueue.filter(r => r.tipo_acao !== 'replay').length`
  — contador exibido ao jogador. Replays não contam.
- Botão "Chutar" fica habilitado enquanto `playQueue.length > 0` (não
  `chancesRestantes > 0`) — um replay pendente no fim da fila ainda precisa
  ser jogado mesmo que o contador já mostre 0, exatamente como
  `girosDisponiveis` na Roleta permanece a fonte de verdade só para
  prêmios reais.
- Sessão encerrada quando `playQueue.length === 0` após consumir o último
  item. Nesse ponto, o botão de confirmação do modal do último chute vira
  "Jogar novamente": busca uma sequência nova (`fetchPlaySequence`) e
  reresta `history`/`chancesRestantes`.

## Fluxo do replay ("Chute Extra")

Quando `tipo_acao === 'replay'`:

- A engine ainda anima o chute normalmente (bola voa, goleiro pula) — decisão
  já validada com o usuário. A animação pedida à engine é sempre `'save'`
  (arbitrário; não há resultado real em jogo).
- Não decrementa `chancesRestantes`.
- Modal mostrado: **"Chute Extra! Essa cobrança não contou como chance."**
  (`ModalChuteExtra.vue`, novo componente, modelado em espírito no
  `ModalReplay.vue` da Roleta, sem a lógica de PIX/checkout que lá existe).
- Entra no histórico com um ícone próprio (diferente de gol/defesa).
- No fluxo de "Chutar tudo", um replay no meio do lote só é pulado como mais
  um item da fila (sem decrementar), igual ao loop de
  `confirmarGirarTodas`.

## Barra de histórico

Faixa horizontal fixa acima do botão "Chutar", mostrando os últimos 8 itens
de `history` como ícones pequenos:
- Verde (bola/troféu) = `ganhou`
- Cinza/vermelho (X) = `nao_ganhou`
- Azul (seta circular) = `replay`

Mais recente entra por um lado da fila, mais antigo sai (lista sempre com no
máximo 8 itens visíveis). **Nota de escopo**: a Roleta tem um carrossel SVG
navegável por swipe, com arte própria da marca — não vamos replicar esse
componente específico, só o conceito de "faixa de histórico visível acima
do botão de ação". Nossa versão é estática (sem swipe), só para leitura
rápida do padrão recente.

## Contador de chances sobre o telão

Um badge no mesmo estilo "vidro" já usado no HUD (`.mute-btn`), ancorado
dentro da área do `.jumbotron` (onde hoje só tem a logo), mostrando
"X chances restantes". Atualiza sempre que `chancesRestantes` muda.

## Botão "Chutar tudo"

Abaixo do "Chutar", estilo secundário (outline). Direto do padrão
`abrirModalGirarTodas`/`confirmarGirarTodas`:

- **Desabilitado** se `chancesRestantes <= 1` (não compensa "tudo" com 0 ou
  1 chance real restante) ou se há um chute em andamento.
- Clique → modal de confirmação (`ModalChutarTudoConfirm.vue`, modelado no
  `ModalRasparTodas.vue`): "Deseja chutar tudo automaticamente? Seus
  resultados vão ser entregues a seguir."
- Confirmar → **não** re-anima a engine por item (evita 5+ animações de
  goleiro em sequência, ~2-3s cada). Em vez disso, mostra um loading curto
  (~1.2-2s, barra de progresso, mesmo visual do `ModalRasparTodas`) enquanto
  resolve **todos os itens restantes da fila de uma vez só nos dados**
  (`playQueue` inteira é consumida, cada item empurrado em `history`,
  `chancesRestantes` zera). Isso reproduz fielmente o comportamento real de
  `confirmarGirarTodas` na Roleta (loop síncrono sobre os dados, sem
  re-disparar a animação de giro por item).
- Ao terminar, mostra `ModalResumoChutarTudo.vue` (modelado no
  `ModalResumo.vue`): lista só os prêmios ganhos no lote (`ganhou` com
  `tipo_premio` `valor`/`cota`; replays e derrotas não aparecem na lista,
  igual ao filtro `filtrarPremiosGanhados`/`premiosGirarTudo` da Roleta).
  Botão final "Jogar novamente" (nova sessão) já que a fila zerou.

## Modais (adaptados da Roleta, sem Pinia/checkout/PIX)

Recriamos a estrutura (não os arquivos com import quebrado) dentro de
`app/components/Modais/` deste projeto:

- `ModalArea.vue` — wrapper genérico de overlay+card (adaptado do
  `ModalArea.vue` da Roleta, tema fixo dark-green/dourado já usado nos
  cards inline atuais, sem o inject de `ConfigRaspadinhaProps`).
- `Botao.vue` — botão pill reutilizável (`default`/`outline`/`red`),
  adaptado do `Botao.vue` da Roleta, cores hardcoded (sem inject de tema).
- `ModalGol.vue` — substitui o card de vitória inline atual (mesmo
  conteúdo visual: confete, prêmio).
- `ModalDefendeu.vue` — substitui o card de derrota inline atual.
- `ModalChuteExtra.vue` — novo, replay (ver seção acima).
- `ModalChutarTudoConfirm.vue` — confirmação + progresso do lote (ver seção
  "Chutar tudo").
- `ModalResumoChutarTudo.vue` — resumo final do lote (ver seção "Chutar
  tudo").
- `ModalController.vue` — substitui os `v-if` inline em
  `PenaltyGame.client.vue`, decide qual modal mostrar a partir do estado
  do jogo (modelado no papel do `ModalBase.vue`/`RoletaModalBase.vue`).

Ficam de fora (não existem nesse domínio): resgate de prêmio via PIX,
modo checkout, confirmação de fechamento de roleta, mascote/skins.

## Mocks para testar fluxos

Novo `app/mocks/penaltySequences.ts`, cenários nomeados no formato
`PenaltyPlayResult[]` (equivalente aos da Roleta, adaptado — agora com
replay de verdade):

- `TODAS_DERROTAS`, `TODOS_GANHOS_VALOR`, `TODOS_GANHOS_COTA`,
  `TODOS_REPLAYS`, `ALTERNADO`, `VALORES_ALTOS`,
  `REPLAY_DEPOIS_GANHO`.

Selecionável via query string, mesma convenção já usada para `?api=`:
`?cenario=todas_derrotas` força `useGameApi` a devolver esse array fixo em
vez da sequência aleatória, só quando `USE_MOCK` está ativo.

## Fora de escopo

- Resgate de prêmio via PIX/checkout (não existe nesse jogo).
- Carrossel de histórico navegável por swipe com arte própria (versão
  estática simplificada, ver seção "Barra de histórico").
- Tratamento especial de "último chute manual = resumo consolidado" —
  na Roleta, o último giro manual (não em lote) também pode virar um modal
  de resumo (`tipoModalGanhou = 'girouTudo'`) se fechar a sessão. Aqui, o
  último chute manual mostra o modal normal (Gol/Defendeu/Chute Extra) com
  o botão trocado para "Jogar novamente" — sem consolidar múltiplos prêmios
  em um resumo único nesse caso. Só o fluxo "Chutar tudo" gera resumo.
- Persistência de sessão entre recarregamentos de página.
- `try/catch` em torno das chamadas de API reais (pendência já registrada
  em `docs/superpowers/STATUS.md`, não faz parte deste round).

## Testes

- Lógica pura: cálculo de `chancesRestantes` (filtra replay), decisão de
  fim de sessão (`playQueue.length === 0`), filtro de prêmios ganhos para
  o resumo do "Chutar tudo".
- Mock `fetchPlaySequence`: sequência única por sessão, respeitando
  `?cenario=`.
- Verificação manual: contador no telão atualiza a cada chute; barra de
  histórico reflete a ordem certa incluindo replay; "Chutar tudo" desabilita
  com 0/1 chance; modal de resumo lista só os prêmios corretos; sessão
  reinicia corretamente após zerar.
