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
