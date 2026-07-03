import { describe, expect, it } from 'vitest'
import { useGameApi } from './useGameApi'

describe('useGameApi', () => {
  it('fetchPlaySequence retorna exatamente `count` itens no formato PenaltyPlayResult', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 15)
    expect(results).toHaveLength(15)
    for (const r of results) {
      expect(typeof r.id).toBe('number')
      expect(typeof r.chave_giro).toBe('string')
      expect(['ganhou', 'nao_ganhou']).toContain(r.tipo_acao)
      expect(['valor', 'cota', 'nao_ganhou']).toContain(r.tipo_premio)
      expect(typeof r.nome).toBe('string')
      expect(r.valor === null || typeof r.valor === 'string').toBe(true)
    }
  })

  it('tipo_acao "nao_ganhou" sempre vem com tipo_premio "nao_ganhou", e "ganhou" nunca vem com ele', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 60)
    for (const r of results) {
      if (r.tipo_acao === 'nao_ganhou') expect(r.tipo_premio).toBe('nao_ganhou')
      if (r.tipo_acao === 'ganhou') expect(r.tipo_premio).not.toBe('nao_ganhou')
    }
  })

  it('gera pelo menos uma vitoria e uma derrota numa amostra grande', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 80)
    expect(results.some((r) => r.tipo_acao === 'ganhou')).toBe(true)
    expect(results.some((r) => r.tipo_acao === 'nao_ganhou')).toBe(true)
  })
})
