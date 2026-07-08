import { PENALTY_SCENARIOS } from '~/mocks/penaltySequences'
import type { GameInfo, PenaltyPlayResult } from '~/types/game'

export const USE_MOCK = true

/** Tamanho da sequencia buscada no primeiro "Chutar" da sessao (mock). */
export const MOCK_SESSION_SIZE = 5

export const MOCK_GAMES: GameInfo[] = [
  {
    id: 'penalty-premiado',
    name: 'Penalti Premiado',
    description: 'Venca o goleiro e ganhe na hora.',
    headline: 'Valendo premios em dinheiro e cotas',
    active: true
  }
]

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

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('api') ?? ''
}
