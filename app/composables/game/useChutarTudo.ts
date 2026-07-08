import { ref, computed } from 'vue'
import type { PenaltyPlayResult } from '~/types/game'
import { filtrarPremiosGanhados, type PremioGanho } from '~/game/session'

export function useChutarTudo(
  playQueue: Ref<PenaltyPlayResult[]>,
  history: Ref<PenaltyPlayResult[]>,
  chancesRestantesValue: Ref<number>,
  awaitingSequence: Ref<boolean>,
  engineState: Ref<string>
) {
  const premiosChutarTudo = ref<PremioGanho[]>([])

  const podeChutarTudo = computed(
    () =>
      chancesRestantesValue.value > 1 &&
      !awaitingSequence.value &&
      (engineState.value === 'ready' || engineState.value === 'aiming')
  )

  function processAllRemainingPlays() {
    const consumidos = playQueue.value.splice(0)
    history.value.push(...consumidos)
    premiosChutarTudo.value = filtrarPremiosGanhados(consumidos)
  }

  return {
    premiosChutarTudo,
    podeChutarTudo,
    processAllRemainingPlays
  }
}
