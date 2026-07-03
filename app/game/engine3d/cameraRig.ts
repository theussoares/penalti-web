import { PerspectiveCamera, Vector3 } from 'three'
import type { EngineState, Vec3 } from '../types'

export interface CameraRig {
  camera: PerspectiveCamera
  update(state: EngineState, stateT: number, ballPos: Vec3): void
  resize(aspect: number): void
}

// Elevada e bem atras da marca do penalti, olhando um pouco para baixo —
// angulo que mostra o gramado (linhas da area, bola, batedor) e mantem o
// batedor pequeno no rodape, como no enquadramento do motor 2D.
const BASE_POSITION = new Vector3(0, 3.4, 18)
const LOOK_AT_GOAL = new Vector3(0, 0.95, 0)

/**
 * Camera estatica atras do batedor, sempre apontada para o gol — sem
 * dolly nem shake (decisao do usuario: nao precisa de camera dinamica).
 * `update()` fica no shape da interface para nao mexer no orquestrador.
 */
export function buildCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(44, 16 / 9, 0.1, 60)
  camera.position.copy(BASE_POSITION)
  camera.lookAt(LOOK_AT_GOAL)

  function update(_state: EngineState, _stateT: number, _ballPos: Vec3) {}

  function resize(aspect: number) {
    camera.aspect = aspect
    // FOV adaptativo: em telas estreitas (retrato/mobile), o FOV vertical
    // fixo cortaria as traves fora do quadro. Garante um FOV horizontal
    // minimo de ~30 graus (gol inteiro + folga a 18m), crescendo o FOV
    // vertical quando o aspecto aperta.
    const MIN_HALF_HFOV_RAD = (15 * Math.PI) / 180
    const neededVFov = (2 * Math.atan(Math.tan(MIN_HALF_HFOV_RAD) / aspect) * 180) / Math.PI
    camera.fov = Math.max(44, neededVFov)
    camera.updateProjectionMatrix()
  }

  return { camera, update, resize }
}
