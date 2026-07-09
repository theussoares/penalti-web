import { PENALTY_SCENARIOS } from './penaltySequences'
import type { PenaltyPlayResult } from '~/types/game'

/** Tamanho da sessao mock gerada pelo harness de dev (`pages/index.vue`). */
export const MOCK_SESSION_SIZE = 5

const REPLAY_CHANCE = 0.1
const WIN_CHANCE = 0.35
const MONEY_PRIZES = ['R$ 5,00', 'R$ 10,00', 'R$ 25,00', 'R$ 50,00', 'R$ 100,00']
const COTA_PRIZES = ['1 Cota', '3 Cotas', '5 Cotas', '10 Cotas']

let mockIdCounter = 0

export function mockPlayResult(): PenaltyPlayResult {
  const id = ++mockIdCounter
  const chave_giro = `penalti_${id}`
  if (Math.random() < REPLAY_CHANCE) {
    return { id, chave_giro, tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Chute Extra!', valor: null }
  }
  if (Math.random() >= WIN_CHANCE) {
    return { id, chave_giro, tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Nao foi dessa vez', valor: null }
  }
  if (Math.random() < 0.4) {
    const nome = COTA_PRIZES[Math.floor(Math.random() * COTA_PRIZES.length)]!
    return { id, chave_giro, tipo_acao: 'ganhou', tipo_premio: 'cota', nome, valor: nome.split(' ')[0]! }
  }
  const nome = MONEY_PRIZES[Math.floor(Math.random() * MONEY_PRIZES.length)]!
  return { id, chave_giro, tipo_acao: 'ganhou', tipo_premio: 'valor', nome, valor: nome.replace(/[^\d,]/g, '') }
}

/**
 * Resolve um cenario fixo a partir da chave lida da query string.
 */
export function pickScenario(
  cenarioKey: string | null,
  scenarios: Record<string, PenaltyPlayResult[]> = PENALTY_SCENARIOS
): PenaltyPlayResult[] | null {
  if (!cenarioKey) return null
  const cenario = scenarios[cenarioKey]
  return cenario ? [...cenario] : null
}

/**
 * Gera a sessao mock inteira que o harness de dev passa como prop `resultados`
 * pro PenaltyGame — cenario fixo se `cenarioKey` bater com PENALTY_SCENARIOS,
 * senao `count` itens aleatorios.
 */
export function gerarSessaoMock(count: number, cenarioKey: string | null = null): PenaltyPlayResult[] {
  const cenario = pickScenario(cenarioKey)
  if (cenario) return cenario
  return Array.from({ length: count }, mockPlayResult)
}
