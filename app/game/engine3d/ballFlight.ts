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
