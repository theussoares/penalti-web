import { Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three'
import type { Vec2 } from '../types'

export interface AimReticle {
  object3D: Group
  /** `aim` nulo esconde a mira (fora do estado aiming). */
  update(aim: Vec2 | null, inGoal: boolean, now: number): void
}

const IN_GOAL_COLOR = 0x8dff5a
const OUT_COLOR = 0xff6e5a

/**
 * Porte do reticulo de mira do motor 2D (`drawAimHint`): dois aneis
 * pulsantes no plano do gol, verdes com a mira dentro do alvo e vermelhos
 * fora — sem a grade de zonas nem a linha tracejada do 2D no v1.
 */
export function buildAimReticle(ballRadius: number, goalLineZ: number): AimReticle {
  // Maior que no 2D (la o raio era proporcional a tela; aqui a mira vive a
  // ~18m da camera e encolheria demais na perspectiva).
  const radius = ballRadius * 2.6
  const material = new MeshBasicMaterial({
    color: IN_GOAL_COLOR,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  })

  const group = new Group()
  group.add(new Mesh(new RingGeometry(radius * 0.78, radius, 24), material))
  group.add(new Mesh(new RingGeometry(radius * 0.3, radius * 0.48, 24), material))
  // Levemente a frente da linha do gol para nao brigar com a rede.
  group.position.z = goalLineZ + 0.05
  group.renderOrder = 10
  group.visible = false

  return {
    object3D: group,
    update(aim, inGoal, now) {
      if (!aim) {
        group.visible = false
        return
      }
      group.visible = true
      group.position.x = aim.x
      group.position.y = aim.y
      const pulse = 1 + Math.sin(now * 7) * 0.08
      group.scale.setScalar(pulse)
      material.color.setHex(inGoal ? IN_GOAL_COLOR : OUT_COLOR)
    }
  }
}
