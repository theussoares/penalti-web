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
 * Camera estatica atras do batedor, sempre apontada para o gol — sem
 * dolly nem shake (decisao do usuario: nao precisa de camera dinamica).
 * `update()` fica no shape da interface para nao mexer no orquestrador.
 */
export function buildCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(52, 16 / 9, 0.1, 60)
  camera.position.copy(BASE_POSITION)
  camera.lookAt(LOOK_AT_GOAL)

  function update(_state: EngineState, _stateT: number, _ballPos: Vec3) {}

  function resize(aspect: number) {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }

  return { camera, update, resize }
}
