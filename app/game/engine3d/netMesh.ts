import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three'
import type { Ripple } from './netRipple'
import { netDisplacement } from './netRipple'
import type { WorldLayout } from './worldGeometry'

export interface NetMesh {
  mesh: LineSegments
  update(ripples: Ripple[], now: number): void
}

const COLS = 15
const ROWS = 8

/**
 * Grade da rede de fundo do gol, com deslocamento por vertice calculado por
 * `netDisplacement()` (mesma matematica do motor 2D). O plano da rede fica
 * ligeiramente inclinado para tras (profundidade `goalDepth`), como no gol
 * de futebol real.
 */
export function buildNetMesh(layout: WorldLayout): NetMesh {
  const { goalWidth, goalHeight, goalDepth, goalCenterX, goalLineZ } = layout
  const left = goalCenterX - goalWidth / 2
  const backZ = goalLineZ - goalDepth

  const basePositions: { x: number; y: number; z: number }[] = []
  const indices: number[] = []

  const at = (c: number, r: number) => r * (COLS + 1) + c

  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const x = left + (goalWidth * c) / COLS
      const y = goalHeight * (1 - r / ROWS)
      const z = backZ + ((goalLineZ - backZ) * r) / ROWS
      basePositions.push({ x, y, z })
    }
  }
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      indices.push(at(c, r), at(c + 1, r))
    }
  }
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      indices.push(at(c, r), at(c, r + 1))
    }
  }

  const positionArray = new Float32Array(indices.length * 3)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positionArray, 3))
  const mesh = new LineSegments(geometry, new LineBasicMaterial({ color: 0xebf0f8, transparent: true, opacity: 0.5 }))

  function update(ripples: Ripple[], now: number) {
    const attr = geometry.getAttribute('position') as BufferAttribute
    for (let i = 0; i < indices.length; i++) {
      const base = basePositions[indices[i]!]!
      const disp = netDisplacement({ x: base.x, y: base.y }, ripples, now, goalWidth, goalHeight)
      attr.setXYZ(i, base.x, base.y + disp, base.z + disp * 0.35)
    }
    attr.needsUpdate = true
  }

  update([], 0)
  return { mesh, update }
}
