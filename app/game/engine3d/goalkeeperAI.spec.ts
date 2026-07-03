import { describe, expect, it } from 'vitest'
import { computeDiveTarget, KEEPER_REACH_FACTOR } from './goalkeeperAI'
import { computeWorldLayout } from './worldGeometry'

function seq(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('computeDiveTarget', () => {
  const layout = computeWorldLayout()
  const reach = layout.goalHeight * KEEPER_REACH_FACTOR
  const sampleAimXs = [
    layout.aimBounds.minX,
    layout.aimBounds.minX / 2,
    layout.goalCenterX,
    layout.aimBounds.maxX / 2,
    layout.aimBounds.maxX
  ]

  it('outcome "save" sempre mergulha exatamente no aimX, na altura do goleiro', () => {
    for (const aimX of sampleAimXs) {
      const target = computeDiveTarget('save', aimX, layout, seq(0.3))
      expect(target.x).toBeCloseTo(aimX)
      expect(target.y).toBe(layout.keeperHeight)
    }
  })

  it('outcome "goal" sempre mergulha a uma distancia maior que o alcance do aimX', () => {
    for (const aimX of sampleAimXs) {
      const target = computeDiveTarget('goal', aimX, layout, seq(0.9))
      const dist = Math.hypot(target.x - aimX, target.y - layout.keeperHeight)
      expect(dist).toBeGreaterThan(reach)
    }
  })

  it('outcome "goal" mergulha para o lado oposto do aimX', () => {
    const rightAim = layout.aimBounds.maxX
    const target = computeDiveTarget('goal', rightAim, layout, seq(0.1))
    expect(target.x).toBeLessThan(rightAim)
  })
})
