import { computed } from 'vue'
import type { Ref } from 'vue'
import type { PenaltyPlayResult } from '~/types/game'

export function useChutarTudo(
  playQueue: Ref<PenaltyPlayResult[]>,
  history: Ref<PenaltyPlayResult[]>,
  chancesRestantesValue: Ref<number>,
  engineState: Ref<string>
) {
  const podeChutarTudo = computed(
    () =>
      chancesRestantesValue.value > 1 &&
      (engineState.value === 'ready' || engineState.value === 'aiming')
  )

  function processAllRemainingPlays() {
    const consumidos = playQueue.value.splice(0)
    history.value.push(...consumidos)
  }

  return {
    podeChutarTudo,
    processAllRemainingPlays
  }
}
