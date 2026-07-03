import { CylinderGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import type { WorldLayout } from './worldGeometry'

/**
 * Traves e travessao brancos — no 2D o gol desenhado era parte central da
 * ambientacao; aqui viram tres cilindros simples, sem rede (a rede ja e o
 * netMesh separado). Material sem sombreamento de proposito: trave branca
 * "chapada" como na arte 2D, sem escurecer com a luz da cena.
 */
export function buildGoalFrame(layout: WorldLayout): Group {
  const group = new Group()
  const material = new MeshBasicMaterial({ color: 0xf4f6fa })
  const r = layout.goalPostRadius
  const half = layout.goalWidth / 2

  const postGeometry = new CylinderGeometry(r, r, layout.goalHeight + r, 10)
  const postL = new Mesh(postGeometry, material)
  postL.position.set(-half, (layout.goalHeight + r) / 2, layout.goalLineZ)
  const postR = postL.clone()
  postR.position.x = half

  const bar = new Mesh(new CylinderGeometry(r, r, layout.goalWidth + r * 2, 10), material)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, layout.goalHeight + r, layout.goalLineZ)

  group.add(postL, postR, bar)
  return group
}
