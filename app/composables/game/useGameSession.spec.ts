import { describe, expect, it } from 'vitest'
import { useGameSession } from './useGameSession'
import type { PenaltyPlayResult } from '../../types/game'

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

describe('useGameSession', () => {
  it('inicializa a fila a partir de `resultados`, sem fetch', () => {
    const resultados = [item({ id: 1 }), item({ id: 2, tipo_acao: 'ganhou', tipo_premio: 'valor' })]
    const { chancesRestantesValue, sessaoEncerrada } = useGameSession(resultados)
    expect(chancesRestantesValue.value).toBe(2)
    expect(sessaoEncerrada.value).toBe(false)
  })

  it('consumeNextPlay tira o proximo item da fila e vira currentPlayResult', () => {
    const resultados = [item({ id: 1 }), item({ id: 2 })]
    const { consumeNextPlay, currentPlayResult, chancesRestantesValue } = useGameSession(resultados)
    const resultado = consumeNextPlay()
    expect(resultado?.id).toBe(1)
    expect(currentPlayResult.value?.id).toBe(1)
    expect(chancesRestantesValue.value).toBe(1)
  })

  it('consumeNextPlay retorna null quando a fila ja esta vazia', () => {
    const { consumeNextPlay } = useGameSession([])
    expect(consumeNextPlay()).toBeNull()
  })

  it('registerPlayedResult acumula o item atual no history', () => {
    const resultados = [item({ id: 1 })]
    const { consumeNextPlay, registerPlayedResult, history } = useGameSession(resultados)
    consumeNextPlay()
    registerPlayedResult()
    expect(history.value).toHaveLength(1)
    expect(history.value[0]?.id).toBe(1)
  })

  it('sessaoEncerrada fica true quando a fila esvazia', () => {
    const resultados = [item({ id: 1 })]
    const { consumeNextPlay, registerPlayedResult, sessaoEncerrada } = useGameSession(resultados)
    expect(sessaoEncerrada.value).toBe(false)
    consumeNextPlay()
    registerPlayedResult()
    expect(sessaoEncerrada.value).toBe(true)
  })

  it('nao muta o array original recebido por prop', () => {
    const resultados = [item({ id: 1 }), item({ id: 2 })]
    const { consumeNextPlay } = useGameSession(resultados)
    consumeNextPlay()
    expect(resultados).toHaveLength(2)
  })
})
