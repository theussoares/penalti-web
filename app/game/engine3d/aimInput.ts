import { Plane, type PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import type { Vec2 } from '../types'
import { clampAim, type WorldLayout } from './worldGeometry'

const raycaster = new Raycaster()
const ndc = new Vector2()
const hit = new Vector3()

/**
 * Converte um ponto de toque/clique na tela em coordenada de mundo no plano
 * do gol, via raycast da camera. Substitui a conversao direta de pixels
 * (`toLocal`) do motor 2D — o resto do fluxo (clamp aos limites do gol,
 * disparo do chute) continua identico.
 */
export function screenToAim(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  camera: PerspectiveCamera,
  layout: WorldLayout
): Vec2 {
  ndc.x = ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1
  ndc.y = -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1

  raycaster.setFromCamera(ndc, camera)
  const goalPlane = new Plane(new Vector3(0, 0, 1), -layout.goalLineZ)
  raycaster.ray.intersectPlane(goalPlane, hit)

  return clampAim(hit.x, hit.y, layout.aimBounds)
}
