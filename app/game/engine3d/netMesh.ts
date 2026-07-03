import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, type Object3D } from 'three'
import type { Ripple } from './netRipple'
import { netDisplacement } from './netRipple'
import type { WorldLayout } from './worldGeometry'

export interface NetMesh {
  mesh: Object3D
  update(ripples: Ripple[], now: number): void
}

const COLS = 24
const ROWS = 12
const SIDE_STEPS = 6

/**
 * Rede do gol em tres paineis: o principal pende do travessao (frente,
 * topo) ate o chao atras do gol — a versao anterior caia do fundo para a
 * FRENTE, cobrindo a boca do gol como uma cerca — mais dois paineis
 * laterais triangulares estaticos. So o painel principal ondula com
 * `netDisplacement()` (mesma matematica do motor 2D).
 */
export function buildNetMesh(layout: WorldLayout): NetMesh {
  const { goalWidth, goalHeight, goalDepth, goalCenterX, goalLineZ } = layout
  const left = goalCenterX - goalWidth / 2
  const backZ = goalLineZ - goalDepth

  const material = new LineBasicMaterial({ color: 0xebf0f8, transparent: true, opacity: 0.55 })
  const group = new Group()

  // ---------------- Painel principal (dinamico) ----------------
  const basePositions: { x: number; y: number; z: number }[] = []
  const indices: number[] = []
  const at = (c: number, r: number) => r * (COLS + 1) + c

  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS
    for (let c = 0; c <= COLS; c++) {
      basePositions.push({
        x: left + (goalWidth * c) / COLS,
        y: goalHeight * (1 - t),
        z: goalLineZ + (backZ - goalLineZ) * t
      })
    }
  }
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) indices.push(at(c, r), at(c + 1, r))
  }
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) indices.push(at(c, r), at(c, r + 1))
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(indices.length * 3), 3))
  const backNet = new LineSegments(geometry, material)
  group.add(backNet)

  // ---------------- Paineis laterais (estaticos) ----------------
  const sidePoints: number[] = []
  for (const x of [left, left + goalWidth]) {
    // Verticais: do chao ate a "hipotenusa" (que desce do topo do poste ao
    // chao atras), em passos de profundidade.
    for (let s = 0; s <= SIDE_STEPS; s++) {
      const t = s / SIDE_STEPS
      const z = goalLineZ + (backZ - goalLineZ) * t
      const yTop = goalHeight * (1 - t)
      sidePoints.push(x, 0, z, x, yTop, z)
    }
    // Horizontais: da linha do gol ate onde a hipotenusa corta a altura.
    for (let h = 1; h < 4; h++) {
      const y = (goalHeight * h) / 4
      const tCut = 1 - y / goalHeight
      sidePoints.push(x, y, goalLineZ, x, y, goalLineZ + (backZ - goalLineZ) * tCut)
    }
  }
  const sideGeometry = new BufferGeometry()
  sideGeometry.setAttribute('position', new BufferAttribute(new Float32Array(sidePoints), 3))
  group.add(new LineSegments(sideGeometry, material))

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
  return { mesh: group, update }
}
