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
