import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type Group } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { CharacterPhase } from './proceduralCharacter'

export interface KeeperDiveModel {
  object3D: Group
  /**
   * Toca o clipe de mergulho da fase (diveLeft/diveRight/diveCenter) do
   * zero, ajustando a velocidade para caber em `targetDurationSeconds` (os
   * clipes originais duram mais do que a janela de tempo do lance).
   * Fases sem clipe correspondente (runup, kick) sao ignoradas.
   */
  play(phase: CharacterPhase, targetDurationSeconds: number): void
  /** Toca o clipe base (parado na linha) em loop continuo. */
  playIdle(): void
  update(deltaSeconds: number): void
}

const DIVE_MODEL_URL = './models/goalkeeper-dive.glb'

const IDLE_CLIP_NAME = 'Armature|mixamo.com|Base Layer'

const CLIP_NAME_BY_PHASE: Partial<Record<CharacterPhase, string>> = {
  diveLeft: 'DiveLeft',
  diveRight: 'DiveRight',
  diveCenter: 'CatchCenter'
}

/**
 * Carrega o modelo real do goleiro (asset fornecido pelo usuario,
 * comprimido na Task 12): 3 clipes de mergulho nomeados + o clipe base
 * usado como idle em loop. Quando carregado, substitui o goleiro
 * procedural em todas as fases; o batedor nao e afetado. Retorna `null`
 * se o arquivo nao carregar (caminho errado, arquivo ausente) — quem
 * chama deve manter o goleiro procedural nesse caso.
 */
export async function loadKeeperDiveModel(): Promise<KeeperDiveModel | null> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  const gltf = await new Promise<GLTF | null>((resolve) => {
    loader.load(DIVE_MODEL_URL, resolve, undefined, () => resolve(null))
  })
  if (!gltf) return null

  const mixer = new AnimationMixer(gltf.scene)
  const actionsByClipName = new Map<string, AnimationAction>()
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip)
    if (clip.name === IDLE_CLIP_NAME) {
      action.setLoop(LoopRepeat, Infinity)
    } else {
      action.clampWhenFinished = true
      action.setLoop(LoopOnce, 1)
    }
    actionsByClipName.set(clip.name, action)
  }

  let currentAction: AnimationAction | null = null

  function playClip(action: AnimationAction | undefined, timeScale: number) {
    if (!action || action === currentAction) return
    currentAction?.stop()
    action.timeScale = timeScale
    action.reset().play()
    currentAction = action
  }

  return {
    object3D: gltf.scene,
    play(phase, targetDurationSeconds) {
      const clipName = CLIP_NAME_BY_PHASE[phase]
      const action = clipName ? actionsByClipName.get(clipName) : undefined
      if (!action) return
      playClip(action, action.getClip().duration / targetDurationSeconds)
    },
    playIdle() {
      playClip(actionsByClipName.get(IDLE_CLIP_NAME), 1)
    },
    update(deltaSeconds) {
      mixer.update(deltaSeconds)
    }
  }
}
