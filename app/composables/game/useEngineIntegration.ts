import { ref } from 'vue'
import { PenaltyEngine3D } from '~/game/engine3d/penaltyEngine3d'
import type { ShotOutcome, EngineState } from '~/game/types'

export interface EngineCallbacks {
  onResult: (outcome: ShotOutcome) => void
  onKick: () => void
  onImpact: (outcome: ShotOutcome) => void
  onStateChange: (state: EngineState) => void
}

export function useEngineIntegration() {
  const engineState = ref<EngineState>('ready')
  let engine: PenaltyEngine3D | null = null

  function mountEngine(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    engine = new PenaltyEngine3D(canvas, {
      onResult: callbacks.onResult,
      onStateChange: (s) => {
        engineState.value = s
        callbacks.onStateChange(s)
      },
      onKick: callbacks.onKick,
      onImpact: callbacks.onImpact
    })
  }

  function shoot(outcome: ShotOutcome) {
    engine?.shoot(outcome)
  }

  function resetEngine() {
    engine?.reset()
  }

  function destroyEngine() {
    engine?.destroy()
    engine = null
  }

  return {
    engineState,
    mountEngine,
    shoot,
    resetEngine,
    destroyEngine
  }
}
