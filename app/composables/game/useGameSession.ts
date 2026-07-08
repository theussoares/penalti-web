import { ref, computed } from 'vue'
import type { GameInfo, PenaltyPlayResult } from '~/types/game'
import { MOCK_GAMES, USE_MOCK, getApiBaseUrl, pickScenario, delay, mockPlayResult } from '~/utils/api-helpers'
import { chancesRestantes, isSessionOver } from '~/game/session'

export function useGameSession() {
  const game = ref<GameInfo | null>(null)
  const sessionStarted = ref(false)
  const awaitingSequence = ref(false)
  const playQueue = ref<PenaltyPlayResult[]>([])
  const history = ref<PenaltyPlayResult[]>([])
  const currentPlayResult = ref<PenaltyPlayResult | null>(null)

  const chancesRestantesValue = computed(() => chancesRestantes(playQueue.value))
  const sessaoEncerrada = computed(() => sessionStarted.value && isSessionOver(playQueue.value))
  const playHistory = computed(() => history.value)

  async function fetchGames(): Promise<GameInfo[]> {
    const apiBase = getApiBaseUrl()
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
    const apiBase = getApiBaseUrl()
    if (USE_MOCK || !apiBase) {
      await delay(250)
      const cenarioKey = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('cenario')
      const cenario = pickScenario(cenarioKey)
      if (cenario) return cenario
      return Array.from({ length: count }, mockPlayResult)
    }
    const res = await fetch(`${apiBase}/games/${gameId}/play-sequence?count=${count}`)
    if (!res.ok) throw new Error(`Falha ao buscar sequencia de jogadas: ${res.status}`)
    const data = (await res.json()) as { results: PenaltyPlayResult[] }
    return data.results
  }

  async function loadActiveGame() {
    game.value = (await fetchGames()).find((g) => g.active) ?? null
  }

  async function startSession(count: number) {
    if (sessionStarted.value || awaitingSequence.value) return
    const gameId = game.value?.id ?? 'penalty-premiado'
    awaitingSequence.value = true
    playQueue.value = await fetchPlaySequence(gameId, count)
    sessionStarted.value = true
    awaitingSequence.value = false
  }

  function consumeNextPlay(): PenaltyPlayResult | null {
    if (playQueue.value.length === 0) return null
    const result = playQueue.value.shift()!
    currentPlayResult.value = result
    return result
  }

  function registerPlayedResult() {
    if (currentPlayResult.value) {
      history.value.push(currentPlayResult.value)
    }
  }

  function resetSession() {
    currentPlayResult.value = null
    history.value = []
    sessionStarted.value = false
    playQueue.value = []
  }

  return {
    game,
    sessionStarted,
    awaitingSequence,
    playQueue,
    history,
    currentPlayResult,
    chancesRestantesValue,
    sessaoEncerrada,
    playHistory,
    loadActiveGame,
    startSession,
    consumeNextPlay,
    registerPlayedResult,
    resetSession
  }
}
