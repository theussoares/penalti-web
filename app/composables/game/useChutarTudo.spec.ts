import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useChutarTudo } from './useChutarTudo'
import type { PenaltyPlayResult } from '../../types/game'

function item(overrides: Partial<PenaltyPlayResult>): PenaltyPlayResult {
  return {
    id: 1,
    chave_giro: 'x',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    nome: 'x',
    valor: null,
    ...overrides
  }
}

describe('useChutarTudo', () => {
  it('podeChutarTudo e falso com 1 ou 0 chances restantes', () => {
    const playQueue = ref<PenaltyPlayResult[]>([item({})])
    const history = ref<PenaltyPlayResult[]>([])
    const chancesRestantesValue = ref(1)
    const engineState = ref('ready')
    const { podeChutarTudo } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    expect(podeChutarTudo.value).toBe(false)
  })

  it('podeChutarTudo e verdadeiro com mais de 1 chance e motor pronto', () => {
    const playQueue = ref<PenaltyPlayResult[]>([item({}), item({})])
    const history = ref<PenaltyPlayResult[]>([])
    const chancesRestantesValue = ref(2)
    const engineState = ref('ready')
    const { podeChutarTudo } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    expect(podeChutarTudo.value).toBe(true)
  })

  it('podeChutarTudo e falso enquanto o motor esta animando', () => {
    const playQueue = ref<PenaltyPlayResult[]>([item({}), item({})])
    const history = ref<PenaltyPlayResult[]>([])
    const chancesRestantesValue = ref(2)
    const engineState = ref('strike')
    const { podeChutarTudo } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    expect(podeChutarTudo.value).toBe(false)
  })

  it('processAllRemainingPlays move tudo da fila pro history, preservando o que ja tinha', () => {
    const jaJogado = item({ id: 1, tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 10,00' })
    const restante1 = item({ id: 2, tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 20,00' })
    const restante2 = item({ id: 3 })
    const playQueue = ref<PenaltyPlayResult[]>([restante1, restante2])
    const history = ref<PenaltyPlayResult[]>([jaJogado])
    const chancesRestantesValue = ref(2)
    const engineState = ref('ready')
    const { processAllRemainingPlays } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    processAllRemainingPlays()
    expect(playQueue.value).toHaveLength(0)
    expect(history.value).toEqual([jaJogado, restante1, restante2])
  })
})
