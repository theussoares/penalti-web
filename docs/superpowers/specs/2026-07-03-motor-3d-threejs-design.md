# Design — Motor gráfico 3D (Canvas 2D → Three.js/WebGL)

## Contexto

O jogo Penalti Premiado hoje é renderizado inteiramente em Canvas 2D
([app/game/engine.ts](../../../app/game/engine.ts)), com personagens desenhados
como bonecos de vetor procedural (membros como cápsulas), torcida como textura
2D pré-renderizada e câmera fixa com zoom/shake simulados via `ctx.translate`.

O usuário forneceu um vídeo/print de referência (jogo de pênalti da MarketJS)
que usa personagens 3D riggados com animação esqueletal, câmera dinâmica que
acompanha a bola, e rede física em 3D. O objetivo desta task é reconstruir a
camada visual do jogo em Three.js/WebGL para chegar nesse nível, **preservando
toda a lógica de jogo já validada** (mira, IA do goleiro, cálculo de
resultado, API mockada, sons, HUD e modais).

Um segundo tema (recriar os modais de prêmio em [app/components/Modais/](../../../app/components/Modais)
e os mocks em [app/mocks/](../../../app/mocks)) foi identificado durante a
exploração como **fora de escopo deste spec**: esses arquivos foram colados de
outro projeto da empresa (um jogo de Roleta/Raspadinha — "Baú do Milhão"), com
imports quebrados (`@/types/Roleta`, `@/stores/roletaTestMode` não existem
neste repo, que também não tem Pinia instalado) e vocabulário incompatível
(giros, cotas, raspar). Serão usados **apenas como referência visual/estrutural**
e depois apagados; a reconstrução dos modais de prêmio para o domínio de
pênalti (gol/defesa/prêmio) será tratada em um agente separado, em paralelo,
com spec próprio.

## Decisões já validadas com o usuário

- Sem o pipeline multi-agente pesado (PO/CTO/Arquiteto) descrito em
  `agents.md`/`pipeline.md` — esses arquivos foram copiados do repositório da
  plataforma principal (que usa camadas/Pinia) e não se aplicam a este app
  standalone. Trabalho executado em sessão direta.
- Alvo de performance: **Android de entrada/médio** (o jogo roda em webview de
  app mobile). Toda decisão de performance abaixo prioriza rodar liso nesse
  perfil, mesmo perdendo fidelidade visual vs. a referência.
- Abordagem escolhida: **híbrida** — personagens, bola, rede e câmera em 3D
  real; torcida continua como textura 2D (billboard), não modelada em 3D.
- Câmera com travelling simples no chute; **corte de replay/ângulo de
  comemoração fica fora do escopo do v1**.
- Sem sombras dinâmicas (shadow maps) nem pós-processamento no v1.
- Ao final, o motor 2D antigo (`engine.ts`) é removido — não fica mantido como
  fallback com toggle.

## Arquitetura

- Novo arquivo `app/game/engine3d.ts`, exportando `PenaltyEngine3D`, com a
  **mesma interface pública** de `PenaltyEngine` hoje:
  - `constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks)`
  - `reset(): void`, `destroy(): void`, `state: EngineState` (getter/campo)
  - Reaproveita os tipos `ShotOutcome` e `EngineState` (movidos para um
    arquivo compartilhado, ex. `app/game/types.ts`, para não duplicar).
- [PenaltyGame.client.vue](../../../app/components/PenaltyGame.client.vue) só
  troca a instanciação (`new PenaltyEngine` → `new PenaltyEngine3D`). HUD,
  scoreboard, hint, modais de vitória/derrota e mute continuam exatamente como
  estão — são Vue/DOM por cima do canvas, não fazem parte da mudança.
- Única dependência nova: pacote `three` (import por módulos ES para permitir
  tree-shaking; sem React-three-fiber/Vue-three — mantém o padrão atual de
  classe imperativa dona do próprio loop de render, agora usando
  `THREE.WebGLRenderer({ canvas })` no lugar de `CanvasRenderingContext2D`).

## Personagens e animação

- **Modelos**: tentativa de baixar glTF riggado livre via GitHub — candidato
  concreto: os arquivos de exemplo do próprio repositório do three.js
  (`Soldier.glb`/`Xbot.glb`), riggados com animações base (idle/run),
  redistribuíveis e hospedados em repositório acessível mesmo com rede
  restrita. Materiais recolorizados para amarelo/azul (batedor) e preto
  (goleiro).
- **Fallback procedural** (se o download falhar ou o rig não servir): rig
  construído por código — hierarquia de `Object3D` (tronco, cabeça, braços,
  coxas, canelas) com `CapsuleGeometry`/`BoxGeometry`. As curvas de pose por
  fase do movimento são **portadas do desenho de membros 2D já ajustado**
  (commits recentes "Humaniza a anatomia do batedor" / "Corrige camadas e
  proporções do batedor") para rotações de joint em 3D, em vez de descartar
  esse trabalho.
- Expectativa honesta: no cenário de fallback procedural, o resultado é
  estilizado low-poly (padrão Kenney/Quaternius) — acima do 2D atual, porém
  com menos detalhe de rosto/textura que a referência.

## Câmera, mira e IA do goleiro

- **Câmera**: posição padrão atrás do batedor, travelling sutil (dolly +
  lookAt) acompanhando a bola durante o chute, shake no impacto — mesma
  magnitude usada hoje, agora como movimento real de câmera 3D.
- **Mira**: mesmo gesto de toque/arrastar/soltar. O ponto de toque na tela é
  convertido via raycast da câmera contra um plano na profundidade do gol,
  virando coordenada 3D; os limites do gol e o disparo do chute seguem o
  mesmo fluxo de hoje.
- **IA do goleiro e outcome (`goal`/`save`/`out`)**: porte **1:1** da lógica
  atual (`guessRight = Math.random() < 0.58`, raio de alcance do mergulho,
  etc.), só trocando pixels de tela por coordenadas de mundo — para não mudar
  a dificuldade/sensação do jogo.

## Torcida, rede e bola

- **Torcida**: continua 2D. Reaproveita o gerador de textura já existente
  (`renderCrowdLayers` — dois quadros com crossfade + pulo no gol) aplicado
  como `CanvasTexture` numa placa 3D atrás do gol, em vez de desenhado direto
  no canvas.
- **Rede**: grade em `THREE.LineSegments`; deslocamento por vértice usando a
  mesma matemática de ondulação (`netDisplacement`) já existente, migrada
  para posições de mundo 3D.
- **Bola**: esfera com textura procedural de gomos (gerada via canvas, mesmo
  estilo atual), arco de voo com a mesma curva de tempo/altura de hoje agora
  em 3 eixos, com rotação de spin real.

## Performance (alvo: Android de entrada)

- Sem sombras dinâmicas (shadow maps) — sombra de contato via sprite elíptico
  semi-transparente sob os personagens (mesmo truque que o 2D já usa).
- `antialias: false`, `devicePixelRatio` limitado a 1.5 (hoje é 2).
- Sem pós-processamento (bloom etc.) no v1.
- Personagens procedurais na casa de poucas centenas de triângulos cada; o
  maior custo de GPU é preenchimento de tela do fundo/estádio, não geometria.

## Fora de escopo (v1)

- Corte de câmera/replay na comemoração do gol.
- Sombras dinâmicas e pós-processamento.
- Reconstrução dos modais de prêmio (tratada em spec/agente separado).
- Suporte a modelos glTF customizados fornecidos pelo usuário (a estrutura
  ficará compatível, mas a troca de asset não faz parte desta entrega).

## Testagem/verificação

- Sem testes unitários novos (renderização WebGL não é unit-testável de forma
  significativa com Vitest).
- Verificação manual via dev server + browser preview: fluxo de mira→chute
  cobrindo os três desfechos (gol/defesa/fora), sensação da IA do goleiro
  equivalente à versão 2D, câmera sem cortes/clipping em resize (retrato
  mobile), e checagem de FPS em condições comparáveis a Android de entrada.
