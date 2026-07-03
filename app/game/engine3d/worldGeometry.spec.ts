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
