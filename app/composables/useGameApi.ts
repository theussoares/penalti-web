/**
 * Camada de dados do jogo.
 *
 * CONTRATO DA API (a implementar no backend):
 *
 *   GET {apiBase}/games
 *     -> { games: GameInfo[] }                        lista de jogos disponiveis
 *
 *   GET {apiBase}/games/{id}/play-sequence?count=N
 *     -> { results: PenaltyPlayResult[] }              proxima leva de resultados ja decididos
 *
 * O resultado de cada chute (ganhou/nao_ganhou + premio) vem pronto do
 * backend antes da jogada — o motor 3D so encena visualmente o que ja foi
 * decidido (ver docs/superpowers/specs/2026-07-03-mira-automatica-resultado-api-design.md).
 * Vocabulario (tipo_acao/tipo_premio/chave_giro) reaproveitado dos mocks de
 * Roleta (app/mocks/index.ts), adaptado ao penalti: sem 'replay' (nao
 * existe no dominio) e sem numeros da sorte especificos em
 * tipo_premio: 'cota' por enquanto.
 *
 * Enquanto a API real nao existe, `USE_MOCK = true` gera sequencias
 * aleatorias localmente. Para plugar a API real basta definir
 * `USE_MOCK = false` e configurar `apiBase` via runtime config ou pela
 * query string `?api=https://sua-api.com`.
 */

export interface GameInfo {
  id: string
  name: string
  description: string
  /** Chamada exibida no topo do jogo, ex: "Valendo R$ 500" */
  headline: string
  active: boolean
}

export interface PenaltyPlayResult {
  id: number
  /** Identificador unico da jogada, mesmo padrao dos mocks de Roleta. */
  chave_giro: string
  tipo_acao: 'ganhou' | 'nao_ganhou'
  tipo_premio: 'valor' | 'cota' | 'nao_ganhou'
  /** Texto de exibicao, ex: "R$ 50,00" ou "5 Cotas". */
  nome: string
  valor: string | null
}

const USE_MOCK = true

const MOCK_GAMES: GameInfo[] = [
  {
    id: 'penalty-premiado',
    name: 'Penalti Premiado',
    description: 'Venca o goleiro e ganhe na hora.',
    headline: 'Valendo premios em dinheiro e numeros da sorte',
    active: true
  }
]

const WIN_CHANCE = 0.35
const MONEY_PRIZES = ['R$ 5,00', 'R$ 10,00', 'R$ 25,00', 'R$ 50,00', 'R$ 100,00']
const COTA_PRIZES = ['1 Cota', '3 Cotas', '5 Cotas', '10 Cotas']

let mockIdCounter = 0

function mockPlayResult(): PenaltyPlayResult {
  const id = ++mockIdCounter
  const chave_giro = `penalti_${id}`
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useGameApi() {
  const apiBase = (() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('api') ?? ''
  })()

  async function fetchGames(): Promise<GameInfo[]> {
    if (USE_MOCK || !apiBase) {
      await delay(120)
      return MOCK_GAMES
    }
    const res = await fetch(`${apiBase}/games`)
    if (!res.ok) throw new Error(`Falha ao carregar jogos: ${res.status}`)
    const data = (await res.json()) as { games: GameInfo[] }
    return data.games
  }

  async function fetchPlaySequence(gameId: string, count: number): Promise<PenaltyPlayResult[]> {
    if (USE_MOCK || !apiBase) {
      await delay(250)
      return Array.from({ length: count }, mockPlayResult)
    }
    const res = await fetch(`${apiBase}/games/${gameId}/play-sequence?count=${count}`)
    if (!res.ok) throw new Error(`Falha ao buscar sequencia de jogadas: ${res.status}`)
    const data = (await res.json()) as { results: PenaltyPlayResult[] }
    return data.results
  }

  return { fetchGames, fetchPlaySequence }
}
