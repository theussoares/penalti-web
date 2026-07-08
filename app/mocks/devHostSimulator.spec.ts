import { describe, expect, it } from 'vitest'
import { gerarSessaoMock, mockPlayResult, pickScenario } from './devHostSimulator'
import { PENALTY_SCENARIOS } from './penaltySequences'

describe('mockPlayResult', () => {
  it('gera itens no formato PenaltyPlayResult', () => {
    for (let i = 0; i < 50; i++) {
      const r = mockPlayResult()
      expect(typeof r.id).toBe('number')
      expect(typeof r.chave_giro).toBe('string')
      expect(['ganhou', 'nao_ganhou', 'replay']).toContain(r.tipo_acao)
      expect(['valor', 'cota', 'nao_ganhou', 'replay']).toContain(r.tipo_premio)
      expect(typeof r.nome).toBe('string')
      expect(r.valor === null || typeof r.valor === 'string').toBe(true)
    }
  })

  it('tipo_acao e tipo_premio sempre combinam ("nao_ganhou"/"replay" batem, "ganhou" nunca vem com eles)', () => {
    for (let i = 0; i < 100; i++) {
      const r = mockPlayResult()
      if (r.tipo_acao === 'nao_ganhou') expect(r.tipo_premio).toBe('nao_ganhou')
      if (r.tipo_acao === 'replay') expect(r.tipo_premio).toBe('replay')
      if (r.tipo_acao === 'ganhou') {
        expect(r.tipo_premio).not.toBe('nao_ganhou')
        expect(r.tipo_premio).not.toBe('replay')
      }
    }
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

describe('gerarSessaoMock', () => {
  it('retorna o cenario fixo quando a chave existe', () => {
    const resultado = gerarSessaoMock(5, 'todos_replays')
    expect(resultado).toEqual(PENALTY_SCENARIOS.todos_replays)
  })

  it('gera exatamente `count` itens aleatorios quando nao ha cenario', () => {
    const resultado = gerarSessaoMock(15, null)
    expect(resultado).toHaveLength(15)
  })

  it('gera exatamente `count` itens quando cenarioKey nao e passado', () => {
    const resultado = gerarSessaoMock(8)
    expect(resultado).toHaveLength(8)
  })
})
