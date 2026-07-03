import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Object3D
} from 'three'
import type { WorldLayout } from './worldGeometry'

export interface AmbientEffects {
  object3D: Object3D
  update(now: number): void
}

/** Gradiente radial cinza-claro/branco->transparente para os sprites de fumaca. */
function buildSmokeTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(232, 232, 236, 0.9)')
  gradient.addColorStop(0.35, 'rgba(220, 220, 226, 0.4)')
  gradient.addColorStop(1, 'rgba(210, 210, 218, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

interface SmokeMotion {
  sprite: Mesh
  baseX: number
  baseY: number
  baseZ: number
  riseAmplitude: number
  swayAmplitude: number
  freq: number
  phase: number
  peakOpacity: number
}

const SMOKE_COUNT = 3
const SMOKE_CYCLE_MIN = 6
const SMOKE_CYCLE_MAX = 10

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function buildSmoke(layout: WorldLayout): { group: Group; update(now: number): void } {
  const group = new Group()
  const texture = buildSmokeTexture()
  const motions: SmokeMotion[] = []
  const baseZ = layout.goalLineZ - layout.goalDepth * 1.3

  for (let i = 0; i < SMOKE_COUNT; i++) {
    const radius = randomRange(1.5, 2.5)
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0
    })
    const sprite = new Mesh(new PlaneGeometry(radius * 2, radius * 2), material)

    const baseX = layout.goalCenterX + randomRange(-2, 2)
    const baseY = randomRange(0.3, 1.2)
    sprite.position.set(baseX, baseY, baseZ)
    group.add(sprite)

    motions.push({
      sprite,
      baseX,
      baseY,
      baseZ,
      riseAmplitude: randomRange(0.3, 0.6),
      swayAmplitude: randomRange(0.15, 0.35),
      freq: (Math.PI * 2) / randomRange(SMOKE_CYCLE_MIN, SMOKE_CYCLE_MAX),
      phase: randomRange(0, Math.PI * 2),
      // Quase imperceptivel de proposito — reforca profundidade atras do
      // gol sem competir visualmente com o telao/torcida da foto.
      peakOpacity: randomRange(0.06, 0.1)
    })
  }

  function update(now: number) {
    for (const motion of motions) {
      const t = now * motion.freq + motion.phase
      // Ciclo 0..2pi: sobe e desvanece (fade in na primeira metade, fade out na segunda).
      const cycle = (t % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
      const progress = cycle / (Math.PI * 2)
      const fade = Math.sin(progress * Math.PI) // 0 -> 1 -> 0
      const rise = progress * motion.riseAmplitude
      const sway = Math.sin(t * 1.7) * motion.swayAmplitude

      motion.sprite.position.set(motion.baseX + sway, motion.baseY + rise, motion.baseZ)
      ;(motion.sprite.material as MeshBasicMaterial).opacity = fade * motion.peakOpacity
    }
  }

  update(0)
  return { group, update }
}

const FLAG_COLORS = [0xfacc15, 0x38bdf8, 0x4ade80]
const FLAG_COLS = 4
const FLAG_ROWS = 1

interface FlagMotion {
  geometry: BufferGeometry
  basePositions: { x: number; y: number; z: number }[]
  phase: number
}

function buildCornerFlag(x: number, z: number, color: number): { group: Group; motion: FlagMotion } {
  const group = new Group()

  const poleHeight = 1.1
  const pole = new Mesh(
    new CylinderGeometry(0.015, 0.015, poleHeight, 6),
    new MeshBasicMaterial({ color: 0xd8dce4 })
  )
  pole.position.set(x, poleHeight / 2, z)
  group.add(pole)

  // Pano segmentado (4x1) para permitir ondulacao na borda solta.
  const width = 0.4
  const height = 0.28
  const basePositions: { x: number; y: number; z: number }[] = []
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const flagBaseY = poleHeight - height / 2

  for (let r = 0; r <= FLAG_ROWS; r++) {
    for (let c = 0; c <= FLAG_COLS; c++) {
      const px = x + (width * c) / FLAG_COLS
      const py = flagBaseY + (height / 2) * (1 - r)
      const pz = z
      basePositions.push({ x: px, y: py, z: pz })
      positions.push(px, py, pz)
      uvs.push(c / FLAG_COLS, r / FLAG_ROWS)
    }
  }
  for (let r = 0; r < FLAG_ROWS; r++) {
    for (let c = 0; c < FLAG_COLS; c++) {
      const a = r * (FLAG_COLS + 1) + c
      const b = a + 1
      const cIdx = a + (FLAG_COLS + 1)
      const d = cIdx + 1
      indices.push(a, cIdx, b, b, cIdx, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const material = new MeshBasicMaterial({ color, side: DoubleSide })
  const cloth = new Mesh(geometry, material)
  group.add(cloth)

  return {
    group,
    motion: { geometry, basePositions, phase: randomRange(0, Math.PI * 2) }
  }
}

function buildFlags(layout: WorldLayout): { group: Group; update(now: number): void } {
  const group = new Group()
  const halfWidth = layout.goalWidth / 2 + 1
  const z = -1.0

  const motions: FlagMotion[] = []
  ;[-halfWidth, halfWidth].forEach((x, i) => {
    const { group: flagGroup, motion } = buildCornerFlag(x, z, FLAG_COLORS[i % FLAG_COLORS.length]!)
    group.add(flagGroup)
    motions.push(motion)
  })

  function update(now: number) {
    for (const motion of motions) {
      const attr = motion.geometry.getAttribute('position') as BufferAttribute
      for (let c = 0; c <= FLAG_COLS; c++) {
        // Coluna presa ao mastro (c=0) fica parada; o resto ondula
        // proporcionalmente a distancia da borda presa, como uma bandeira ao
        // vento.
        const weight = c / FLAG_COLS
        for (let r = 0; r <= FLAG_ROWS; r++) {
          const idx = r * (FLAG_COLS + 1) + c
          const base = motion.basePositions[idx]!
          const wave = Math.sin(now * 3 + motion.phase + c * 1.1) * 0.04 * weight
          attr.setXYZ(idx, base.x, base.y + wave, base.z + wave)
        }
      }
      attr.needsUpdate = true
    }
  }

  update(0)
  return { group, update }
}

/**
 * Camada de ambientacao extra atras do gol: fumaca sutil (sem brilho, so
 * gradiente cinza/branco) subindo e desvanecendo, e duas bandeirinhas de
 * canto com o pano ondulando via perturbacao de vertice (mesmo padrao de
 * `netMesh.ts`).
 */
export function buildAmbientEffects(layout: WorldLayout): AmbientEffects {
  const group = new Group()

  const smoke = buildSmoke(layout)
  group.add(smoke.group)

  const flags = buildFlags(layout)
  group.add(flags.group)

  function update(now: number) {
    smoke.update(now)
    flags.update(now)
  }

  return { object3D: group, update }
}

/** So a fumaca de `buildAmbientEffects`, sem as bandeirinhas de canto. */
export function buildAmbientSmoke(layout: WorldLayout): AmbientEffects {
  const smoke = buildSmoke(layout)
  return { object3D: smoke.group, update: smoke.update }
}
