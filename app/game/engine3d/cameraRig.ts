import { PerspectiveCamera, Vector3 } from 'three'
import type { EngineState, Vec3 } from '../types'

export interface CameraRig {
  camera: PerspectiveCamera
  update(state: EngineState, stateT: number, ballPos: Vec3): void
  resize(aspect: number): void
}

const BASE_POSITION = new Vector3(0, 1.65, 13.5)
const LOOK_AT_GOAL = new Vector3(0, 1.1, 0)

/**
 * Camera atras do batedor. No chute (flight), faz um dolly sutil em
 * direcao a bola; no impacto (inicio de aftermath), um shake rapido —
 * mesma magnitude usada no motor 2D, agora como movimento real de camera.
 */
export function buildCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(52, 16 / 9, 0.1, 60)
  camera.position.copy(BASE_POSITION)
  camera.lookAt(LOOK_AT_GOAL)

  function update(state: EngineState, stateT: number, ballPos: Vec3) {
    const dolly = new Vector3().copy(BASE_POSITION)
    const lookAt = new Vector3().copy(LOOK_AT_GOAL)

    if (state === 'flight') {
      const t = Math.min(1, stateT / 0.5)
      dolly.lerp(new Vector3(ballPos.x * 0.3, 1.4, 7), t * 0.4)
      lookAt.set(ballPos.x, ballPos.y, ballPos.z)
    } else if (state === 'aftermath') {
      const decay = Math.max(0, 1 - stateT / 0.4)
      const shakeMag = 0.05 * decay
      dolly.x += Math.sin(stateT * 55) * shakeMag
      dolly.y += Math.cos(stateT * 47) * shakeMag * 0.6
    }

    camera.position.copy(dolly)
    camera.lookAt(lookAt)
  }

  function resize(aspect: number) {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }

  return { camera, update, resize }
}
