import type { Vec2 } from '../types'
import type { WorldLayout } from './worldGeometry'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Fracao da altura do gol usada como "alcance" do goleiro a partir do
 * ponto de mergulho — usada so pelos testes para confirmar que o mergulho
 * de "goal" sempre fica fora de alcance. `computeDiveTarget` nunca calcula
 * resultado a partir dela — so usa o lado oposto do gol, que ja garante
 * distancia maior por construcao.
 */
export const KEEPER_REACH_FACTOR = 0.36

/**
 * O goleiro nao decide mais o resultado (isso vem pronto da API, ver
 * `PenaltyPlayResult` em `useGameApi.ts`) — so calcula PARA ONDE ele
 * mergulha dado um resultado ja definido. `outcome: 'save'` mergulha exato
 * no alvo (defende sempre); `outcome: 'goal'` mergulha para o lado oposto
 * do gol (erra sempre, distancia sempre maior que o alcance).
 */
export function computeDiveTarget(
  outcome: 'goal' | 'save',
  aimX: number,
  layout: WorldLayout,
  rng: () => number = Math.random
): Vec2 {
  const { aimBounds, goalCenterX, keeperHeight } = layout

  if (outcome === 'save') {
    return { x: aimX, y: keeperHeight }
  }

  const farX = aimX <= goalCenterX ? aimBounds.maxX : aimBounds.minX
  const rowsY = [
    lerp(aimBounds.minY, aimBounds.maxY, 0.68),
    lerp(aimBounds.minY, aimBounds.maxY, 0.18)
  ]
  const y = rng() < 0.5 ? rowsY[0]! : rowsY[1]!
  return { x: farX, y }
}
