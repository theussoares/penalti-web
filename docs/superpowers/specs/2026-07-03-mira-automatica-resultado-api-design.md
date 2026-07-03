# Design — Mira automática + resultado pré-definido pela API

## Contexto

Hoje o jogo calcula o resultado (gol/defesa/pra fora) a partir de onde o
jogador mira, via toque/arraste na tela, com uma IA de goleiro que reage
probabilisticamente (`app/game/engine3d/goalkeeperAI.ts`, `decideShot()`).

O usuário quer inverter essa lógica para bater com o modelo de negócio já
usado em outros jogos da empresa (Roleta/Raspadinha, cujos mocks foram
enviados no início do trabalho neste projeto — `app/mocks/index.ts`,
`app/components/Modais/*`): **o resultado (ganhou/não ganhou, e o prêmio) é
decidido pelo backend antes da jogada**, e o jogo só encena visualmente esse
resultado já definido. O goleiro passa a ser "combinado" com o resultado, não
mais uma fonte de aleatoriedade própria.

Isso também simplifica a interação: em vez de mirar por toque/arraste, um
indicador de mira se move sozinho da esquerda para a direita (vaivém) numa
altura fixa (altura do goleiro) dentro do gol, e o jogador aperta um botão
"Chutar" no momento que quiser.

## Fluxo do jogador

1. Jogo carrega, goleiro e batedor em pé, mira automática já oscilando
   esquerda↔direita dentro do gol.
2. Botão **"Chutar"** substitui o texto "Sua vez"/dica atual.
3. Jogador aperta "Chutar":
   - **Primeiro chute da sessão**: chama a API (`useGameApi.ts`), mostra um
     estado de espera curto (botão desabilitado + indicador de carregamento;
     a mira continua oscilando visualmente para não parecer travado), recebe
     de volta a **sequência inteira de resultados** dos próximos chutes, e
     consome o primeiro item dessa sequência.
   - **Chutes seguintes**: consome o próximo item já em memória, sem nova
     chamada de API (sem espera).
4. A posição da mira **no instante do toque** é congelada como o alvo do
   chute. A animação de chute/mergulho toca:
   - `tipo_acao === 'nao_ganhou'`: goleiro mergulha **exatamente** para o
     alvo congelado — defende sempre, não importa onde a mira estava.
   - `tipo_acao === 'ganhou'`: goleiro mergulha para um ponto **longe o
     suficiente** do alvo congelado (lado oposto ou distância maior que o
     alcance do mergulho) — vira gol sempre.
5. Modal de resultado (vitória/derrota) segue como hoje, com o prêmio vindo
   do item da sequência consumido.

## Contrato de dados (API)

Reaproveita o vocabulário já usado nos mocks de Roleta (`tipo_acao`,
`tipo_premio`, `chave_giro`), adaptado ao domínio de pênalti — sem o valor
`'replay'` (não existe replay no pênalti) e sem números da sorte específicos
em `tipo_premio: 'cota'` (por enquanto, `'cota'` é só uma quantidade; o
backend real pode evoluir isso depois).

```ts
export interface PenaltyPlayResult {
  id: number
  /** Identificador unico da jogada, mesmo padrao dos mocks de Roleta. */
  chave_giro: string
  tipo_acao: 'ganhou' | 'nao_ganhou'
  tipo_premio: 'valor' | 'cota' | 'nao_ganhou'
  /** Texto de exibicao, ex: "R$ 50,00" ou "5 Cotas". */
  nome: string
  valor: string | null
}
```

`useGameApi.ts` ganha:

```ts
fetchPlaySequence(gameId: string, count: number): Promise<PenaltyPlayResult[]>
```

Mock: gera uma sequência aleatória de `count` itens (ganhou/não ganhou
alternando com probabilidade razoável, ex. ~35% de chance de ganhar por
item, valores de prêmio variados). Quando a sequência acabar, busca mais
uma leva automaticamente (sem o jogador perceber — só o primeiro chute da
sessão tem espera visível).

O `submitPlay`/`mockPrize` atuais são removidos — não fazem mais sentido
com resultado pré-definido.

## Simplificações no motor 3D

- **`aimInput.ts` (raycasting de toque) é removido.** Não há mais
  toque/arraste — a mira é só um valor `x` de mundo oscilando entre
  `aimBounds.minX` e `aimBounds.maxX`, numa altura fixa constante (não mais
  variável). `WorldLayout.aimBounds` perde a necessidade de `minY`/`maxY`
  para fins de mira (o gol em si continua tendo altura, só a mira não varia
  mais nela).
- **`goalkeeperAI.ts` muda de "calcula resultado" para "calcula posição do
  mergulho dado o resultado"**:
  ```ts
  export function computeDiveTarget(
    outcome: 'goal' | 'save',
    aimX: number,
    layout: WorldLayout,
    rng?: () => number
  ): Vec2
  ```
  Se `outcome === 'save'`: retorna `{ x: aimX, y: keeperHeight }` (mergulho
  exato). Se `outcome === 'goal'`: retorna um ponto a uma distância maior
  que o alcance do goleiro em relação a `aimX` (lado oposto, ou o mais
  distante dentro do gol), usando `rng` só para variar qual lado/altura
  visualmente, nunca para decidir o resultado em si (que já é dado).
- **`PenaltyEngine3D` ganha um método público novo**:
  ```ts
  shoot(outcome: 'goal' | 'save'): void
  ```
  chamado pelo componente Vue depois que a API responde (ou depois de
  consumir o próximo item da sequência já em memória). Os handlers
  `onPointerDown/onPointerMove/onPointerUp` e a lógica de `screenToAim` são
  removidos do motor. A mira automática (oscilação) roda internamente no
  loop de `update()`, expondo a posição atual via callback ou getter para o
  componente Vue desenhar o indicador visual (se o indicador for parte da
  cena 3D, como o `aimReticle.ts` atual, nem precisa expor nada — o próprio
  motor já sabe a posição no momento de `shoot()`).
- **Desfecho "pra fora" é removido.** `ShotOutcome` passa a ser só
  `'goal' | 'save'` (tipo em `app/game/types.ts`). O estado `EngineState`
  continua igual (`ready → aiming → runup → strike → flight → aftermath →
  done`), só que `aiming` agora representa "mira automática rodando,
  esperando o toque no botão" em vez de "jogador arrastando".

## Mudanças na UI (`PenaltyGame.client.vue`)

- Hint atual ("Sua vez" / texto explicativo) vira um **botão "Chutar"**,
  desabilitado durante o carregamento do primeiro chute e durante a
  animação de qualquer chute.
- Estado de carregamento do primeiro chute: botão mostra spinner ou texto
  "Carregando...", mira continua visível oscilando.
- Modal de derrota perde a distinção "defendeu" vs "pra fora" — só existe
  "Defendeu!" agora. Texto de incentivo continua.
- Modal de vitória com `tipo_premio: 'cota'` mostra a quantidade (`nome`,
  ex. "5 Cotas") em vez da lista de chips de números da sorte atual (já que
  `'cota'` não carrega números específicos neste momento).

## Fora de escopo

- Números da sorte específicos para `tipo_premio: 'cota'` (fica pra quando
  o backend real definir isso).
- Qualquer replay/giro extra (não existe no domínio de pênalti).
- Persistir/sincronizar a sequência entre sessões (cada carregamento de
  página busca uma sequência nova).
- Reconstrução visual dos modais no estilo dos arquivos de Roleta — isso
  continua uma tarefa separada e pendente (ver `docs/superpowers/STATUS.md`).

## Testes

- Lógica pura testável: `computeDiveTarget()` (novo) substitui os testes de
  `decideShot()` — testar que `outcome: 'save'` sempre produz
  `diveTarget.x === aimX`, e que `outcome: 'goal'` sempre produz uma
  distância maior que o alcance do goleiro em relação a `aimX`, para
  qualquer `aimX` dentro de `aimBounds`.
- Mock de `fetchPlaySequence`: testar que gera `count` itens e que
  respeita o formato `PenaltyPlayResult`.
- Verificação manual no navegador: mira oscila visualmente, botão
  desabilita durante espera/animação, resultado sempre bate com
  `tipo_acao` da sequência (gol quando `ganhou`, defesa quando
  `nao_ganhou`, independente de onde a mira estava no toque).
