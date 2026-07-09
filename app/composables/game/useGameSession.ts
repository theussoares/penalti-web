import { ref, computed } from 'vue'
import type { PenaltyPlayResult } from '~/types/game'
import { chancesRestantes, isSessionOver } from '~/game/session'

export function useGameSession(resultados: PenaltyPlayResult[]) {
  const playQueue = ref<PenaltyPlayResult[]>([...resultados])
  const history = ref<PenaltyPlayResult[]>([])
  const currentPlayResult = ref<PenaltyPlayResult | null>(null)

  const chancesRestantesValue = computed(() => chancesRestantes(playQueue.value))
  const sessaoEncerrada = computed(() => isSessionOver(playQueue.value))

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

  return {
    playQueue,
    history,
    currentPlayResult,
    chancesRestantesValue,
    sessaoEncerrada,
    consumeNextPlay,
    registerPlayedResult
  }
}
