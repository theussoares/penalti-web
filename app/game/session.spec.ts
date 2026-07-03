import { describe, expect, it } from 'vitest'
import { chancesRestantes, filtrarPremiosGanhados, isSessionOver } from './session'
import type { PenaltyPlayResult } from '../composables/useGameApi'

function item(overrides: Partial<PenaltyPlayResult>): PenaltyPlayResult {
  return {
    id: 1,
    chave_giro: 'x',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    nome: 'Nao foi dessa vez',
    valor: null,
    ...overrides
  }
}

describe('chancesRestantes', () => {
  it('conta ganhou e nao_ganhou, mas nao conta replay', () => {
    const fila = [
      item({ tipo_acao: 'ganhou', tipo_premio: 'valor' }),
      item({ tipo_acao: 'replay', tipo_premio: 'replay' }),
      item({ tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou' })
    ]
    expect(chancesRestantes(fila)).toBe(2)
  })

  it('retorna 0 para fila vazia', () => {
    expect(chancesRestantes([])).toBe(0)
  })

  it('retorna 0 quando a fila so tem replays', () => {
    const fila = [item({ tipo_acao: 'replay', tipo_premio: 'replay' })]
    expect(chancesRestantes(fila)).toBe(0)
  })
})

describe('isSessionOver', () => {
  it('true quando a fila esta vazia', () => {
    expect(isSessionOver([])).toBe(true)
  })

  it('false enquanto a fila tiver qualquer item, incluindo so replay', () => {
    expect(isSessionOver([item({ tipo_acao: 'replay', tipo_premio: 'replay' })])).toBe(false)
  })
})

describe('filtrarPremiosGanhados', () => {
  it('inclui apenas ganhou com tipo_premio valor ou cota', () => {
    const resultados = [
      item({ tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 50,00', valor: '50' }),
      item({ tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou' }),
      item({ tipo_acao: 'replay', tipo_premio: 'replay' }),
      item({ tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '5 Cotas', valor: '5' })
    ]
    expect(filtrarPremiosGanhados(resultados)).toEqual([
      { nome: 'R$ 50,00', tipo_premio: 'valor', valor: '50' },
      { nome: '5 Cotas', tipo_premio: 'cota', valor: '5' }
    ])
  })

  it('retorna array vazio quando nao ha premios ganhos', () => {
    const resultados = [
      item({ tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou' }),
      item({ tipo_acao: 'replay', tipo_premio: 'replay' })
    ]
    expect(filtrarPremiosGanhados(resultados)).toEqual([])
  })
})
