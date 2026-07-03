import { describe, expect, it } from 'vitest'
import type { EngineState, ShotOutcome } from './types'

describe('types compartilhados', () => {
  it('aceita os valores validos de ShotOutcome', () => {
    const outcomes: ShotOutcome[] = ['goal', 'save']
    expect(outcomes).toHaveLength(2)
  })

  it('aceita os valores validos de EngineState', () => {
    const states: EngineState[] = ['ready', 'aiming', 'runup', 'strike', 'flight', 'aftermath', 'done']
    expect(states).toHaveLength(7)
  })
})
