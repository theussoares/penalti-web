# Motor gráfico 3D (Canvas 2D → Three.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o renderizador Canvas 2D do jogo de pênalti por uma cena Three.js/WebGL (personagens 3D animados, câmera dinâmica, bola e rede em 3D real, torcida em billboard 2D), preservando 1:1 a lógica de jogo existente (mira, IA do goleiro, cálculo de resultado).

**Architecture:** Nova classe `PenaltyEngine3D` com a mesma interface pública de `PenaltyEngine` (`engine.ts`), composta a partir de módulos pequenos e testáveis (`engine3d/*`): geometria de mundo, IA do goleiro, física de voo da bola, ondulação da rede — todos como funções puras — mais módulos de cena Three.js (personagem, câmera, torcida, malha de bola/rede) que consomem essa lógica pura. `PenaltyGame.client.vue` troca uma linha de instanciação; HUD/modais/mute continuam intactos.

**Tech Stack:** Three.js (WebGLRenderer), TypeScript, Vitest (testes de lógica pura), Nuxt 4 / Vue 3 (já existentes).

## Global Constraints

- Reaproveitar a interface pública de `EngineCallbacks`/`EngineState`/`ShotOutcome` — não mudar o contrato consumido por `PenaltyGame.client.vue`.
- Portar a lógica de IA do goleiro e cálculo de resultado **1:1** (mesmas probabilidades) — só troca de coordenadas de tela por coordenadas de mundo.
- Alvo de performance: Android de entrada/médio — sem sombras dinâmicas, sem pós-processamento, `antialias: false`, `devicePixelRatio` limitado a 1.5.
- Torcida permanece 2D (billboard), reaproveitando o gerador de textura já existente em `engine.ts` (`renderCrowdLayers`).
- Câmera com travelling simples; sem corte de replay no v1.
- Personagens (batedor e goleiro) são **100% procedurais**, construídos por código — sem tentativa de carregar asset glTF externo. Pesquisa confirmou que não existe pacote gratuito/redistribuível de jogador+goleiro riggado com animação de chute e mergulho; decisão do usuário foi não depender de asset externo algum.
- Sem CSS inline, sem strings de UI hardcoded fora de i18n — não se aplica aqui (não há UI nova, só canvas/WebGL).
- Sem testes unitários para renderização WebGL (não é unit-testável de forma significativa) — testes cobrem apenas os módulos de lógica pura.
- Commits usam `git commit --no-gpg-sign` — o ambiente não tem `ssh-agent` rodando para a chave de assinatura configurada (`gpg.format=ssh`), e o usuário autorizou explicitamente pular a assinatura para as tasks deste plano. Não alterar a configuração global do git (`commit.gpgsign`) — usar só a flag por commit.
- Ao final (Task 14), remover `app/game/engine.ts` (motor 2D antigo) — não manter os dois motores com toggle.

---

### Task 1: Setup — dependências, tipos compartilhados e Vitest

**Status: já implementada e commitada (`9bbb4c8`).** Mantida aqui por completude/histórico.

**Files:**
- Modify: `package.json`
- Create: `app/game/types.ts`
- Create: `vitest.config.ts`
- Test: `app/game/types.spec.ts`

**Interfaces:**
- Produces: `ShotOutcome`, `EngineState`, `EngineCallbacks`, `Vec2`, `Vec3` (todos exportados de `app/game/types.ts`, usados por todas as tasks seguintes).

- [x] **Step 1: Instalar dependências**

Run: `npm install three && npm install -D vitest @types/three`

Expected: `three`, `vitest` e `@types/three` aparecem em `package.json` (dependencies/devDependencies) e `package-lock.json` é atualizado.

- [x] **Step 2: Adicionar script de teste**

Edite `package.json`, dentro de `"scripts"`, adicionando a linha (mantendo as demais):

```json
    "test:unit": "vitest run"
```

- [x] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.spec.ts']
  }
})
```

- [x] **Step 4: Criar os tipos compartilhados**

Crie `app/game/types.ts`:

```ts
/**
 * Tipos compartilhados entre o motor 2D (engine.ts) e o motor 3D (engine3d/*).
 */

export type ShotOutcome = 'goal' | 'save' | 'out'

export type EngineState =
  | 'ready'
  | 'aiming'
  | 'runup'
  | 'strike'
  | 'flight'
  | 'aftermath'
  | 'done'

export interface EngineCallbacks {
  onResult(outcome: ShotOutcome): void
  onStateChange?(state: EngineState): void
  onKick?(): void
  onImpact?(outcome: ShotOutcome): void
}

export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}
```

- [x] **Step 5: Escrever teste de sanidade do setup**

Crie `app/game/types.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { EngineState, ShotOutcome } from './types'

describe('types compartilhados', () => {
  it('aceita os valores validos de ShotOutcome', () => {
    const outcomes: ShotOutcome[] = ['goal', 'save', 'out']
    expect(outcomes).toHaveLength(3)
  })

  it('aceita os valores validos de EngineState', () => {
    const states: EngineState[] = ['ready', 'aiming', 'runup', 'strike', 'flight', 'aftermath', 'done']
    expect(states).toHaveLength(7)
  })
})
```

- [x] **Step 6: Rodar os testes**

Run: `npm run test:unit`
Expected: `app/game/types.spec.ts` passa (2 testes).

- [x] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts app/game/types.ts app/game/types.spec.ts
git commit --no-gpg-sign -m "chore: adiciona three, vitest e tipos compartilhados do motor de jogo"
```

---

### Task 2: Geometria de mundo (pura, testada)

**Files:**
- Create: `app/game/engine3d/worldGeometry.ts`
- Test: `app/game/engine3d/worldGeometry.spec.ts`

**Interfaces:**
- Consumes: nenhuma (módulo raiz).
- Produces: `WorldLayout` (interface), `computeWorldLayout(): WorldLayout`, `clampAim(x, y, bounds): Vec2` — usados pelas Tasks 3 (IA do goleiro), 11 (input) e 12 (orquestrador).

- [ ] **Step 1: Escrever os testes**

Crie `app/game/engine3d/worldGeometry.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clampAim, computeWorldLayout } from './worldGeometry'

describe('computeWorldLayout', () => {
  it('produz um gol com largura e altura oficiais em metros', () => {
    const layout = computeWorldLayout()
    expect(layout.goalWidth).toBeCloseTo(7.32)
    expect(layout.goalHeight).toBeCloseTo(2.44)
  })

  it('posiciona a marca do penalti a 11 metros da linha do gol', () => {
    const layout = computeWorldLayout()
    expect(layout.spotZ - layout.goalLineZ).toBeCloseTo(11)
  })

  it('define aimBounds dentro da area do gol, com margem', () => {
    const layout = computeWorldLayout()
    expect(layout.aimBounds.minX).toBeGreaterThan(layout.goalCenterX - layout.goalWidth / 2)
    expect(layout.aimBounds.maxX).toBeLessThan(layout.goalCenterX + layout.goalWidth / 2)
    expect(layout.aimBounds.minY).toBeGreaterThan(0)
    expect(layout.aimBounds.maxY).toBeLessThan(layout.goalHeight)
  })
})

describe('clampAim', () => {
  it('mantem pontos ja dentro dos limites inalterados', () => {
    const layout = computeWorldLayout()
    const p = { x: layout.goalCenterX, y: layout.goalHeight / 2 }
    expect(clampAim(p.x, p.y, layout.aimBounds)).toEqual(p)
  })

  it('corta pontos fora dos limites para a borda mais proxima', () => {
    const layout = computeWorldLayout()
    const clamped = clampAim(999, -999, layout.aimBounds)
    expect(clamped.x).toBeCloseTo(layout.aimBounds.maxX)
    expect(clamped.y).toBeCloseTo(layout.aimBounds.minY)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test:unit -- worldGeometry`
Expected: FAIL — `Cannot find module './worldGeometry'`.

- [ ] **Step 3: Implementar**

Crie `app/game/engine3d/worldGeometry.ts`:

```ts
import type { Vec2 } from '../types'

export interface AimBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface WorldLayout {
  goalWidth: number
  goalHeight: number
  goalPostRadius: number
  goalDepth: number
  goalCenterX: number
  goalLineZ: number
  spotZ: number
  ballRadius: number
  aimBounds: AimBounds
}

const GOAL_WIDTH = 7.32
const GOAL_HEIGHT = 2.44
const PENALTY_SPOT_DISTANCE = 11
const AIM_MARGIN = 0.22

export function computeWorldLayout(): WorldLayout {
  const goalCenterX = 0
  const goalLineZ = 0
  return {
    goalWidth: GOAL_WIDTH,
    goalHeight: GOAL_HEIGHT,
    goalPostRadius: 0.06,
    goalDepth: 1.1,
    goalCenterX,
    goalLineZ,
    spotZ: goalLineZ + PENALTY_SPOT_DISTANCE,
    ballRadius: 0.11,
    aimBounds: {
      minX: goalCenterX - GOAL_WIDTH / 2 + AIM_MARGIN,
      maxX: goalCenterX + GOAL_WIDTH / 2 - AIM_MARGIN,
      minY: AIM_MARGIN,
      maxY: GOAL_HEIGHT - AIM_MARGIN
    }
  }
}

export function clampAim(x: number, y: number, bounds: AimBounds): Vec2 {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y))
  }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npm run test:unit -- worldGeometry`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add app/game/engine3d/worldGeometry.ts app/game/engine3d/worldGeometry.spec.ts
git commit --no-gpg-sign -m "feat: adiciona geometria de mundo do motor 3D"
```

---

### Task 3: IA do goleiro e cálculo de resultado (pura, testada, porte 1:1)

**Files:**
- Create: `app/game/engine3d/goalkeeperAI.ts`
- Test: `app/game/engine3d/goalkeeperAI.spec.ts`

**Interfaces:**
- Consumes: `WorldLayout` de `./worldGeometry`, `ShotOutcome` de `../types`.
- Produces: `ShotDecision` (interface), `decideShot(target, layout, rng?): ShotDecision` — usada pela Task 12 (orquestrador) para decidir mergulho do goleiro e resultado ao soltar o chute.

- [ ] **Step 1: Escrever os testes**

Crie `app/game/engine3d/goalkeeperAI.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { decideShot } from './goalkeeperAI'
import { computeWorldLayout } from './worldGeometry'

/** RNG deterministico: retorna os valores da fila, um por chamada, ciclando. */
function seq(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('decideShot', () => {
  const layout = computeWorldLayout()

  it('retorna "out" quando o alvo esta fora do gol, independente do rng', () => {
    const outside = { x: layout.aimBounds.maxX + 5, y: layout.aimBounds.minY }
    const decision = decideShot(outside, layout, seq(0.01))
    expect(decision.outcome).toBe('out')
  })

  it('retorna "save" quando o goleiro acerta o canto e a linha exatos do alvo', () => {
    const cols = [
      lerp(layout.aimBounds.minX, layout.aimBounds.maxX, 0.16),
      (layout.aimBounds.minX + layout.aimBounds.maxX) / 2,
      lerp(layout.aimBounds.minX, layout.aimBounds.maxX, 0.84)
    ]
    const rowsY = [
      lerp(layout.aimBounds.minY, layout.aimBounds.maxY, 0.68),
      lerp(layout.aimBounds.minY, layout.aimBounds.maxY, 0.18)
    ]
    const target = { x: cols[1]!, y: rowsY[0]! } // coluna central, fila "alta"
    // rng: 1a chamada (guessRight) < 0.58 -> acerta a coluna certa
    //      2a chamada (fila)      < 0.62 -> acerta a fila certa
    const decision = decideShot(target, layout, seq(0.1, 0.1))
    expect(decision.outcome).toBe('save')
  })

  it('retorna "goal" quando o goleiro erra a coluna e a fila do alvo', () => {
    const cols = [
      lerp(layout.aimBounds.minX, layout.aimBounds.maxX, 0.16),
      (layout.aimBounds.minX + layout.aimBounds.maxX) / 2,
      lerp(layout.aimBounds.minX, layout.aimBounds.maxX, 0.84)
    ]
    const rowsY = [
      lerp(layout.aimBounds.minY, layout.aimBounds.maxY, 0.68),
      lerp(layout.aimBounds.minY, layout.aimBounds.maxY, 0.18)
    ]
    const target = { x: cols[1]!, y: rowsY[0]! }
    // rng: 1a chamada >= 0.58 -> erra a coluna certa
    //      2a chamada escolhe a outra coluna errada disponivel
    //      3a chamada >= 0.5  -> erra a fila certa tambem
    const decision = decideShot(target, layout, seq(0.9, 0.9, 0.9))
    expect(decision.outcome).toBe('goal')
  })
})

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test:unit -- goalkeeperAI`
Expected: FAIL — `Cannot find module './goalkeeperAI'`.

- [ ] **Step 3: Implementar**

Crie `app/game/engine3d/goalkeeperAI.ts`:

```ts
import type { ShotOutcome, Vec2 } from '../types'
import type { WorldLayout } from './worldGeometry'

export interface ShotDecision {
  outcome: ShotOutcome
  diveTarget: Vec2
  diveDir: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Porte 1:1 da IA do goleiro do motor 2D (engine.ts `shoot()`), trocando
 * pixels de tela por coordenadas de mundo. Mesmas probabilidades:
 * 58% de chance de adivinhar a coluna certa, 62%/50% de acertar a fila.
 */
export function decideShot(
  target: Vec2,
  layout: WorldLayout,
  rng: () => number = Math.random
): ShotDecision {
  const { aimBounds, goalCenterX, goalHeight } = layout

  const inGoal =
    target.x > aimBounds.minX && target.x < aimBounds.maxX &&
    target.y > aimBounds.minY && target.y < aimBounds.maxY

  const cols = [
    lerp(aimBounds.minX, aimBounds.maxX, 0.16),
    (aimBounds.minX + aimBounds.maxX) / 2,
    lerp(aimBounds.minX, aimBounds.maxX, 0.84)
  ]
  const rowsY = [
    lerp(aimBounds.minY, aimBounds.maxY, 0.68),
    lerp(aimBounds.minY, aimBounds.maxY, 0.18)
  ]

  const targetCol = target.x < lerp(aimBounds.minX, aimBounds.maxX, 0.38)
    ? 0
    : target.x > lerp(aimBounds.minX, aimBounds.maxX, 0.62)
      ? 2
      : 1
  const targetRow = target.y > lerp(aimBounds.minY, aimBounds.maxY, 0.5) ? 0 : 1

  let col: number
  const guessRight = rng() < 0.58
  if (guessRight) {
    col = targetCol
  } else {
    const others = [0, 1, 2].filter((c) => c !== targetCol)
    col = others[Math.floor(rng() * others.length)]!
  }
  const row = rng() < (col === targetCol ? 0.62 : 0.5) ? targetRow : 1 - targetRow

  const diveTarget: Vec2 = { x: cols[col]!, y: rowsY[row]! }
  const diveDir = Math.sign(diveTarget.x - goalCenterX) || 0

  if (!inGoal) {
    return { outcome: 'out', diveTarget, diveDir }
  }

  const reach = goalHeight * 0.36
  const dist = Math.hypot(diveTarget.x - target.x, diveTarget.y - target.y)
  const outcome: ShotOutcome = dist < reach ? 'save' : 'goal'
  return { outcome, diveTarget, diveDir }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npm run test:unit -- goalkeeperAI`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add app/game/engine3d/goalkeeperAI.ts app/game/engine3d/goalkeeperAI.spec.ts
git commit --no-gpg-sign -m "feat: porta IA do goleiro e calculo de resultado para coordenadas de mundo"
```

---

### Task 4: Física de voo da bola (pura, testada)

**Files:**
- Create: `app/game/engine3d/ballFlight.ts`
- Test: `app/game/engine3d/ballFlight.spec.ts`

**Interfaces:**
- Consumes: `Vec3` de `../types`.
- Produces: `arcHeight(targetY, goalHeight): number`, `ballFlightPosition(start, end, t, height): Vec3` — usados pela Task 9 (malha da bola) e Task 12 (orquestrador).

- [ ] **Step 1: Escrever os testes**

Crie `app/game/engine3d/ballFlight.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { arcHeight, ballFlightPosition } from './ballFlight'

describe('ballFlightPosition', () => {
  const start = { x: 0, y: 0.11, z: 11 }
  const end = { x: 1.5, y: 1.2, z: 0 }

  it('em t=0 fica exatamente no ponto de partida', () => {
    const p = ballFlightPosition(start, end, 0, 1)
    expect(p).toEqual({ x: start.x, y: start.y, z: start.z })
  })

  it('em t=1 fica exatamente no ponto de chegada', () => {
    const p = ballFlightPosition(start, end, 1, 1)
    expect(p.x).toBeCloseTo(end.x)
    expect(p.y).toBeCloseTo(end.y)
    expect(p.z).toBeCloseTo(end.z)
  })

  it('no meio do voo, a altura extra do arco eleva a bola acima da linha reta', () => {
    const withArc = ballFlightPosition(start, end, 0.5, 1)
    const straightY = (start.y + end.y) / 2
    expect(withArc.y).toBeGreaterThan(straightY)
  })
})

describe('arcHeight', () => {
  it('chutes rasteiros (targetY baixo) tem arco maior que chutes altos', () => {
    const goalHeight = 2.44
    const low = arcHeight(0.1, goalHeight)
    const high = arcHeight(2.3, goalHeight)
    expect(low).toBeGreaterThan(high)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test:unit -- ballFlight`
Expected: FAIL — `Cannot find module './ballFlight'`.

- [ ] **Step 3: Implementar**

Crie `app/game/engine3d/ballFlight.ts`:

```ts
import type { Vec3 } from '../types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)

/**
 * Chutes altos (target.y proximo do teto do gol) fazem um arco mais reto;
 * chutes rasteiros fazem um arco mais alto. Porte de `arcHeight()` em
 * engine.ts, agora recebendo a altura-alvo em metros de mundo em vez de
 * pixels de tela.
 */
export function arcHeight(targetY: number, goalHeight: number): number {
  const targetH = clamp01(targetY / goalHeight)
  return lerp(1.6, 0.35, targetH)
}

/** Posicao da bola em voo parabolico entre `start` e `end`, em t de 0 a 1. */
export function ballFlightPosition(start: Vec3, end: Vec3, t: number, height: number): Vec3 {
  const ct = clamp01(t)
  const p = easeOutQuad(ct)
  return {
    x: lerp(start.x, end.x, p),
    y: lerp(start.y, end.y, p) + height * Math.sin(Math.PI * ct),
    z: lerp(start.z, end.z, p)
  }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npm run test:unit -- ballFlight`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add app/game/engine3d/ballFlight.ts app/game/engine3d/ballFlight.spec.ts
git commit --no-gpg-sign -m "feat: adiciona fisica de voo da bola em 3D"
```

---

### Task 5: Ondulação da rede (pura, testada)

**Files:**
- Create: `app/game/engine3d/netRipple.ts`
- Test: `app/game/engine3d/netRipple.spec.ts`

**Interfaces:**
- Consumes: `Vec2` de `../types`.
- Produces: `Ripple` (interface), `netDisplacement(point, ripples, now, goalWidth, goalHeight): number` — usado pela Task 9 (malha da rede).

- [ ] **Step 1: Escrever os testes**

Crie `app/game/engine3d/netRipple.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { netDisplacement, type Ripple } from './netRipple'

describe('netDisplacement', () => {
  const goalWidth = 7.32
  const goalHeight = 2.44

  it('sem ondulacoes ativas, o deslocamento e zero', () => {
    const d = netDisplacement({ x: 0, y: 1 }, [], 10, goalWidth, goalHeight)
    expect(d).toBe(0)
  })

  it('ondulacoes com mais de 1.4s de vida nao contribuem', () => {
    const ripples: Ripple[] = [{ x: 0, y: 1, start: 0 }]
    const d = netDisplacement({ x: 0, y: 1 }, ripples, 2, goalWidth, goalHeight)
    expect(d).toBe(0)
  })

  it('uma ondulacao recente produz deslocamento nao-nulo perto do ponto de impacto', () => {
    const ripples: Ripple[] = [{ x: 0, y: 1, start: 0 }]
    const d = netDisplacement({ x: 0, y: 1 }, ripples, 0.05, goalWidth, goalHeight)
    expect(d).not.toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test:unit -- netRipple`
Expected: FAIL — `Cannot find module './netRipple'`.

- [ ] **Step 3: Implementar**

Crie `app/game/engine3d/netRipple.ts`:

```ts
import type { Vec2 } from '../types'

export interface Ripple {
  x: number
  y: number
  start: number
}

/**
 * Porte de `netDisplacement()` em engine.ts para coordenadas de mundo.
 * Cada ondulacao decai no tempo (3.2/s) e no espaco (16% da largura do gol),
 * oscilando como uma onda amortecida. Ondulacoes com mais de 1.4s são
 * ignoradas (já dissiparam).
 */
export function netDisplacement(
  point: Vec2,
  ripples: Ripple[],
  now: number,
  goalWidth: number,
  goalHeight: number
): number {
  let d = 0
  for (const r of ripples) {
    const age = now - r.start
    if (age > 1.4) continue
    const dist = Math.hypot(point.x - r.x, point.y - r.y)
    d +=
      Math.exp(-dist / (goalWidth * 0.16)) *
      Math.exp(-age * 3.2) *
      Math.sin(dist / (goalWidth * 0.045) - age * 26) *
      goalHeight * 0.06
  }
  return d
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npm run test:unit -- netRipple`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add app/game/engine3d/netRipple.ts app/game/engine3d/netRipple.spec.ts
git commit --no-gpg-sign -m "feat: adiciona matematica de ondulacao da rede em 3D"
```

---

### Task 6: Rig procedural — hierarquia e poses

**Files:**
- Create: `app/game/engine3d/proceduralCharacter.ts`

**Interfaces:**
- Consumes: `Group`, `Mesh`, `CapsuleGeometry`, `MeshStandardMaterial` de `three`.
- Produces: `ProceduralCharacter` (interface: `{ root: Group; setPose(phase, t: number): void }`), `buildProceduralCharacter(role: 'kicker' | 'keeper'): ProceduralCharacter` — usado pela Task 7 (controlador de personagem).

Sem testes automatizados (geometria 3D não é unit-testável de forma significativa) — verificação manual na Task 13.

- [ ] **Step 1: Implementar a hierarquia e as poses**

Crie `app/game/engine3d/proceduralCharacter.ts`:

```ts
import { CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'

export type CharacterRole = 'kicker' | 'keeper'
export type CharacterPhase = 'idle' | 'runup' | 'kick' | 'diveLeft' | 'diveRight' | 'diveCenter'

export interface ProceduralCharacter {
  root: Group
  /**
   * Para fases com progresso definido (runup/kick/dive*), `t` vai de 0 a 1.
   * Para "idle", `t` e o tempo decorrido em segundos, usado so para gerar
   * uma oscilacao continua (balanco de respiracao) — nao ha "fim" da fase.
   */
  setPose(phase: CharacterPhase, t: number): void
}

interface Joints {
  hips: Group
  torso: Group
  head: Mesh
  armL: Group
  armR: Group
  legL: Group
  legR: Group
}

const PALETTE: Record<CharacterRole, { shirt: number; shorts: number; skin: number }> = {
  kicker: { shirt: 0xffd23f, shorts: 0x1f4fd0, skin: 0x8a5a3b },
  keeper: { shirt: 0x17181d, shorts: 0x17181d, skin: 0xc98e63 }
}

function limb(radius: number, length: number, color: number): Mesh {
  const mesh = new Mesh(new CapsuleGeometry(radius, length, 4, 8), new MeshStandardMaterial({ color }))
  mesh.position.y = -length / 2 - radius
  return mesh
}

function buildJoints(role: CharacterRole): { root: Group; joints: Joints } {
  const palette = PALETTE[role]
  const root = new Group()

  const hips = new Group()
  hips.position.y = 0.9
  root.add(hips)

  const torso = new Group()
  torso.add(limb(0.18, 0.55, palette.shirt))
  torso.position.y = 0.05
  hips.add(torso)

  const head = new Mesh(new SphereGeometry(0.13, 12, 12), new MeshStandardMaterial({ color: palette.skin }))
  head.position.y = 0.75
  torso.add(head)

  const armL = new Group()
  armL.add(limb(0.07, 0.5, palette.skin))
  armL.position.set(-0.22, 0.55, 0)
  torso.add(armL)

  const armR = new Group()
  armR.add(limb(0.07, 0.5, palette.skin))
  armR.position.set(0.22, 0.55, 0)
  torso.add(armR)

  const legL = new Group()
  legL.add(limb(0.09, 0.75, palette.shorts))
  legL.position.set(-0.12, 0, 0)
  hips.add(legL)

  const legR = new Group()
  legR.add(limb(0.09, 0.75, palette.shorts))
  legR.position.set(0.12, 0, 0)
  hips.add(legR)

  return { root, joints: { hips, torso, head, armL, armR, legL, legR } }
}

/**
 * Constroi um personagem low-poly por codigo (capsulas + esfera para a
 * cabeca), reaproveitando as mesmas fases de pose que o batedor/goleiro 2D
 * ja usavam (idle com balanco leve, corrida com passada, chute com chicote
 * de perna, mergulho esticado para o lado escolhido pela IA do goleiro).
 */
export function buildProceduralCharacter(role: CharacterRole): ProceduralCharacter {
  const { root, joints } = buildJoints(role)

  function setPose(phase: CharacterPhase, t: number) {
    const { torso, armL, armR, legL, legR, hips } = joints

    // Reset por quadro; cada fase abaixo so ajusta o que precisa.
    torso.rotation.set(0, 0, 0)
    armL.rotation.set(0, 0, 0)
    armR.rotation.set(0, 0, 0)
    legL.rotation.set(0, 0, 0)
    legR.rotation.set(0, 0, 0)
    hips.rotation.set(0, 0, 0)
    hips.position.y = 0.9

    switch (phase) {
      case 'idle': {
        const sway = Math.sin(t * Math.PI * 2) * 0.05
        torso.rotation.z = sway
        armL.rotation.x = sway * 0.6
        armR.rotation.x = -sway * 0.6
        break
      }
      case 'runup': {
        const stride = Math.sin(t * Math.PI * 2 * 3.2)
        legL.rotation.x = stride * 0.9
        legR.rotation.x = -stride * 0.9
        armL.rotation.x = -stride * 0.7
        armR.rotation.x = stride * 0.7
        torso.rotation.x = 0.15
        break
      }
      case 'kick': {
        const swing = t
        legR.rotation.x = -1.3 + swing * 2.1
        legL.rotation.x = 0.15
        armL.rotation.x = -0.6 - swing * 0.6
        armR.rotation.x = 0.3
        torso.rotation.x = -0.1 - swing * 0.25
        break
      }
      case 'diveLeft':
      case 'diveRight':
      case 'diveCenter': {
        const dir = phase === 'diveLeft' ? -1 : phase === 'diveRight' ? 1 : 0
        const stretch = t
        hips.rotation.z = dir * stretch * 1.1
        hips.position.y = 0.9 - stretch * 0.55
        armL.rotation.z = dir >= 0 ? stretch * 1.4 : -stretch * 0.4
        armR.rotation.z = dir <= 0 ? -stretch * 1.4 : stretch * 0.4
        legL.rotation.z = dir * stretch * 0.5
        legR.rotation.z = dir * stretch * 0.5
        break
      }
    }
  }

  setPose('idle', 0)
  return { root, setPose }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/game/engine3d/proceduralCharacter.ts
git commit --no-gpg-sign -m "feat: adiciona rig procedural do batedor e goleiro"
```

---

### Task 7: Controlador de personagem

**Files:**
- Create: `app/game/engine3d/character.ts`

**Interfaces:**
- Consumes: `buildProceduralCharacter`, `CharacterPhase`, `CharacterRole` de `./proceduralCharacter`.
- Produces: `Character` (interface: `{ object3D: Object3D; update(phase: CharacterPhase, t: number, deltaSeconds: number): void }`), `createCharacter(role): Character` — usado pela Task 12 (orquestrador).

- [ ] **Step 1: Implementar**

Crie `app/game/engine3d/character.ts`:

```ts
import type { Object3D } from 'three'
import { buildProceduralCharacter, type CharacterPhase, type CharacterRole } from './proceduralCharacter'

export interface Character {
  object3D: Object3D
  /** Ver a nota sobre a semantica de `t` em `ProceduralCharacter.setPose`. */
  update(phase: CharacterPhase, t: number, deltaSeconds: number): void
}

/**
 * Personagem 3D construido inteiramente por codigo — sem asset externo.
 * Ver "Global Constraints" no plano: nenhum pacote gratuito de
 * jogador/goleiro riggado com chute e mergulho foi encontrado, entao o rig
 * procedural e o unico caminho, nao um fallback de algo melhor.
 */
export function createCharacter(role: CharacterRole): Character {
  const procedural = buildProceduralCharacter(role)
  return {
    object3D: procedural.root,
    update(phase, t) {
      procedural.setPose(phase, t)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/game/engine3d/character.ts
git commit --no-gpg-sign -m "feat: adiciona controlador de personagem sobre o rig procedural"
```

---

### Task 8: Torcida em billboard 2D

**Files:**
- Create: `app/game/engine3d/crowdBillboard.ts`

**Interfaces:**
- Consumes: `CanvasTexture`, `Mesh`, `PlaneGeometry`, `MeshBasicMaterial` de `three`.
- Produces: `CrowdBillboard` (interface: `{ mesh: Mesh; setExcitement(value: number, now: number): void }`), `buildCrowdBillboard(width, height): CrowdBillboard` — usado pela Task 12.

- [ ] **Step 1: Implementar**

Crie `app/game/engine3d/crowdBillboard.ts`:

```ts
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

export interface CrowdBillboard {
  mesh: Mesh
  /** Chamar a cada quadro com o nivel de empolgacao (0 a 1) e o tempo atual em segundos. */
  setExcitement(value: number, now: number): void
}

const ROWS = 26
const CROWD_COLORS = [
  '#d8433b', '#e0e4ea', '#2e5fa3', '#e8b13f', '#43955f',
  '#8a4fa0', '#d97941', '#3fa3a0', '#c4cad4', '#a33b52'
]
const SKIN_TONES = ['#c98e63', '#8a5a3b', '#e2b48c', '#6e4428']

/**
 * Reaproveita a mesma tecnica de `renderCrowdLayers()` do motor 2D: dois
 * quadros pre-renderizados (variante 0 e 1, um com "pulo") aplicados como
 * texturas numa placa 3D atras do gol, com crossfade dirigido por
 * `crowdExcitement` — sem modelar a torcida em geometria 3D.
 */
export function buildCrowdBillboard(width: number, height: number): CrowdBillboard {
  const canvasA = buildCrowdCanvas(0)
  const canvasB = buildCrowdCanvas(1)
  const textureA = new CanvasTexture(canvasA)
  const textureB = new CanvasTexture(canvasB)

  const materialA = new MeshBasicMaterial({ map: textureA, transparent: true, opacity: 1 })
  const materialB = new MeshBasicMaterial({ map: textureB, transparent: true, opacity: 0 })

  const geometry = new PlaneGeometry(width, height)
  const mesh = new Mesh(geometry, materialA)

  const meshB = new Mesh(geometry.clone(), materialB)
  meshB.position.z = -0.01
  mesh.add(meshB)

  return {
    mesh,
    setExcitement(value, now) {
      const speed = value > 0 ? 9 : 2.2
      const phase = (Math.sin(now * speed) + 1) / 2
      const opacityB = Math.min(1, Math.max(0, phase)) * (value > 0 ? 1 : 0.55)
      // Crossfade simetrico: A cai conforme B sobe, para nao depender dos
      // vaos transparentes entre as figuras de A para revelar B por baixo.
      materialB.opacity = opacityB
      materialA.opacity = 1 - opacityB
    }
  }
}

function buildCrowdCanvas(variant: number): HTMLCanvasElement {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  let rng = 12345
  const rand = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff
    return rng / 0x7fffffff
  }

  for (let r = 0; r < ROWS; r++) {
    const t = r / (ROWS - 1)
    const y = t * size
    const bodySize = 6 + t * 6
    const step = bodySize * 2.1
    for (let x = step / 2 + (r % 2) * step * 0.5; x < size; x += step) {
      const bob = variant === 1 && rand() > 0.5 ? -bodySize * 0.45 : 0
      ctx.fillStyle = CROWD_COLORS[Math.floor(rand() * CROWD_COLORS.length)]!
      ctx.beginPath()
      ctx.arc(x, y + bob, bodySize * 0.62, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)]!
      ctx.beginPath()
      ctx.arc(x, y + bob - bodySize * 0.72, bodySize * 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return canvas
}
```

- [ ] **Step 2: Commit**

```bash
git add app/game/engine3d/crowdBillboard.ts
git commit --no-gpg-sign -m "feat: adiciona torcida como billboard 2D atras do gol"
```

---

### Task 9: Malhas de bola e rede

**Files:**
- Create: `app/game/engine3d/ballMesh.ts`
- Create: `app/game/engine3d/netMesh.ts`

**Interfaces:**
- Consumes: `ballFlightPosition`/`arcHeight` de `./ballFlight`; `netDisplacement`, `Ripple` de `./netRipple`; `WorldLayout` de `./worldGeometry`.
- Produces: `buildBallMesh(radius): Mesh`, `buildNetMesh(layout): { mesh: LineSegments; update(ripples, now): void }` — usados pela Task 12.

- [ ] **Step 1: Implementar a bola**

Crie `app/game/engine3d/ballMesh.ts`:

```ts
import { CanvasTexture, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'

/** Textura procedural de gomos, gerada uma vez e reaproveitada como mapa esferico. */
function buildBallTexture(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#20262e'
  for (let i = 0; i < 5; i++) {
    const cx = (size / 5) * i + size / 10
    const cy = size / 2
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  return new CanvasTexture(canvas)
}

export function buildBallMesh(radius: number): Mesh {
  const geometry = new SphereGeometry(radius, 24, 24)
  const material = new MeshStandardMaterial({ map: buildBallTexture(), roughness: 0.5 })
  return new Mesh(geometry, material)
}
```

- [ ] **Step 2: Implementar a rede**

Crie `app/game/engine3d/netMesh.ts`:

```ts
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three'
import type { Ripple } from './netRipple'
import { netDisplacement } from './netRipple'
import type { WorldLayout } from './worldGeometry'

export interface NetMesh {
  mesh: LineSegments
  update(ripples: Ripple[], now: number): void
}

const COLS = 15
const ROWS = 8

/**
 * Grade da rede de fundo do gol, com deslocamento por vertice calculado por
 * `netDisplacement()` (mesma matematica do motor 2D). O plano da rede fica
 * ligeiramente inclinado para tras (profundidade `goalDepth`), como no gol
 * de futebol real.
 */
export function buildNetMesh(layout: WorldLayout): NetMesh {
  const { goalWidth, goalHeight, goalDepth, goalCenterX, goalLineZ } = layout
  const left = goalCenterX - goalWidth / 2
  const backZ = goalLineZ - goalDepth

  const basePositions: { x: number; y: number; z: number }[] = []
  const indices: number[] = []

  const at = (c: number, r: number) => r * (COLS + 1) + c

  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const x = left + (goalWidth * c) / COLS
      const y = goalHeight * (1 - r / ROWS)
      const z = backZ + ((goalLineZ - backZ) * r) / ROWS
      basePositions.push({ x, y, z })
    }
  }
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      indices.push(at(c, r), at(c + 1, r))
    }
  }
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      indices.push(at(c, r), at(c, r + 1))
    }
  }

  const positionArray = new Float32Array(indices.length * 3)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positionArray, 3))
  const mesh = new LineSegments(geometry, new LineBasicMaterial({ color: 0xebf0f8, transparent: true, opacity: 0.5 }))

  function update(ripples: Ripple[], now: number) {
    const attr = geometry.getAttribute('position') as BufferAttribute
    for (let i = 0; i < indices.length; i++) {
      const base = basePositions[indices[i]!]!
      const disp = netDisplacement({ x: base.x, y: base.y }, ripples, now, goalWidth, goalHeight)
      attr.setXYZ(i, base.x, base.y + disp, base.z + disp * 0.35)
    }
    attr.needsUpdate = true
  }

  update([], 0)
  return { mesh, update }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/game/engine3d/ballMesh.ts app/game/engine3d/netMesh.ts
git commit --no-gpg-sign -m "feat: adiciona malhas 3D de bola e rede"
```

---

### Task 10: Câmera dinâmica

**Files:**
- Create: `app/game/engine3d/cameraRig.ts`

**Interfaces:**
- Consumes: `PerspectiveCamera`, `Vector3` de `three`; `EngineState`, `Vec3` de `../types`.
- Produces: `CameraRig` (interface: `{ camera: PerspectiveCamera; update(state, stateT, ballPos): void; resize(aspect): void }`), `buildCameraRig(): CameraRig` — usado pela Task 12.

- [ ] **Step 1: Implementar**

Crie `app/game/engine3d/cameraRig.ts`:

```ts
import { PerspectiveCamera, Vector3 } from 'three'
import type { EngineState, Vec3 } from '../types'

export interface CameraRig {
  camera: PerspectiveCamera
  update(state: EngineState, stateT: number, ballPos: Vec3): void
  resize(aspect: number): void
}

const BASE_POSITION = new Vector3(0, 1.65, 13.5)
const LOOK_AT_GOAL = new Vector3(0, 1.1, 0)

/**
 * Camera atras do batedor. No chute (flight), faz um dolly sutil em
 * direcao a bola; no impacto (inicio de aftermath), um shake rapido —
 * mesma magnitude usada no motor 2D, agora como movimento real de camera.
 */
export function buildCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(52, 16 / 9, 0.1, 60)
  camera.position.copy(BASE_POSITION)
  camera.lookAt(LOOK_AT_GOAL)

  function update(state: EngineState, stateT: number, ballPos: Vec3) {
    const dolly = new Vector3().copy(BASE_POSITION)
    const lookAt = new Vector3().copy(LOOK_AT_GOAL)

    if (state === 'flight') {
      const t = Math.min(1, stateT / 0.5)
      dolly.lerp(new Vector3(ballPos.x * 0.3, 1.4, 7), t * 0.4)
      lookAt.set(ballPos.x, ballPos.y, ballPos.z)
    } else if (state === 'aftermath') {
      const decay = Math.max(0, 1 - stateT / 0.4)
      const shakeMag = 0.05 * decay
      dolly.x += Math.sin(stateT * 55) * shakeMag
      dolly.y += Math.cos(stateT * 47) * shakeMag * 0.6
    }

    camera.position.copy(dolly)
    camera.lookAt(lookAt)
  }

  function resize(aspect: number) {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }

  return { camera, update, resize }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/game/engine3d/cameraRig.ts
git commit --no-gpg-sign -m "feat: adiciona camera dinamica com travelling e shake"
```

---

### Task 11: Conversão de mira por raycasting

**Files:**
- Create: `app/game/engine3d/aimInput.ts`

**Interfaces:**
- Consumes: `Raycaster`, `Plane`, `Vector2`, `Vector3`, `PerspectiveCamera` de `three`; `clampAim`, `WorldLayout` de `./worldGeometry`.
- Produces: `screenToAim(clientX, clientY, canvasRect, camera, layout): Vec2` — usado pela Task 12.

- [ ] **Step 1: Implementar**

Crie `app/game/engine3d/aimInput.ts`:

```ts
import { Plane, type PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import type { Vec2 } from '../types'
import { clampAim, type WorldLayout } from './worldGeometry'

const raycaster = new Raycaster()
const ndc = new Vector2()
const hit = new Vector3()

/**
 * Converte um ponto de toque/clique na tela em coordenada de mundo no plano
 * do gol, via raycast da camera. Substitui a conversao direta de pixels
 * (`toLocal`) do motor 2D — o resto do fluxo (clamp aos limites do gol,
 * disparo do chute) continua identico.
 */
export function screenToAim(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  camera: PerspectiveCamera,
  layout: WorldLayout
): Vec2 {
  ndc.x = ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1
  ndc.y = -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1

  raycaster.setFromCamera(ndc, camera)
  const goalPlane = new Plane(new Vector3(0, 0, 1), -layout.goalLineZ)
  raycaster.ray.intersectPlane(goalPlane, hit)

  return clampAim(hit.x, hit.y, layout.aimBounds)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/game/engine3d/aimInput.ts
git commit --no-gpg-sign -m "feat: adiciona conversao de toque em coordenada de mira 3D via raycast"
```

---

### Task 12: Orquestrador `PenaltyEngine3D`

**Files:**
- Create: `app/game/engine3d/penaltyEngine3d.ts`

**Interfaces:**
- Consumes: todos os módulos das Tasks 2–11 (`computeWorldLayout`, `decideShot`, `ballFlightPosition`/`arcHeight`, `netDisplacement`, `createCharacter`, `buildCrowdBillboard`, `buildBallMesh`, `buildNetMesh`, `buildCameraRig`, `screenToAim`), `EngineCallbacks`/`EngineState`/`ShotOutcome`/`Vec2` de `../types`.
- Produces: classe `PenaltyEngine3D` com a **mesma interface pública** de `PenaltyEngine` (`constructor(canvas, callbacks)`, `reset()`, `destroy()`, `state`) — usada pela Task 13 (`PenaltyGame.client.vue`).

- [ ] **Step 1: Implementar**

Crie `app/game/engine3d/penaltyEngine3d.ts`:

```ts
import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Group,
  Mesh,
  WebGLRenderer
} from 'three'
import type { EngineCallbacks, EngineState, ShotOutcome, Vec2 } from '../types'
import type { Character } from './character'
import { createCharacter } from './character'
import { buildBallMesh } from './ballMesh'
import { arcHeight, ballFlightPosition } from './ballFlight'
import { buildCameraRig, type CameraRig } from './cameraRig'
import { buildCrowdBillboard, type CrowdBillboard } from './crowdBillboard'
import { decideShot } from './goalkeeperAI'
import { buildNetMesh, type NetMesh } from './netMesh'
import type { Ripple } from './netRipple'
import { screenToAim } from './aimInput'
import { clampAim, computeWorldLayout, type WorldLayout } from './worldGeometry'

const TIMINGS = { runup: 0.72, strike: 0.16, flight: 0.5, aftermath: 1.35 }

export class PenaltyEngine3D {
  private canvas: HTMLCanvasElement
  private cb: EngineCallbacks
  private renderer: WebGLRenderer
  private cameraRig: CameraRig
  private layout: WorldLayout
  private clock = new Clock()
  private raf = 0
  private destroyed = false

  state: EngineState = 'ready'
  private stateStart = 0

  private hasAim = false
  private pointerActive = false
  private aim: Vec2 = { x: 0, y: 0 }
  private shotTarget: Vec2 = { x: 0, y: 0 }
  private outcome: ShotOutcome = 'goal'
  private diveTarget: Vec2 = { x: 0, y: 0 }

  private ballStart = { x: 0, y: 0.11, z: 0 }
  private ballEnd = { x: 0, y: 0.11, z: 0 }
  private ballPos = { x: 0, y: 0.11, z: 0 }
  private ripples: Ripple[] = []
  private resultSent = false

  private scene = new Group()
  private ballMesh: Mesh
  private netMesh: NetMesh
  private crowd: CrowdBillboard
  private kicker: Character
  private keeper: Character

  private resizeObserver: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas
    this.cb = callbacks
    this.layout = computeWorldLayout()
    this.ballStart = { x: 0, y: this.layout.ballRadius, z: this.layout.spotZ }
    this.ballPos = { ...this.ballStart }

    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    // shadowMap.enabled fica false (padrao) de proposito: sem sombras dinamicas no v1.

    this.cameraRig = buildCameraRig()

    this.scene.add(new AmbientLight(0xffffff, 0.7))
    const sun = new DirectionalLight(0xfff2d0, 0.8)
    sun.position.set(-4, 8, 6)
    this.scene.add(sun)

    this.ballMesh = buildBallMesh(this.layout.ballRadius)
    this.scene.add(this.ballMesh)

    this.netMesh = buildNetMesh(this.layout)
    this.scene.add(this.netMesh.mesh)

    this.crowd = buildCrowdBillboard(this.layout.goalWidth * 3, this.layout.goalHeight * 2.2)
    this.crowd.mesh.position.set(0, this.layout.goalHeight * 1.1, this.layout.goalLineZ - this.layout.goalDepth - 0.5)
    this.scene.add(this.crowd.mesh)

    this.kicker = createCharacter('kicker')
    this.kicker.object3D.position.set(-1.2, 0, this.layout.spotZ + 0.6)
    this.scene.add(this.kicker.object3D)

    this.keeper = createCharacter('keeper')
    this.keeper.object3D.position.set(0, 0, this.layout.goalLineZ - 0.1)
    this.scene.add(this.keeper.object3D)

    this.handleResize()
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    this.stateStart = this.clock.getElapsedTime()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.renderer.dispose()
  }

  reset() {
    this.setState('ready')
    this.hasAim = false
    this.pointerActive = false
    this.resultSent = false
    this.ripples = []
    this.ballPos = { ...this.ballStart }
  }

  // ------------------------------------------------------------------
  // Entrada do jogador
  // ------------------------------------------------------------------

  private onPointerDown = (e: PointerEvent) => {
    if (this.state !== 'ready' && this.state !== 'aiming') return
    this.pointerActive = true
    this.aim = screenToAim(e.clientX, e.clientY, this.canvas.getBoundingClientRect(), this.cameraRig.camera, this.layout)
    this.hasAim = true
    this.setState('aiming')
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerActive || this.state !== 'aiming') return
    this.aim = screenToAim(e.clientX, e.clientY, this.canvas.getBoundingClientRect(), this.cameraRig.camera, this.layout)
  }

  private onPointerUp = () => {
    if (!this.pointerActive) return
    this.pointerActive = false
    if (this.state === 'aiming' && this.hasAim) this.shoot(this.aim)
  }

  // ------------------------------------------------------------------
  // Logica da cobranca
  // ------------------------------------------------------------------

  private shoot(target: Vec2) {
    this.shotTarget = clampAim(target.x, target.y, this.layout.aimBounds)
    const decision = decideShot(this.shotTarget, this.layout)
    this.outcome = decision.outcome
    this.diveTarget = decision.diveTarget

    this.ballEnd =
      this.outcome === 'out'
        ? { x: this.shotTarget.x * 1.3, y: this.shotTarget.y, z: this.layout.goalLineZ - this.layout.goalDepth * 1.6 }
        : { x: this.shotTarget.x, y: this.shotTarget.y, z: this.layout.goalLineZ }

    this.hasAim = false
    this.setState('runup')
  }

  private setState(s: EngineState) {
    this.state = s
    this.stateStart = this.clock.getElapsedTime()
    this.cb.onStateChange?.(s)
  }

  // ------------------------------------------------------------------
  // Loop principal
  // ------------------------------------------------------------------

  private frame = () => {
    if (this.destroyed) return
    const delta = this.clock.getDelta()
    const now = this.clock.getElapsedTime()
    this.update(now, delta)
    this.render()
    this.raf = requestAnimationFrame(this.frame)
  }

  private stateT(now: number) {
    return now - this.stateStart
  }

  private update(now: number, delta: number) {
    const t = this.stateT(now)

    switch (this.state) {
      case 'runup':
        this.kicker.update('runup', Math.min(1, t / TIMINGS.runup), delta)
        this.keeper.update('idle', now, delta)
        if (t >= TIMINGS.runup) this.setState('strike')
        break
      case 'strike':
        this.kicker.update('kick', Math.min(1, t / TIMINGS.strike), delta)
        if (t >= TIMINGS.strike) {
          this.cb.onKick?.()
          this.setState('flight')
        }
        break
      case 'flight': {
        const ft = Math.min(1, t / TIMINGS.flight)
        const height = arcHeight(this.shotTarget.y, this.layout.goalHeight)
        this.ballPos = ballFlightPosition(this.ballStart, this.ballEnd, ft, height)
        const divePhase = this.diveTarget.x < -0.3 ? 'diveLeft' : this.diveTarget.x > 0.3 ? 'diveRight' : 'diveCenter'
        this.keeper.update(divePhase, ft, delta)
        if (ft >= 1) this.onBallArrive(now)
        break
      }
      case 'aftermath':
        if (t >= TIMINGS.aftermath) {
          if (!this.resultSent) {
            this.resultSent = true
            this.cb.onResult(this.outcome)
          }
          this.setState('done')
        }
        break
      default:
        this.kicker.update('idle', now, delta)
        this.keeper.update('idle', now, delta)
    }

    this.crowd.setExcitement(this.outcome === 'goal' && this.state !== 'ready' ? 1 : 0, now)
    this.netMesh.update(this.ripples, now)
    this.ballMesh.position.set(this.ballPos.x, this.ballPos.y, this.ballPos.z)
    this.cameraRig.update(this.state, t, this.ballPos)
  }

  private onBallArrive(now: number) {
    this.cb.onImpact?.(this.outcome)
    if (this.outcome === 'goal') {
      this.ripples.push({ x: this.ballEnd.x, y: this.ballEnd.y, start: now })
    }
    this.setState('aftermath')
  }

  private render() {
    this.renderer.render(this.scene, this.cameraRig.camera)
  }

  // ------------------------------------------------------------------
  // Resize
  // ------------------------------------------------------------------

  private handleResize() {
    const parent = this.canvas.parentElement
    const w = parent?.clientWidth ?? window.innerWidth
    const h = parent?.clientHeight ?? window.innerHeight
    this.renderer.setSize(w, h, false)
    this.cameraRig.resize(w / h)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/game/engine3d/penaltyEngine3d.ts
git commit --no-gpg-sign -m "feat: adiciona orquestrador PenaltyEngine3D"
```

---

### Task 13: Integração em `PenaltyGame.client.vue` e verificação manual

**Files:**
- Modify: `app/components/PenaltyGame.client.vue:1-2` (imports) e `app/components/PenaltyGame.client.vue:72-81` (`onMounted`)

**Interfaces:**
- Consumes: `PenaltyEngine3D` de `~/game/engine3d/penaltyEngine3d`, `ShotOutcome`/`EngineState` de `~/game/types` (no lugar de `~/game/engine`).

- [ ] **Step 1: Trocar os imports**

Em `app/components/PenaltyGame.client.vue`, substitua a linha 2:

```ts
import { PenaltyEngine, type ShotOutcome, type EngineState } from '~/game/engine'
```

por:

```ts
import { PenaltyEngine3D } from '~/game/engine3d/penaltyEngine3d'
import type { ShotOutcome, EngineState } from '~/game/types'
```

- [ ] **Step 2: Trocar a declaração da variável do motor**

Substitua (linha 19):

```ts
let engine: PenaltyEngine | null = null
```

por:

```ts
let engine: PenaltyEngine3D | null = null
```

- [ ] **Step 3: Trocar a instanciação no `onMounted`**

Substitua a linha `engine = new PenaltyEngine(canvasRef.value, {` por:

```ts
  engine = new PenaltyEngine3D(canvasRef.value, {
```

(o corpo do objeto de callbacks permanece idêntico).

- [ ] **Step 4: Rodar o dev server e verificar manualmente**

Run: `npm run dev`

Abra o jogo no navegador (preview) e confirme, em ordem:
1. O canvas renderiza a cena 3D (chão/gol/goleiro visíveis) sem erros no console.
2. Mira por toque/arraste funciona e o indicador de mira responde.
3. Um chute para dentro do gol, longe do goleiro, resulta em `goal` (modal de vitória abre).
4. Um chute repetido no mesmo canto favorito do goleiro eventualmente resulta em `save`.
5. Um chute mirado fora dos limites do gol resulta em `out`.
6. Redimensionar a janela (ou girar o dispositivo simulando retrato/paisagem) não quebra a câmera nem corta a cena.
7. Sem quedas de frame perceptíveis (checar o painel de performance do navegador) em condições comparáveis a um Android de entrada (throttling de CPU 4x no Chrome DevTools).

- [ ] **Step 5: Commit**

```bash
git add app/components/PenaltyGame.client.vue
git commit --no-gpg-sign -m "feat: troca o motor grafico do jogo de Canvas 2D para PenaltyEngine3D"
```

---

### Task 14: Remoção do motor 2D antigo

**Files:**
- Delete: `app/game/engine.ts`

- [ ] **Step 1: Confirmar que nada mais importa `app/game/engine.ts`**

Run: `grep -rn "from '~/game/engine'" app/ ; grep -rn "from '\.\./game/engine'" app/`
Expected: nenhuma ocorrência (a Task 13 já trocou o único import existente).

- [ ] **Step 2: Remover o arquivo**

Run: `git rm app/game/engine.ts`

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm run test:unit`
Expected: todos os testes das Tasks 1–5 continuam passando (não dependem de `engine.ts`).

- [ ] **Step 4: Commit**

```bash
git commit --no-gpg-sign -m "chore: remove o motor grafico 2D substituido pelo PenaltyEngine3D"
```

---

## Notas para quem for executar

- Personagens são 100% procedurais (Tasks 6/7) — não há tentativa de download de asset externo nem dependência de rede para a camada de personagens. Pesquisa prévia confirmou que não existe pacote gratuito de jogador+goleiro riggado com chute/mergulho.
- Todos os commits usam `git commit --no-gpg-sign` (ver Global Constraints) — não remover a flag nem tentar reabilitar assinatura sem checar com o usuário primeiro.
- A Task 12 é a maior e mais arriscada — se o Code Reviewer (ou o próprio executor) achar que ficou grande demais para revisar de uma vez, é aceitável quebrá-la em duas entregas (ex: estado + input primeiro, integração de cena visual depois), desde que o teste manual da Task 13 só rode no final.
