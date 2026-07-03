import { describe, expect, it } from 'vitest'
import { PENALTY_SCENARIOS } from './penaltySequences'

describe('PENALTY_SCENARIOS', () => {
  const chaves = Object.keys(PENALTY_SCENARIOS)

  it('tem os cenarios esperados', () => {
    expect(chaves).toEqual(
      expect.arrayContaining([
        'todas_derrotas',
        'todos_ganhos_valor',
        'todos_ganhos_cota',
        'todos_replays',
        'alternado',
        'valores_altos',
        'replay_depois_ganho'
      ])
    )
  })

  it('cada cenario tem itens no formato PenaltyPlayResult', () => {
    for (const chave of chaves) {
      const cenario = PENALTY_SCENARIOS[chave]!
      expect(cenario.length).toBeGreaterThan(0)
      for (const item of cenario) {
        expect(typeof item.id).toBe('number')
        expect(typeof item.chave_giro).toBe('string')
        expect(['ganhou', 'nao_ganhou', 'replay']).toContain(item.tipo_acao)
        expect(['valor', 'cota', 'nao_ganhou', 'replay']).toContain(item.tipo_premio)
        expect(typeof item.nome).toBe('string')
        expect(item.valor === null || typeof item.valor === 'string').toBe(true)
      }
    }
  })

  it('cada chave_giro e unica dentro do proprio cenario', () => {
    for (const chave of chaves) {
      const cenario = PENALTY_SCENARIOS[chave]!
      const chavesGiro = cenario.map((item) => item.chave_giro)
      expect(new Set(chavesGiro).size).toBe(chavesGiro.length)
    }
  })
})
