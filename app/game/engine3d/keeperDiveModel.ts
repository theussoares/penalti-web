import { AnimationMixer, LoopOnce, type AnimationAction, type Group } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { CharacterPhase } from './proceduralCharacter'

export interface KeeperDiveModel {
  object3D: Group
  /**
   * Toca o clipe correspondente a fase (diveLeft/diveRight/diveCenter) do
   * zero, ajustando a velocidade para caber em `targetDurationSeconds` (os
   * clipes originais duram mais do que a janela de tempo do lance).
   * Fases sem clipe correspondente (idle, runup, kick) sao ignoradas — nao
   * deveriam ser chamadas aqui, o goleiro procedural cobre essas fases.
   */
  play(phase: CharacterPhase, targetDurationSeconds: number): void
  update(deltaSeconds: number): void
}

const DIVE_MODEL_URL = './models/goalkeeper-dive.glb'

const CLIP_NAME_BY_PHASE: Partial<Record<CharacterPhase, string>> = {
  diveLeft: 'DiveLeft',
  diveRight: 'DiveRight',
  diveCenter: 'CatchCenter'
}

/**
 * Carrega o modelo real do goleiro mergulhando (asset fornecido pelo
 * usuario, comprimido na Task 12) com seus 3 clipes de mergulho nomeados.
 * Usado apenas durante as fases de voo e pos-impacto do chute — o goleiro
 * procedural (Tasks 6/7) continua sendo usado em todas as outras fases
 * (idle etc.); o batedor nao e afetado. Retorna `null` se o arquivo nao
 * carregar (caminho errado, arquivo ausente) — quem chama deve manter o
 * goleiro procedural nesse caso.
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
    action.clampWhenFinished = true
    action.setLoop(LoopOnce, 1)
    actionsByClipName.set(clip.name, action)
  }

  let currentAction: AnimationAction | null = null

  return {
    object3D: gltf.scene,
    play(phase, targetDurationSeconds) {
      const clipName = CLIP_NAME_BY_PHASE[phase]
      const action = clipName ? actionsByClipName.get(clipName) : undefined
      if (!action) return
      currentAction?.stop()
      action.timeScale = action.getClip().duration / targetDurationSeconds
      action.reset().play()
      currentAction = action
    },
    update(deltaSeconds) {
      mixer.update(deltaSeconds)
    }
  }
}
