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
