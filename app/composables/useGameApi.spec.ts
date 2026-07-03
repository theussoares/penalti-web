import { describe, expect, it } from 'vitest'
import { pickScenario, useGameApi } from './useGameApi'
import { PENALTY_SCENARIOS } from '../mocks/penaltySequences'

describe('useGameApi', () => {
  it('fetchPlaySequence retorna exatamente `count` itens no formato PenaltyPlayResult', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 15)
    expect(results).toHaveLength(15)
    for (const r of results) {
      expect(typeof r.id).toBe('number')
      expect(typeof r.chave_giro).toBe('string')
      expect(['ganhou', 'nao_ganhou', 'replay']).toContain(r.tipo_acao)
      expect(['valor', 'cota', 'nao_ganhou', 'replay']).toContain(r.tipo_premio)
      expect(typeof r.nome).toBe('string')
      expect(r.valor === null || typeof r.valor === 'string').toBe(true)
    }
  })

  it('tipo_acao e tipo_premio sempre combinam ("nao_ganhou"/"replay" batem, "ganhou" nunca vem com eles)', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 60)
    for (const r of results) {
      if (r.tipo_acao === 'nao_ganhou') expect(r.tipo_premio).toBe('nao_ganhou')
      if (r.tipo_acao === 'replay') expect(r.tipo_premio).toBe('replay')
      if (r.tipo_acao === 'ganhou') {
        expect(r.tipo_premio).not.toBe('nao_ganhou')
        expect(r.tipo_premio).not.toBe('replay')
      }
    }
  })

  it('gera pelo menos uma vitoria, uma derrota e um replay numa amostra grande', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 120)
    expect(results.some((r) => r.tipo_acao === 'ganhou')).toBe(true)
    expect(results.some((r) => r.tipo_acao === 'nao_ganhou')).toBe(true)
    expect(results.some((r) => r.tipo_acao === 'replay')).toBe(true)
  })
})

describe('pickScenario', () => {
  it('retorna null quando a chave e null', () => {
    expect(pickScenario(null)).toBeNull()
  })

  it('retorna null quando a chave nao existe em nenhum cenario', () => {
    expect(pickScenario('chave-inexistente')).toBeNull()
  })

  it('retorna uma copia do cenario quando a chave existe', () => {
    const resultado = pickScenario('todas_derrotas')
    expect(resultado).toEqual(PENALTY_SCENARIOS.todas_derrotas)
    expect(resultado).not.toBe(PENALTY_SCENARIOS.todas_derrotas)
  })
})
