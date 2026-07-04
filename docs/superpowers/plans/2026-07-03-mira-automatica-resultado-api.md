# Mira Automática + Resultado Pré-Definido pela API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a mira por toque/arraste por uma mira automática (vaivém esquerda↔direita, altura fixa) com botão "Chutar", e o resultado (gol/defesa + prêmio) passa a vir pré-definido de uma sequência buscada da API no primeiro chute, com o goleiro apenas encenando esse resultado.

**Architecture:** O goleiro deixa de decidir o resultado (`decideShot` sai) e passa a só calcular a posição do mergulho dado um resultado já definido (`computeDiveTarget`). O motor 3D ganha um método público `shoot(outcome)` chamado pelo Vue depois que a API responde; a mira deixa de depender de eventos de ponteiro (raycasting sai) e passa a ser uma oscilação senoidal interna ao loop de `update()`. `useGameApi.ts` ganha `fetchPlaySequence()` (mock local) substituindo `submitPlay`/mockPrize.

**Tech Stack:** TypeScript, Three.js, Vue 3 Composition API, Vitest.

## Global Constraints

- Todo commit usa `git commit --no-gpg-sign` (sem `ssh-agent` configurado para a chave SSH neste repo).
- Sem `vue-tsc`/lint configurado no projeto — tipar manualmente, sem `any` implícito. `npm run test:unit` só cobre lógica pura (novos testes deste plano incluídos); a UI e o motor 3D em si são verificados manualmente no navegador.
- `ShotOutcome` passa a ser só `'goal' | 'save'` — todo código que trata `'out'` como terceiro caso deve ser simplificado, não mantido como branch morto.
- Não existe replay no domínio de pênalti (`tipo_acao` nunca é `'replay'`) e não há números da sorte específicos para `tipo_premio: 'cota'` neste momento — não inventar esses dados.
- Não reconstruir os modais no estilo dos arquivos de `Roleta/` — isso é tarefa separada, fora de escopo aqui (ver `docs/superpowers/STATUS.md`).
- Não alterar `app/game/engine.ts` (motor 2D antigo, já sem uso, remoção é tarefa separada — Task 16 de `motor-3d-threejs.md`).
- Cada sequência buscada da API é local à sessão de página (sem persistência entre recarregamentos).

---

### Task 1: `WorldLayout.keeperHeight` + `ShotOutcome` sem `'out'`

**Files:**

- Modify: `app/game/engine3d/worldGeometry.ts`
- Modify: `app/game/engine3d/worldGeometry.spec.ts`
- Modify: `app/game/types.ts`
- Modify: `app/game/types.spec.ts`

**Interfaces:**

- Produces: `WorldLayout.keeperHeight: number` (altura fixa, eixo Y, da mira automática e do mergulho "certeiro" do goleiro) — consumido pelas Tasks 2 e 4. `ShotOutcome = 'goal' | 'save'` — consumido por todas as tasks seguintes.

- [ ] **Step 1: Escrever os testes que falham**

Em `app/game/engine3d/worldGeometry.spec.ts`, adicione dentro do `describe('computeWorldLayout', ...)`, depois do teste `'define aimBounds dentro da area do gol, com margem'`:

```ts
it("define keeperHeight dentro dos limites verticais do gol", () => {
  const layout = computeWorldLayout();
  expect(layout.keeperHeight).toBeGreaterThan(layout.aimBounds.minY);
  expect(layout.keeperHeight).toBeLessThan(layout.aimBounds.maxY);
});
```

Em `app/game/types.spec.ts`, substitua o corpo do teste `'aceita os valores validos de ShotOutcome'`:

```ts
it("aceita os valores validos de ShotOutcome", () => {
  const outcomes: ShotOutcome[] = ["goal", "save"];
  expect(outcomes).toHaveLength(2);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test:unit -- worldGeometry types`
Expected: FAIL — `layout.keeperHeight` é `undefined` (`toBeGreaterThan`/`toBeLessThan` falham com `undefined`); o teste de `ShotOutcome` já passa sozinho (é só tipo, sem checagem de runtime além do `toHaveLength`) mas troque mesmo assim para manter o array em sincronia com o tipo.

- [ ] **Step 3: Implementar**

Em `app/game/types.ts`, troque a linha 5:

```ts
export type ShotOutcome = "goal" | "save";
```

Em `app/game/engine3d/worldGeometry.ts`, substitua o arquivo inteiro por:

```ts
import type { Vec2 } from "../types";

export interface AimBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WorldLayout {
  goalWidth: number;
  goalHeight: number;
  goalPostRadius: number;
  goalDepth: number;
  goalCenterX: number;
  goalLineZ: number;
  spotZ: number;
  ballRadius: number;
  /** Altura fixa (eixo Y) da mira automatica e do mergulho "certeiro" do goleiro. */
  keeperHeight: number;
  aimBounds: AimBounds;
}

const GOAL_WIDTH = 7.32;
const GOAL_HEIGHT = 2.44;
const PENALTY_SPOT_DISTANCE = 11;
const AIM_MARGIN = 0.22;
const KEEPER_HEIGHT = 1.3;

export function computeWorldLayout(): WorldLayout {
  const goalCenterX = 0;
  const goalLineZ = 0;
  return {
    goalWidth: GOAL_WIDTH,
    goalHeight: GOAL_HEIGHT,
    goalPostRadius: 0.06,
    goalDepth: 1.1,
    goalCenterX,
    goalLineZ,
    spotZ: goalLineZ + PENALTY_SPOT_DISTANCE,
    ballRadius: 0.11,
    keeperHeight: KEEPER_HEIGHT,
    aimBounds: {
      minX: goalCenterX - GOAL_WIDTH / 2 + AIM_MARGIN,
      maxX: goalCenterX + GOAL_WIDTH / 2 - AIM_MARGIN,
      minY: AIM_MARGIN,
      maxY: GOAL_HEIGHT - AIM_MARGIN,
    },
  };
}

export function clampAim(x: number, y: number, bounds: AimBounds): Vec2 {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
  };
}
```

(`clampAim`/`AimBounds.minY`/`maxY` continuam existindo — só deixam de ser alimentados por toque do jogador a partir da Task 4; a Task 1 só acrescenta `keeperHeight`.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test:unit -- worldGeometry types`
Expected: PASS (todos os testes de `worldGeometry.spec.ts` e `types.spec.ts`)

- [ ] **Step 5: Commit**

```bash
git add app/game/types.ts app/game/types.spec.ts app/game/engine3d/worldGeometry.ts app/game/engine3d/worldGeometry.spec.ts
git commit --no-gpg-sign -m "feat: adiciona keeperHeight ao WorldLayout e remove outcome 'out'"
```

---

### Task 2: `computeDiveTarget()` substitui `decideShot()`

**Files:**

- Modify: `app/game/engine3d/goalkeeperAI.ts`
- Modify: `app/game/engine3d/goalkeeperAI.spec.ts`

**Interfaces:**

- Consumes: `WorldLayout` (Task 1, com `keeperHeight`), `Vec2` de `../types`.
- Produces: `computeDiveTarget(outcome: 'goal' | 'save', aimX: number, layout: WorldLayout, rng?: () => number): Vec2` e `KEEPER_REACH_FACTOR: number` (exportados) — consumidos pela Task 4. `decideShot`/`ShotDecision` deixam de existir.

- [ ] **Step 1: Escrever o teste que falha**

Substitua `app/game/engine3d/goalkeeperAI.spec.ts` inteiro por:

```ts
import { describe, expect, it } from "vitest";
import { computeDiveTarget, KEEPER_REACH_FACTOR } from "./goalkeeperAI";
import { computeWorldLayout } from "./worldGeometry";

function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("computeDiveTarget", () => {
  const layout = computeWorldLayout();
  const reach = layout.goalHeight * KEEPER_REACH_FACTOR;
  const sampleAimXs = [
    layout.aimBounds.minX,
    layout.aimBounds.minX / 2,
    layout.goalCenterX,
    layout.aimBounds.maxX / 2,
    layout.aimBounds.maxX,
  ];

  it('outcome "save" sempre mergulha exatamente no aimX, na altura do goleiro', () => {
    for (const aimX of sampleAimXs) {
      const target = computeDiveTarget("save", aimX, layout, seq(0.3));
      expect(target.x).toBeCloseTo(aimX);
      expect(target.y).toBe(layout.keeperHeight);
    }
  });

  it('outcome "goal" sempre mergulha a uma distancia maior que o alcance do aimX', () => {
    for (const aimX of sampleAimXs) {
      const target = computeDiveTarget("goal", aimX, layout, seq(0.9));
      const dist = Math.hypot(target.x - aimX, target.y - layout.keeperHeight);
      expect(dist).toBeGreaterThan(reach);
    }
  });

  it('outcome "goal" mergulha para o lado oposto do aimX', () => {
    const rightAim = layout.aimBounds.maxX;
    const target = computeDiveTarget("goal", rightAim, layout, seq(0.1));
    expect(target.x).toBeLessThan(rightAim);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test:unit -- goalkeeperAI`
Expected: FAIL — `computeDiveTarget`/`KEEPER_REACH_FACTOR` não existem em `./goalkeeperAI` (erro de import/undefined).

- [ ] **Step 3: Implementar**

Substitua `app/game/engine3d/goalkeeperAI.ts` inteiro por:

```ts
import type { Vec2 } from "../types";
import type { WorldLayout } from "./worldGeometry";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Fracao da altura do gol usada como "alcance" do goleiro a partir do
 * ponto de mergulho — usada so pelos testes para confirmar que o mergulho
 * de "goal" sempre fica fora de alcance. `computeDiveTarget` nunca calcula
 * resultado a partir dela — so usa o lado oposto do gol, que ja garante
 * distancia maior por construcao.
 */
export const KEEPER_REACH_FACTOR = 0.36;

/**
 * O goleiro nao decide mais o resultado (isso vem pronto da API, ver
 * `PenaltyPlayResult` em `useGameApi.ts`) — so calcula PARA ONDE ele
 * mergulha dado um resultado ja definido. `outcome: 'save'` mergulha exato
 * no alvo (defende sempre); `outcome: 'goal'` mergulha para o lado oposto
 * do gol (erra sempre, distancia sempre maior que o alcance).
 */
export function computeDiveTarget(
  outcome: "goal" | "save",
  aimX: number,
  layout: WorldLayout,
  rng: () => number = Math.random,
): Vec2 {
  const { aimBounds, goalCenterX, keeperHeight } = layout;

  if (outcome === "save") {
    return { x: aimX, y: keeperHeight };
  }

  const farX = aimX <= goalCenterX ? aimBounds.maxX : aimBounds.minX;
  const rowsY = [
    lerp(aimBounds.minY, aimBounds.maxY, 0.68),
    lerp(aimBounds.minY, aimBounds.maxY, 0.18),
  ];
  const y = rng() < 0.5 ? rowsY[0]! : rowsY[1]!;
  return { x: farX, y };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test:unit -- goalkeeperAI`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add app/game/engine3d/goalkeeperAI.ts app/game/engine3d/goalkeeperAI.spec.ts
git commit --no-gpg-sign -m "feat: goleiro calcula posicao do mergulho a partir de resultado ja decidido"
```

---

### Task 3: `useGameApi.ts` — `fetchPlaySequence` substitui `submitPlay`

**Files:**

- Modify: `app/composables/useGameApi.ts`
- Create: `app/composables/useGameApi.spec.ts`

**Interfaces:**

- Produces: `PenaltyPlayResult` (interface), `fetchPlaySequence(gameId: string, count: number): Promise<PenaltyPlayResult[]>` — consumido pela Task 5. `GameInfo`/`fetchGames` continuam iguais. `Prize`/`PrizeType`/`submitPlay`/`formatMoney` deixam de existir.

- [ ] **Step 1: Escrever os testes que falham**

Crie `app/composables/useGameApi.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { useGameApi } from "./useGameApi";

describe("useGameApi", () => {
  it("fetchPlaySequence retorna exatamente `count` itens no formato PenaltyPlayResult", async () => {
    const { fetchPlaySequence } = useGameApi();
    const results = await fetchPlaySequence("penalty-premiado", 15);
    expect(results).toHaveLength(15);
    for (const r of results) {
      expect(typeof r.id).toBe("number");
      expect(typeof r.chave_giro).toBe("string");
      expect(["ganhou", "nao_ganhou"]).toContain(r.tipo_acao);
      expect(["valor", "cota", "nao_ganhou"]).toContain(r.tipo_premio);
      expect(typeof r.nome).toBe("string");
      expect(r.valor === null || typeof r.valor === "string").toBe(true);
    }
  });

  it('tipo_acao "nao_ganhou" sempre vem com tipo_premio "nao_ganhou", e "ganhou" nunca vem com ele', async () => {
    const { fetchPlaySequence } = useGameApi();
    const results = await fetchPlaySequence("penalty-premiado", 60);
    for (const r of results) {
      if (r.tipo_acao === "nao_ganhou")
        expect(r.tipo_premio).toBe("nao_ganhou");
      if (r.tipo_acao === "ganhou")
        expect(r.tipo_premio).not.toBe("nao_ganhou");
    }
  });

  it("gera pelo menos uma vitoria e uma derrota numa amostra grande", async () => {
    const { fetchPlaySequence } = useGameApi();
    const results = await fetchPlaySequence("penalty-premiado", 80);
    expect(results.some((r) => r.tipo_acao === "ganhou")).toBe(true);
    expect(results.some((r) => r.tipo_acao === "nao_ganhou")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test:unit -- useGameApi`
Expected: FAIL — `fetchPlaySequence` não existe no objeto retornado por `useGameApi()`.

- [ ] **Step 3: Implementar**

Substitua `app/composables/useGameApi.ts` inteiro por:

```ts
/**
 * Camada de dados do jogo.
 *
 * CONTRATO DA API (a implementar no backend):
 *
 *   GET {apiBase}/games
 *     -> { games: GameInfo[] }                        lista de jogos disponiveis
 *
 *   GET {apiBase}/games/{id}/play-sequence?count=N
 *     -> { results: PenaltyPlayResult[] }              proxima leva de resultados ja decididos
 *
 * O resultado de cada chute (ganhou/nao_ganhou + premio) vem pronto do
 * backend antes da jogada — o motor 3D so encena visualmente o que ja foi
 * decidido (ver docs/superpowers/specs/2026-07-03-mira-automatica-resultado-api-design.md).
 * Vocabulario (tipo_acao/tipo_premio/chave_giro) reaproveitado dos mocks de
 * Roleta (app/mocks/index.ts), adaptado ao penalti: sem 'replay' (nao
 * existe no dominio) e sem numeros da sorte especificos em
 * tipo_premio: 'cota' por enquanto.
 *
 * Enquanto a API real nao existe, `USE_MOCK = true` gera sequencias
 * aleatorias localmente. Para plugar a API real basta definir
 * `USE_MOCK = false` e configurar `apiBase` via runtime config ou pela
 * query string `?api=https://sua-api.com`.
 */

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  /** Chamada exibida no topo do jogo, ex: "Valendo R$ 500" */
  headline: string;
  active: boolean;
}

export interface PenaltyPlayResult {
  id: number;
  /** Identificador unico da jogada, mesmo padrao dos mocks de Roleta. */
  chave_giro: string;
  tipo_acao: "ganhou" | "nao_ganhou";
  tipo_premio: "valor" | "cota" | "nao_ganhou";
  /** Texto de exibicao, ex: "R$ 50,00" ou "5 Cotas". */
  nome: string;
  valor: string | null;
}

const USE_MOCK = true;

const MOCK_GAMES: GameInfo[] = [
  {
    id: "penalty-premiado",
    name: "Penalti Premiado",
    description: "Venca o goleiro e ganhe na hora.",
    headline: "Valendo premios em dinheiro e numeros da sorte",
    active: true,
  },
];

const WIN_CHANCE = 0.35;
const MONEY_PRIZES = [
  "R$ 5,00",
  "R$ 10,00",
  "R$ 25,00",
  "R$ 50,00",
  "R$ 100,00",
];
const COTA_PRIZES = ["1 Cota", "3 Cotas", "5 Cotas", "10 Cotas"];

let mockIdCounter = 0;

function mockPlayResult(): PenaltyPlayResult {
  const id = ++mockIdCounter;
  const chave_giro = `penalti_${id}`;
  if (Math.random() >= WIN_CHANCE) {
    return {
      id,
      chave_giro,
      tipo_acao: "nao_ganhou",
      tipo_premio: "nao_ganhou",
      nome: "Nao foi dessa vez",
      valor: null,
    };
  }
  if (Math.random() < 0.4) {
    const nome = COTA_PRIZES[Math.floor(Math.random() * COTA_PRIZES.length)]!;
    return {
      id,
      chave_giro,
      tipo_acao: "ganhou",
      tipo_premio: "cota",
      nome,
      valor: nome.split(" ")[0]!,
    };
  }
  const nome = MONEY_PRIZES[Math.floor(Math.random() * MONEY_PRIZES.length)]!;
  return {
    id,
    chave_giro,
    tipo_acao: "ganhou",
    tipo_premio: "valor",
    nome,
    valor: nome.replace(/[^\d,]/g, ""),
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useGameApi() {
  const apiBase = (() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("api") ?? "";
  })();

  async function fetchGames(): Promise<GameInfo[]> {
    if (USE_MOCK || !apiBase) {
      await delay(120);
      return MOCK_GAMES;
    }
    const res = await fetch(`${apiBase}/games`);
    if (!res.ok) throw new Error(`Falha ao carregar jogos: ${res.status}`);
    const data = (await res.json()) as { games: GameInfo[] };
    return data.games;
  }

  async function fetchPlaySequence(
    gameId: string,
    count: number,
  ): Promise<PenaltyPlayResult[]> {
    if (USE_MOCK || !apiBase) {
      await delay(250);
      return Array.from({ length: count }, mockPlayResult);
    }
    const res = await fetch(
      `${apiBase}/games/${gameId}/play-sequence?count=${count}`,
    );
    if (!res.ok)
      throw new Error(`Falha ao buscar sequencia de jogadas: ${res.status}`);
    const data = (await res.json()) as { results: PenaltyPlayResult[] };
    return data.results;
  }

  return { fetchGames, fetchPlaySequence };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test:unit -- useGameApi`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add app/composables/useGameApi.ts app/composables/useGameApi.spec.ts
git commit --no-gpg-sign -m "feat: useGameApi busca sequencia de resultados pre-definidos em vez de submitPlay"
```

---

### Task 4: Mira automática + `shoot()` público no `PenaltyEngine3D`

**Files:**

- Modify: `app/game/engine3d/penaltyEngine3d.ts`
- Delete: `app/game/engine3d/aimInput.ts`

**Interfaces:**

- Consumes: `computeDiveTarget`/`KEEPER_REACH_FACTOR` (Task 2), `WorldLayout.keeperHeight` (Task 1).
- Produces: `PenaltyEngine3D.shoot(outcome: 'goal' | 'save'): void` (método público novo) — consumido pela Task 5. `screenToAim`/`onPointerDown`/`onPointerMove`/`onPointerUp` deixam de existir; `PenaltyEngine3D.reset()`/`.destroy()`/`.state`/constructor continuam com a mesma assinatura.

Este arquivo não tem teste automatizado dedicado (é uma classe que monta cena WebGL — sem mock de canvas no projeto). A verificação é: `npm run test:unit` completo continua passando (garante que nada nas Tasks 1-3 quebrou) e checagem manual no navegador de que a cena carrega sem erro (o fluxo completo de jogar só fica testável depois da Task 5, que é quem chama `shoot()`).

- [ ] **Step 1: Implementar**

Substitua `app/game/engine3d/penaltyEngine3d.ts` inteiro por:

```ts
import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Mesh,
  Scene,
  WebGLRenderer,
} from "three";
import type { EngineCallbacks, EngineState, ShotOutcome, Vec2 } from "../types";
import type { Character } from "./character";
import { createCharacter } from "./character";
import { buildBallMesh } from "./ballMesh";
import { arcHeight, ballFlightPosition } from "./ballFlight";
import { buildAimReticle, type AimReticle } from "./aimReticle";
import { buildBlobShadow } from "./blobShadow";
import { buildCameraRig, type CameraRig } from "./cameraRig";
import { buildFieldAtmosphere, type FieldAtmosphere } from "./fieldAtmosphere";
import { buildGoalFrame } from "./goalFrameMesh";
import { computeDiveTarget } from "./goalkeeperAI";
import { buildNetMesh, type NetMesh } from "./netMesh";
import type { Ripple } from "./netRipple";
import { computeWorldLayout, type WorldLayout } from "./worldGeometry";
import { loadKeeperDiveModel, type KeeperDiveModel } from "./keeperDiveModel";

const TIMINGS = { runup: 0.72, strike: 0.16, flight: 0.5, aftermath: 1.35 };
/** Velocidade angular (rad/s) do vaivem da mira automatica — ciclo completo em ~5.2s. */
const AUTO_AIM_SPEED = 1.2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class PenaltyEngine3D {
  private canvas: HTMLCanvasElement;
  private cb: EngineCallbacks;
  private renderer: WebGLRenderer;
  private cameraRig: CameraRig;
  private layout: WorldLayout;
  private clock = new Clock();
  private raf = 0;
  private destroyed = false;

  state: EngineState = "ready";
  private stateStart = 0;

  /** Posicao X atual da mira automatica (vaivem esquerda<->direita). */
  private autoAimX = 0;
  private shotTarget: Vec2 = { x: 0, y: 0 };
  private outcome: ShotOutcome = "goal";
  private diveTarget: Vec2 = { x: 0, y: 0 };

  private ballStart = { x: 0, y: 0.11, z: 0 };
  private ballEnd = { x: 0, y: 0.11, z: 0 };
  private ballPos = { x: 0, y: 0.11, z: 0 };
  /** Velocidade da bola no pos-impacto (rebote/queda), em m/s. */
  private ballVel = { x: 0, y: 0, z: 0 };
  /** Corrida de aproximacao do batedor: de onde parte e onde chuta. */
  private kickerStartPos = { x: -1.7, z: 0 };
  private kickerKickPos = { x: -0.35, z: 0 };
  private ripples: Ripple[] = [];
  private resultSent = false;

  private scene = new Scene();
  private ballMesh: Mesh;
  private netMesh: NetMesh;
  private fieldAtmosphere: FieldAtmosphere;
  private aimReticle: AimReticle;
  private ballShadow: Mesh;
  private kickerShadow: Mesh;
  private kicker: Character;
  private keeper: Character;
  private keeperDiveModel: KeeperDiveModel | null = null;
  /** Modelo real presente na cena (substituiu o procedural apos carregar). */
  private diveModelActive = false;
  /** Clipe de mergulho ja disparado neste lance. */
  private divePlayed = false;

  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.cb = callbacks;
    this.layout = computeWorldLayout();
    this.ballStart = { x: 0, y: this.layout.ballRadius, z: this.layout.spotZ };
    this.ballPos = { ...this.ballStart };
    this.autoAimX = this.layout.goalCenterX;
    // Aproximacao curta em diagonal: o suficiente para dar vida ao runup
    // sem tirar o batedor do enquadramento (fov estreito) nem deixa-lo
    // gigante na frente da camera.
    this.kickerStartPos = { x: -1.7, z: this.layout.spotZ + 0.9 };
    this.kickerKickPos = { x: -0.35, z: this.layout.spotZ + 0.35 };

    // alpha:true + clear color transparente para o fundo estatico (foto de
    // estadio gerada por IA, ver PenaltyGame.client.vue) aparecer por tras
    // da cena 3D — so o gol/bola/personagens/sombras sao WebGL de verdade
    // agora; torcida, refletores, telao e fumaca vem da foto.
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "low-power",
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    // shadowMap.enabled fica false (padrao) de proposito: sem sombras dinamicas no v1.

    this.cameraRig = buildCameraRig();

    this.scene.add(new AmbientLight(0xffffff, 0.7));
    const sun = new DirectionalLight(0xfff2d0, 0.8);
    sun.position.set(-4, 8, 6);
    this.scene.add(sun);

    this.scene.add(buildGoalFrame(this.layout));

    this.ballMesh = buildBallMesh(this.layout.ballRadius);
    this.scene.add(this.ballMesh);

    this.netMesh = buildNetMesh(this.layout);
    this.scene.add(this.netMesh.mesh);

    this.aimReticle = buildAimReticle(
      this.layout.ballRadius,
      this.layout.goalLineZ,
    );
    this.scene.add(this.aimReticle.object3D);

    // Brilho/particulas sutis sobre o gramado da foto — unico efeito
    // ambiente que sobra em 3D, o resto (torcida/refletores/telao/fumaca)
    // ja vem da imagem de fundo.
    this.fieldAtmosphere = buildFieldAtmosphere(this.layout);
    this.scene.add(this.fieldAtmosphere.object3D);

    // Sombras falsas coladas no gramado (sem sombra dinamica no v1).
    this.ballShadow = buildBlobShadow(this.layout.ballRadius * 2.2);
    this.scene.add(this.ballShadow);
    this.kickerShadow = buildBlobShadow(0.5);
    this.scene.add(this.kickerShadow);
    const keeperShadow = buildBlobShadow(0.55);
    keeperShadow.position.set(0, 0.01, this.layout.goalLineZ - 0.1);
    this.scene.add(keeperShadow);

    this.kicker = createCharacter("kicker");
    this.kicker.object3D.position.set(
      this.kickerStartPos.x,
      0,
      this.kickerStartPos.z,
    );
    this.scene.add(this.kicker.object3D);

    this.keeper = createCharacter("keeper");
    this.keeper.object3D.position.set(0, 0, this.layout.goalLineZ - 0.1);
    this.scene.add(this.keeper.object3D);

    void this.loadDiveModelAsync();

    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);

    this.raf = requestAnimationFrame(this.frame);
    // Mira automatica ja comeca rodando — nao ha mais toque para inicia-la.
    this.setState("aiming");
  }

  private async loadDiveModelAsync() {
    this.keeperDiveModel = await loadKeeperDiveModel();
    if (!this.keeperDiveModel || this.destroyed) return;
    // Modelo real assume o goleiro em todas as fases (idle em loop com o
    // clipe base do .glb); o procedural fica so como fallback de carga.
    this.scene.remove(this.keeper.object3D);
    this.keeperDiveModel.object3D.position.copy(this.keeper.object3D.position);
    this.scene.add(this.keeperDiveModel.object3D);
    this.keeperDiveModel.playIdle();
    this.diveModelActive = true;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }

  reset() {
    this.resultSent = false;
    this.ripples = [];
    this.ballPos = { ...this.ballStart };
    this.kicker.object3D.position.set(
      this.kickerStartPos.x,
      0,
      this.kickerStartPos.z,
    );
    this.divePlayed = false;
    // Modelo real fica na cena; so volta do mergulho para o idle em loop.
    if (this.diveModelActive) this.keeperDiveModel!.playIdle();
    // Rearma a mira automatica (tambem reinicia o som ambiente, via
    // onStateChange('aiming') no componente Vue).
    this.setState("aiming");
  }

  // ------------------------------------------------------------------
  // Logica da cobranca
  // ------------------------------------------------------------------

  /**
   * Chamado pelo componente Vue depois que o resultado (ja decidido pela
   * API) e conhecido. Congela a posicao atual da mira automatica como o
   * alvo do chute; o goleiro mergulha exato (defende) ou para longe (vira
   * gol), conforme `computeDiveTarget`.
   */
  shoot(outcome: "goal" | "save") {
    if (this.state !== "ready" && this.state !== "aiming") return;
    const aimX = this.autoAimX;
    this.shotTarget = { x: aimX, y: this.layout.keeperHeight };
    this.outcome = outcome;
    this.diveTarget = computeDiveTarget(outcome, aimX, this.layout);
    this.ballEnd = {
      x: this.shotTarget.x,
      y: this.shotTarget.y,
      z: this.layout.goalLineZ,
    };
    this.setState("runup");
  }

  private setState(s: EngineState) {
    this.state = s;
    this.stateStart = this.clock.getElapsedTime();
    this.cb.onStateChange?.(s);
  }

  // ------------------------------------------------------------------
  // Loop principal
  // ------------------------------------------------------------------

  private frame = () => {
    if (this.destroyed) return;
    const delta = this.clock.getDelta();
    const now = this.clock.getElapsedTime();
    this.update(now, delta);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private stateT(now: number) {
    return now - this.stateStart;
  }

  private update(now: number, delta: number) {
    const t = this.stateT(now);

    switch (this.state) {
      case "runup": {
        const rt = Math.min(1, t / TIMINGS.runup);
        this.kicker.update("runup", rt, delta);
        this.kicker.object3D.position.set(
          this.kickerStartPos.x +
            (this.kickerKickPos.x - this.kickerStartPos.x) * rt,
          0,
          this.kickerStartPos.z +
            (this.kickerKickPos.z - this.kickerStartPos.z) * rt,
        );
        this.updateKeeperIdle(now, delta);
        if (t >= TIMINGS.runup) this.setState("strike");
        break;
      }
      case "strike":
        this.kicker.update("kick", Math.min(1, t / TIMINGS.strike), delta);
        this.updateKeeperIdle(now, delta);
        if (t >= TIMINGS.strike) {
          this.cb.onKick?.();
          this.setState("flight");
        }
        break;
      case "flight": {
        const ft = Math.min(1, t / TIMINGS.flight);
        const height = arcHeight(this.shotTarget.y, this.layout.goalHeight);
        this.ballPos = ballFlightPosition(
          this.ballStart,
          this.ballEnd,
          ft,
          height,
        );
        const divePhase =
          this.diveTarget.x < -0.3
            ? "diveLeft"
            : this.diveTarget.x > 0.3
              ? "diveRight"
              : "diveCenter";

        if (this.diveModelActive) {
          if (!this.divePlayed) {
            this.divePlayed = true;
            this.keeperDiveModel!.play(
              divePhase,
              TIMINGS.flight + TIMINGS.aftermath,
            );
          }
          this.keeperDiveModel!.update(delta);
        } else {
          this.keeper.update(divePhase, ft, delta);
        }

        if (ft >= 1) this.onBallArrive(now);
        break;
      }
      case "aftermath":
        if (this.diveModelActive) this.keeperDiveModel!.update(delta);
        this.updateBallAftermath(delta);
        if (t >= TIMINGS.aftermath) {
          if (!this.resultSent) {
            this.resultSent = true;
            this.cb.onResult(this.outcome);
          }
          this.setState("done");
        }
        break;
      default:
        this.kicker.update("idle", now, delta);
        this.updateKeeperIdle(now, delta);
    }

    const autoAiming = this.state === "ready" || this.state === "aiming";
    if (autoAiming) {
      const sweep = (Math.sin(now * AUTO_AIM_SPEED) + 1) / 2;
      this.autoAimX = lerp(
        this.layout.aimBounds.minX,
        this.layout.aimBounds.maxX,
        sweep,
      );
    }
    this.aimReticle.update(
      autoAiming ? { x: this.autoAimX, y: this.layout.keeperHeight } : null,
      true,
      now,
    );

    this.fieldAtmosphere.update(now);
    this.netMesh.update(this.ripples, now);
    this.ballMesh.position.set(this.ballPos.x, this.ballPos.y, this.ballPos.z);

    // Sombras seguem bola (encolhendo com a altura) e batedor.
    this.ballShadow.position.x = this.ballPos.x;
    this.ballShadow.position.z = this.ballPos.z;
    const shadowScale = 1 / (1 + this.ballPos.y * 0.7);
    this.ballShadow.scale.setScalar(shadowScale);
    this.kickerShadow.position.x = this.kicker.object3D.position.x;
    this.kickerShadow.position.z = this.kicker.object3D.position.z;
    this.cameraRig.update(this.state, t, this.ballPos);
  }

  /** Goleiro parado: modelo real com o clipe base em loop, ou o procedural. */
  private updateKeeperIdle(now: number, delta: number) {
    if (this.diveModelActive) {
      this.keeperDiveModel!.update(delta);
    } else {
      this.keeper.update("idle", now, delta);
    }
  }

  private onBallArrive(now: number) {
    this.cb.onImpact?.(this.outcome);
    if (this.outcome === "goal") {
      this.ripples.push({ x: this.ballEnd.x, y: this.ballEnd.y, start: now });
    }

    // Velocidade inicial do pos-impacto — antes disso a bola congelava no
    // ar em defesa (so o gol "parecia" certo por estar contra a rede).
    const sideways = Math.sign(this.ballEnd.x) || 1;
    if (this.outcome === "save") {
      // Rebatida do goleiro: volta para o campo, aberta para o lado do mergulho.
      this.ballVel = { x: sideways * 2.2, y: 1.6, z: 4.2 };
    } else {
      // Gol: a rede segura e a bola escorrega para o chao.
      this.ballVel = { x: 0, y: -0.6, z: -1.2 };
    }

    this.setState("aftermath");
  }

  /** Integra gravidade + quique amortecido no chao durante o aftermath. */
  private updateBallAftermath(delta: number) {
    const GRAVITY = 9.8;
    this.ballVel.y -= GRAVITY * delta;
    this.ballPos.x += this.ballVel.x * delta;
    this.ballPos.y += this.ballVel.y * delta;
    this.ballPos.z += this.ballVel.z * delta;

    const floor = this.layout.ballRadius;
    if (this.ballPos.y < floor) {
      this.ballPos.y = floor;
      this.ballVel.y =
        Math.abs(this.ballVel.y) > 0.8 ? -this.ballVel.y * 0.45 : 0;
      this.ballVel.x *= 0.7;
      this.ballVel.z *= 0.7;
    }

    // No gol, a rede segura a bola — nao deixa atravessar o fundo.
    const netZ =
      this.layout.goalLineZ - this.layout.goalDepth + this.layout.ballRadius;
    if (this.outcome === "goal" && this.ballPos.z < netZ) {
      this.ballPos.z = netZ;
      this.ballVel.z = 0;
    }
  }

  private render() {
    this.renderer.render(this.scene, this.cameraRig.camera);
  }

  // ------------------------------------------------------------------
  // Resize
  // ------------------------------------------------------------------

  private handleResize() {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth ?? window.innerWidth;
    const h = parent?.clientHeight ?? window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cameraRig.resize(w / h);
  }
}
```

- [ ] **Step 2: Remover `aimInput.ts` e confirmar que nada mais o importa**

Run: `git rm app/game/engine3d/aimInput.ts`
Run: `grep -rn "aimInput\|screenToAim" app/`
Expected: nenhuma ocorrência.

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm run test:unit`
Expected: todos os testes passam (Tasks 1-3 + `ballFlight.spec.ts`/`netRipple.spec.ts`, que não são afetados por esta task).

- [ ] **Step 4: Verificar manualmente que a cena ainda carrega**

Run: `npm run dev`, abra o jogo no navegador (preview). Confirme: canvas renderiza (gol/goleiro/gramado visíveis), sem erros no console. **Não é esperado conseguir chutar ainda** — a Task 5 é quem liga o botão "Chutar" ao novo `shoot()`.

- [ ] **Step 5: Commit**

```bash
git add app/game/engine3d/penaltyEngine3d.ts
git commit --no-gpg-sign -m "feat: mira automatica e metodo shoot() publico no PenaltyEngine3D"
```

---

### Task 5: UI — botão "Chutar", consumo da sequência, modais simplificados

**Files:**

- Modify: `app/components/PenaltyGame.client.vue`

**Interfaces:**

- Consumes: `PenaltyEngine3D.shoot(outcome)` (Task 4), `fetchPlaySequence`/`PenaltyPlayResult` (Task 3).

Sem teste automatizado dedicado (componente Vue sem infraestrutura de Vue Test Utils no projeto) — verificação manual no navegador ao final.

- [ ] **Step 1: Implementar**

Substitua `app/components/PenaltyGame.client.vue` inteiro por:

```vue
<script setup lang="ts">
import { PenaltyEngine3D } from "~/game/engine3d/penaltyEngine3d";
import type { ShotOutcome, EngineState } from "~/game/types";
import { Sfx } from "~/game/sfx";
import type { GameInfo, PenaltyPlayResult } from "~/composables/useGameApi";

const { fetchGames, fetchPlaySequence } = useGameApi();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const engineState = ref<EngineState>("ready");
// Fundo de estadio gerado por IA: retrato para celular, paisagem para
// desktop. A proporcao da cena fica travada na proporcao da imagem para o
// gol/goleiro 3D (renderizados por cima, canvas transparente) baterem
// certinho com o gramado da foto em qualquer tamanho de tela.
const PORTRAIT_ASPECT = 853 / 1844;
const LANDSCAPE_ASPECT = 1536 / 1024;
const isDesktopLayout = ref(false);
const stageSize = ref({ width: 0, height: 0 });
const bgImage = computed(() =>
  isDesktopLayout.value
    ? "/images/stadium-bg-landscape.webp"
    : "/images/stadium-bg-portrait.webp",
);

function updateLayoutMode() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  isDesktopLayout.value = vw / vh >= 1;
  const ratio = isDesktopLayout.value ? LANDSCAPE_ASPECT : PORTRAIT_ASPECT;
  // Encaixa a proporcao travada da imagem dentro da viewport: usa a
  // dimensao que "sobra" como barra (pillarbox/letterbox), sem esticar.
  stageSize.value =
    vw / vh > ratio
      ? { width: vh * ratio, height: vh }
      : { width: vw, height: vw / ratio };
}

const game = ref<GameInfo | null>(null);
const modal = ref<"none" | "win" | "lose">("none");
const prizeResult = ref<PenaltyPlayResult | null>(null);
const muted = ref(false);
const attempts = ref(0);
const goals = ref(0);
const awaitingSequence = ref(false);

let engine: PenaltyEngine3D | null = null;
const sfx = new Sfx();

// Sequencia de resultados ja decididos pela API — consumida um item por
// chute. So ha espera visivel no primeiro chute da sessao; depois disso a
// fila e reabastecida em segundo plano (maybeRefill), sem o jogador notar.
const SEQUENCE_BATCH_SIZE = 10;
const REFILL_THRESHOLD = 3;
let playQueue: PenaltyPlayResult[] = [];
let refillPromise: Promise<void> | null = null;
let currentPlayResult: PenaltyPlayResult | null = null;

function maybeRefill(gameId: string) {
  if (playQueue.length >= REFILL_THRESHOLD || refillPromise) return;
  refillPromise = fetchPlaySequence(gameId, SEQUENCE_BATCH_SIZE).then(
    (more) => {
      playQueue.push(...more);
      refillPromise = null;
    },
  );
}

async function nextPlayResult(gameId: string): Promise<PenaltyPlayResult> {
  if (playQueue.length === 0) {
    playQueue = await fetchPlaySequence(gameId, SEQUENCE_BATCH_SIZE);
  }
  const result = playQueue.shift()!;
  maybeRefill(gameId);
  return result;
}

async function onShootClick() {
  if (!engine || awaitingSequence.value) return;
  const gameId = game.value?.id ?? "penalty-premiado";
  if (playQueue.length === 0) awaitingSequence.value = true;
  const result = await nextPlayResult(gameId);
  awaitingSequence.value = false;
  currentPlayResult = result;
  engine.shoot(result.tipo_acao === "ganhou" ? "goal" : "save");
}

function onResult(outcome: ShotOutcome) {
  attempts.value++;
  if (outcome === "goal") {
    goals.value++;
    prizeResult.value = currentPlayResult;
    modal.value = "win";
  } else {
    modal.value = "lose";
  }
}

function retry() {
  modal.value = "none";
  prizeResult.value = null;
  engine?.reset();
  sfx.whistle();
}

function toggleMute() {
  muted.value = !muted.value;
  sfx.setMuted(muted.value);
}

onMounted(async () => {
  updateLayoutMode();
  window.addEventListener("resize", updateLayoutMode);

  game.value = (await fetchGames()).find((g) => g.active) ?? null;

  if (!canvasRef.value) return;
  engine = new PenaltyEngine3D(canvasRef.value, {
    onResult,
    onStateChange: (s) => {
      engineState.value = s;
      if (s === "aiming") sfx.startAmbient();
    },
    onKick: () => sfx.kick(),
    onImpact: (outcome) => (outcome === "goal" ? sfx.roar() : sfx.groan()),
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateLayoutMode);
  engine?.destroy();
  sfx.destroy();
});
</script>

<template>
  <div class="stage-viewport">
    <div
      class="stage"
      :style="{
        width: `${stageSize.width}px`,
        height: `${stageSize.height}px`,
        backgroundImage: `url(${bgImage})`,
      }"
    >
      <canvas ref="canvasRef" class="game-canvas" />

      <!-- HUD -->
      <header class="hud">
        <div class="hud-title">
          <h1>{{ game?.name ?? "Penalti Premiado" }}</h1>
          <p v-if="game">{{ game.headline }}</p>
        </div>
        <div class="hud-right">
          <div class="scoreboard" aria-label="Placar">
            <span class="score-goals">{{ goals }}</span>
            <span class="score-sep">gols</span>
            <span class="score-attempts">{{ attempts }} chutes</span>
          </div>
          <button
            class="mute-btn"
            type="button"
            :aria-label="muted ? 'Ativar som' : 'Desativar som'"
            @click="toggleMute"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon
                points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                fill="currentColor"
                stroke="none"
              />
              <template v-if="!muted">
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </template>
              <template v-else>
                <line x1="15" y1="9" x2="21" y2="15" />
                <line x1="21" y1="9" x2="15" y2="15" />
              </template>
            </svg>
          </button>
        </div>
      </header>

      <!-- Botao de chute -->
      <Transition name="fade">
        <div
          v-if="
            modal === 'none' &&
            (engineState === 'ready' || engineState === 'aiming')
          "
          class="hint"
        >
          <button
            class="hint-badge shoot-btn"
            type="button"
            :disabled="awaitingSequence"
            @click="onShootClick"
          >
            {{ awaitingSequence ? "Carregando..." : "Chutar" }}
          </button>
        </div>
      </Transition>

      <!-- Modal de vitoria -->
      <Transition name="modal">
        <div
          v-if="modal === 'win'"
          class="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Voce ganhou"
        >
          <div class="card card-win">
            <div class="rays" aria-hidden="true" />
            <div class="badge badge-win">
              <svg
                viewBox="0 0 24 24"
                width="44"
                height="44"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M8 21h8" />
                <path d="M12 17v4" />
                <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
                <path d="M7 6H4a3 3 0 0 0 3 5" />
                <path d="M17 6h3a3 3 0 0 1-3 5" />
              </svg>
            </div>
            <h2 class="card-title">GOOOL!</h2>
            <p class="card-sub">Voce venceu o goleiro</p>

            <div class="prize">
              <span class="prize-label">Voce ganhou</span>
              <strong class="prize-value">{{ prizeResult?.nome }}</strong>
            </div>

            <button class="btn btn-primary" type="button" @click="retry">
              Jogar novamente
            </button>
          </div>
        </div>
      </Transition>

      <!-- Modal de derrota -->
      <Transition name="modal">
        <div
          v-if="modal === 'lose'"
          class="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Nao foi dessa vez"
        >
          <div class="card card-lose">
            <div class="badge badge-lose">
              <svg
                viewBox="0 0 24 24"
                width="44"
                height="44"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 3c3.5 0 6 2 6 5.5V13a6 6 0 0 1-12 0V8.5C6 5 8.5 3 12 3Z"
                />
                <path d="M9 7v4M12 6.5V11M15 7v4" />
              </svg>
            </div>
            <h2 class="card-title">Defendeu!</h2>
            <p class="card-sub">O goleiro voou no canto certo.</p>
            <p class="card-encourage">
              Respira, ajusta a mira e manda de novo.
            </p>
            <button class="btn btn-primary" type="button" @click="retry">
              Tentar novamente
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.stage-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #00061b;
  overflow: hidden;
}

.stage {
  position: relative;
  /* Largura/altura calculadas em JS (updateLayoutMode) para travar a
     proporcao da imagem de fundo dentro da viewport, com barra de
     pillarbox/letterbox em vez de esticar — o gol/goleiro 3D (canvas
     transparente por cima) so bate certo com o gramado da foto se essa
     caixa mantiver a proporcao exata da imagem. */
  overflow: hidden;
  background-color: #00061b;
  background-size: cover;
  background-position: center;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.game-canvas {
  position: absolute;
  inset: 0;
  /* inset nao estica elementos replaced (canvas fica no tamanho do buffer
     do renderer, 1.5x maior que a tela) — precisa do 100% explicito. */
  width: 100%;
  height: 100%;
  display: block;
}

/* ------------------------------ HUD ------------------------------ */

.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(2, 8, 16, 0.72), rgba(2, 8, 16, 0));
}

.hud-title h1 {
  margin: 0;
  font-size: clamp(15px, 4.2vw, 22px);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #ffd23f;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.hud-title p {
  margin: 2px 0 0;
  font-size: clamp(11px, 3vw, 13px);
  color: rgba(255, 255, 255, 0.82);
}

.hud-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scoreboard {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(6, 18, 12, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
}

.score-goals {
  font-size: 18px;
  font-weight: 800;
  color: #8dff5a;
}

.score-sep {
  color: rgba(255, 255, 255, 0.7);
}

.score-attempts {
  color: rgba(255, 255, 255, 0.55);
}

.mute-btn {
  pointer-events: auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(6, 18, 12, 0.65);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.mute-btn:active {
  transform: scale(0.92);
}

/* ------------------------------ Botao de chute ------------------------------ */

.hint {
  position: absolute;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  pointer-events: none;
}

.hint-badge {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #00061b;
  background: #8dff5a;
  padding: 12px 34px;
  border-radius: 999px;
  animation: hint-pulse 1.6s ease-in-out infinite;
}

.shoot-btn {
  pointer-events: auto;
  border: 0;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(141, 255, 90, 0.32);
  transition:
    transform 0.15s ease,
    filter 0.15s ease;
}

.shoot-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.shoot-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  animation: none;
}

@keyframes hint-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.07);
  }
}

/* ------------------------------ Modais ------------------------------ */

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(2, 8, 5, 0.62);
  backdrop-filter: blur(7px);
  z-index: 10;
}

.card {
  position: relative;
  width: min(92%, 400px);
  border-radius: 22px;
  padding: 30px 26px 26px;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(165deg, #0d2417, #071510 60%, #051009);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.card-win {
  border-color: rgba(255, 210, 63, 0.45);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    0 0 60px rgba(255, 210, 63, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.rays {
  position: absolute;
  inset: -60%;
  -webkit-mask-image: radial-gradient(
    circle 230px at 50% 41%,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.3) 55%,
    transparent 100%
  );
  mask-image: radial-gradient(
    circle 230px at 50% 41%,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.3) 55%,
    transparent 100%
  );
  background: conic-gradient(
    from 0deg,
    rgba(255, 210, 63, 0.13) 0deg 18deg,
    transparent 18deg 36deg,
    rgba(255, 210, 63, 0.13) 36deg 54deg,
    transparent 54deg 72deg,
    rgba(255, 210, 63, 0.13) 72deg 90deg,
    transparent 90deg 108deg,
    rgba(255, 210, 63, 0.13) 108deg 126deg,
    transparent 126deg 144deg,
    rgba(255, 210, 63, 0.13) 144deg 162deg,
    transparent 162deg 180deg,
    rgba(255, 210, 63, 0.13) 180deg 198deg,
    transparent 198deg 216deg,
    rgba(255, 210, 63, 0.13) 216deg 234deg,
    transparent 234deg 252deg,
    rgba(255, 210, 63, 0.13) 252deg 270deg,
    transparent 270deg 288deg,
    rgba(255, 210, 63, 0.13) 288deg 306deg,
    transparent 306deg 324deg,
    rgba(255, 210, 63, 0.13) 324deg 342deg,
    transparent 342deg 360deg
  );
  animation: rays-spin 14s linear infinite;
  pointer-events: none;
}

@keyframes rays-spin {
  to {
    transform: rotate(360deg);
  }
}

.badge {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 50%;
  animation: badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.1s;
}

.badge-win {
  color: #00061b;
  background: radial-gradient(circle at 32% 28%, #ffe789, #ffd23f 55%, #d99a12);
  box-shadow: 0 10px 30px rgba(255, 210, 63, 0.4);
}

.badge-win::after {
  content: "";
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 2px solid rgba(255, 210, 63, 0.6);
  animation: ring-pulse 1.8s ease-out infinite;
}

@keyframes ring-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.9;
  }
  70% {
    transform: scale(1.22);
    opacity: 0;
  }
  100% {
    transform: scale(1.22);
    opacity: 0;
  }
}

.badge-lose {
  color: #ffe2dc;
  background: radial-gradient(circle at 32% 28%, #4a5568, #2b3444 60%, #1a2230);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

@keyframes badge-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.card-title {
  position: relative;
  margin: 0;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #fff;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.2s;
}

.card-win .card-title {
  background: linear-gradient(
    100deg,
    #d99a12 0%,
    #ffd23f 28%,
    #fff3bd 50%,
    #ffd23f 72%,
    #d99a12 100%
  );
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(255, 210, 63, 0.4));
  animation:
    rise-in 0.5s ease both,
    title-shine 2.6s linear 0.7s infinite;
}

@keyframes title-shine {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

.card-sub {
  position: relative;
  margin: 6px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.28s;
}

.card-encourage {
  position: relative;
  margin: 14px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.36s;
}

.card-lose::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 110, 90, 0.8),
    transparent
  );
}

.card-lose .badge-lose {
  animation:
    badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    lose-shake 0.5s ease 0.6s;
}

@keyframes lose-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-6px);
  }
  50% {
    transform: translateX(5px);
  }
  75% {
    transform: translateX(-3px);
  }
}

@keyframes rise-in {
  0% {
    transform: translateY(14px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.prize {
  position: relative;
  margin: 20px 0 4px;
  padding: 16px 14px;
  border-radius: 16px;
  background: linear-gradient(
    170deg,
    rgba(255, 210, 63, 0.1),
    rgba(255, 255, 255, 0.04) 45%
  );
  border: 1px solid rgba(255, 210, 63, 0.35);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.4s;
}

.prize::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 46%;
  background: linear-gradient(
    105deg,
    transparent,
    rgba(255, 255, 255, 0.14) 50%,
    transparent
  );
  animation: prize-shimmer 2.8s ease-in-out 1s infinite;
  pointer-events: none;
}

@keyframes prize-shimmer {
  0% {
    left: -60%;
  }
  55% {
    left: 115%;
  }
  100% {
    left: 115%;
  }
}

.prize-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.prize-value {
  font-size: 32px;
  font-weight: 900;
  color: #8dff5a;
  text-shadow: 0 0 24px rgba(141, 255, 90, 0.35);
  animation:
    value-pop 0.5s cubic-bezier(0.34, 1.5, 0.64, 1) 0.55s both,
    value-glow 2.2s ease-in-out 1.1s infinite;
}

@keyframes value-pop {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes value-glow {
  0%,
  100% {
    text-shadow: 0 0 24px rgba(141, 255, 90, 0.35);
  }
  50% {
    text-shadow: 0 0 38px rgba(141, 255, 90, 0.65);
  }
}

.btn {
  position: relative;
  margin-top: 20px;
  width: 100%;
  padding: 14px 18px;
  border: 0;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.5s;
}

.btn-primary {
  color: #00061b;
  background: linear-gradient(160deg, #ffe066, #ffd23f 55%, #eab308);
  box-shadow: 0 10px 26px rgba(255, 210, 63, 0.32);
  overflow: hidden;
}

.btn-primary::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(
    105deg,
    transparent,
    rgba(255, 255, 255, 0.45) 50%,
    transparent
  );
  animation: prize-shimmer 3.2s ease-in-out 1.6s infinite;
  pointer-events: none;
}

.btn-primary:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(1px) scale(0.99);
}

/* ------------------------------ Transicoes ------------------------------ */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-enter-active {
  transition: opacity 0.3s ease;
}

.modal-leave-active {
  transition: opacity 0.22s ease;
}

.modal-enter-active .card {
  animation: card-in 0.45s cubic-bezier(0.34, 1.35, 0.64, 1) both;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@keyframes card-in {
  0% {
    transform: translateY(30px) scale(0.92);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@media (min-width: 900px) {
  .hud {
    padding: 16px 24px;
  }
}
</style>
```

Mudanças-chave em relação ao arquivo anterior: `cursor: crosshair` saiu de `.game-canvas` (não há mais mira por toque no canvas); `.hint p`/parágrafo explicativo saiu (o botão já é autoexplicativo); `.numbers`/`.number-chip`/`@keyframes chip-flip`/`.prize-campaign` saíram (não existem mais no template); `font-variant-numeric: tabular-nums` saiu de `.prize-value` (não há mais contagem numérica animada).

- [ ] **Step 2: Rodar a suíte completa**

Run: `npm run test:unit`
Expected: todos os testes passam (nenhum teste cobre este componente Vue diretamente, mas confirma que nada nas Tasks 1-4 regrediu).

- [ ] **Step 3: Verificar manualmente no navegador**

Run: `npm run dev`. Abra o jogo no preview e confirme, em ordem:

1. Ao carregar, o goleiro já está em pé e o indicador de mira (retículo verde) já oscila sozinho da esquerda para a direita dentro do gol, sem precisar tocar a tela.
2. O botão **"Chutar"** aparece no lugar da antiga dica de texto.
3. Primeiro clique em "Chutar": botão mostra "Carregando..." e fica desabilitado por um instante (a mira continua visivelmente oscilando ao fundo), depois a animação de corrida/chute roda normalmente.
4. Cliques seguintes em "Chutar" (depois de "Jogar novamente"): sem "Carregando..." perceptível — vai direto para a animação.
5. Resultado bate sempre com o que a sequência determinou: quando o resultado é vitória, sempre vira `GOOOL!` (goleiro erra o mergulho, longe da bola); quando é derrota, sempre vira `Defendeu!` (goleiro mergulha exatamente onde a mira estava). Repita várias vezes para conferir os dois casos.
6. Modal de vitória mostra o texto do prêmio (`nome`, ex. "R$ 50,00" ou "5 Cotas") sem chips de números da sorte.
7. Modal de derrota mostra sempre "Defendeu!" (nunca mais "Pra fora!").
8. Botão "Chutar" some durante a animação (corrida → chute → voo → pós-impacto) e volta a aparecer, já oscilando, depois de "Jogar novamente"/"Tentar novamente".
9. Sem erros no console do navegador.

- [ ] **Step 4: Commit**

```bash
git add app/components/PenaltyGame.client.vue
git commit --no-gpg-sign -m "feat: botao Chutar com mira automatica e resultado pre-definido pela API"
```

---

## Notas para quem for executar

- A ordem das tasks importa: 1 e 2 são independentes entre si mas ambas precedem a 4 (que consome `keeperHeight` e `computeDiveTarget`); 3 precede a 5 (que consome `fetchPlaySequence`); 4 precede a 5 (que consome `shoot()`).
- Depois da Task 5, atualizar `docs/superpowers/STATUS.md`: mover esta spec de "próxima tarefa" para "feito", e registrar que `submitPlay`/`mockPrize`/`Prize`/`PrizeType`/`aimInput.ts`/`decideShot` saíram do código.
- Fora de escopo deste plano (não fazer sem pedir confirmação): reconstrução dos modais no estilo `Roleta/`, limpeza do histórico do git (arquivos `.glb` grandes), remoção de `app/game/engine.ts` (motor 2D morto).
