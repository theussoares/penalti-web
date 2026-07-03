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
