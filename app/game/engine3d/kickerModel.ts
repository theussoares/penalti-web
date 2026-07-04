import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type Group } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

export interface KickerModel {
  object3D: Group
  /** Idle parado, em loop continuo (unico clipe de base do .glb). */
  playIdle(): void
  /**
   * Toca o clipe de chute do zero, ajustando a velocidade para caber em
   * `targetDurationSeconds` (o clipe original dura mais que a janela de
   * tempo do lance).
   */
  playKick(targetDurationSeconds: number): void
  update(deltaSeconds: number): void
}

const KICKER_MODEL_URL = './models/kicker-run-kick.glb'

// O .glb so tem 2 clipes — nao ha um ciclo de corrida dedicado. "mixamo.com"
// (nome padrao que o Mixamo da ao clipe quando ele nao e renomeado) e o
// idle; usado tambem durante a corrida ate a bola (o deslocamento e feito
// por posicao, nao pela animacao) para nao trocar de modelo no meio do
// lance.
const IDLE_CLIP_NAME = 'mixamo.com'
const KICK_CLIP_NAME = 'Kick'

/**
 * Carrega o modelo real do batedor (asset fornecido pelo usuario,
 * comprimido em public/models/kicker-run-kick.glb) com o clipe de idle e o
 * de chute. Quando carregado, substitui o batedor procedural em todas as
 * fases (mesmo padrao do goleiro real, ver keeperDiveModel.ts). Retorna
 * `null` se o arquivo nao carregar — quem chama deve manter o procedural
 * nesse caso.
 */
export async function loadKickerModel(): Promise<KickerModel | null> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  const gltf = await new Promise<GLTF | null>((resolve) => {
    loader.load(KICKER_MODEL_URL, resolve, undefined, () => resolve(null))
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

  function playClip(action: AnimationAction | undefined, timeScale: number, fadeDuration = 0.4) {
    if (!action || action === currentAction) return
    const prev = currentAction
    // currentAction?.stop()
    action.timeScale = timeScale
    action.reset().play()

    if (prev) {
      action.crossFadeFrom(prev, fadeDuration, true)
    }

    currentAction = action
  }

  return {
    object3D: gltf.scene,
    playIdle() {
      playClip(actionsByClipName.get(IDLE_CLIP_NAME), 1)
    },
    playKick(targetDurationSeconds) {
      const action = actionsByClipName.get(KICK_CLIP_NAME)
      if (!action) return
      playClip(action, (action.getClip().duration) / targetDurationSeconds)
    },
    update(deltaSeconds) {
      mixer.update(deltaSeconds)
    }
  }
}
