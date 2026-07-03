/**
 * Camada de dados do jogo.
 *
 * CONTRATO DA API (a implementar no backend):
 *
 *   GET {apiBase}/games
 *     -> { games: GameInfo[] }           lista de jogos disponiveis
 *
 *   POST {apiBase}/games/{id}/play
 *     body: { outcome: 'goal' | 'save' | 'out' }
 *     -> { prize: Prize | null }         premio concedido quando ha gol
 *
 * Enquanto a API real nao existe, `USE_MOCK = true` serve os mesmos
 * formatos com dados locais. Para plugar a API real basta definir
 * `USE_MOCK = false` e configurar `apiBase` via runtime config ou
 * pela query string `?api=https://sua-api.com`.
 */

export type PrizeType = 'money' | 'lucky-numbers'

export interface Prize {
  type: PrizeType
  /** Valor em centavos quando type === 'money' */
  amountCents?: number
  /** Numeros da sorte quando type === 'lucky-numbers' */
  numbers?: string[]
  /** Nome da promocao / sorteio */
  campaign?: string
}

export interface GameInfo {
  id: string
  name: string
  description: string
  /** Chamada exibida no topo do jogo, ex: "Valendo R$ 500" */
  headline: string
  active: boolean
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

function mockPrize(): Prize {
  if (Math.random() < 0.5) {
    const values = [500, 1000, 2500, 5000, 10000, 50000]
    return {
      type: 'money',
      amountCents: values[Math.floor(Math.random() * values.length)]!,
      campaign: 'Penalti Premiado'
    }
  }
  const numbers: string[] = []
  while (numbers.length < 3) {
    const n = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
    if (!numbers.includes(n)) numbers.push(n)
  }
  return { type: 'lucky-numbers', numbers, campaign: 'Sorteio Penalti Premiado' }
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

  async function submitPlay(gameId: string, outcome: 'goal' | 'save' | 'out'): Promise<Prize | null> {
    if (USE_MOCK || !apiBase) {
      await delay(250)
      return outcome === 'goal' ? mockPrize() : null
    }
    const res = await fetch(`${apiBase}/games/${gameId}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome })
    })
    if (!res.ok) throw new Error(`Falha ao registrar jogada: ${res.status}`)
    const data = (await res.json()) as { prize: Prize | null }
    return data.prize
  }

  function formatMoney(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return { fetchGames, submitPlay, formatMoney }
}
