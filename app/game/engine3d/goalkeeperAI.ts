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
