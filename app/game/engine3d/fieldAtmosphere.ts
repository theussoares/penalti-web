import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  type Object3D
} from 'three'
import type { WorldLayout } from './worldGeometry'

export interface FieldAtmosphere {
  object3D: Object3D
  update(now: number): void
}

const SHEEN_SCROLL_SPEED = 0.015
const SHEEN_OPACITY = 0.16

const PARTICLE_COUNT = 60
const PARTICLE_MIN_Y = 0.15
const PARTICLE_MAX_Y = 2.8
const PARTICLE_MIN_Z = -2
const PARTICLE_MAX_Z = 13

/** Faixa diagonal branco->transparente para o sheen deslizante do gramado. */
function buildSheenTexture(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/** Gradiente radial branco/dourado->transparente para o sprite de poeira/brilho. */
function buildParticleTexture(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 248, 225, 0.9)')
  gradient.addColorStop(0.4, 'rgba(255, 242, 201, 0.45)')
  gradient.addColorStop(1, 'rgba(255, 242, 201, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

function buildSheen(layout: WorldLayout): Mesh {
  const width = layout.goalWidth * 4.5
  const nearZ = layout.spotZ + 6
  const farZ = layout.goalLineZ - layout.goalDepth - 1
  const depth = nearZ - farZ

  const texture = buildSheenTexture()
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: SHEEN_OPACITY
  })
  const mesh = new Mesh(new PlaneGeometry(width, depth), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(layout.goalCenterX, 0.02, (nearZ + farZ) / 2)
  return mesh
}

interface ParticleMotion {
  freq: number
  phase: number
  amplitude: number
  riseSpeed: number
  baseX: number
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function respawnParticle(motion: ParticleMotion): { x: number; y: number; z: number } {
  motion.baseX = randomRange(-1, 1)
  motion.freq = randomRange(0.15, 0.45)
  motion.phase = randomRange(0, Math.PI * 2)
  motion.amplitude = randomRange(0.15, 0.5)
  motion.riseSpeed = randomRange(0.05, 0.15)
  const goalHalfWidth = 1
  return {
    x: motion.baseX,
    y: PARTICLE_MIN_Y,
    z: randomRange(PARTICLE_MIN_Z, PARTICLE_MAX_Z),
    goalHalfWidth
  } as unknown as { x: number; y: number; z: number }
}

function buildParticles(layout: WorldLayout): { points: Points; update(now: number): void } {
  const spriteTexture = buildParticleTexture()
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const motions: ParticleMotion[] = []
  const maxX = layout.goalWidth * 1.3

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const motion: ParticleMotion = {
      freq: randomRange(0.15, 0.45),
      phase: randomRange(0, Math.PI * 2),
      amplitude: randomRange(0.15, 0.5),
      riseSpeed: randomRange(0.05, 0.15),
      baseX: randomRange(-maxX, maxX)
    }
    motions.push(motion)
    positions[i * 3] = motion.baseX
    positions[i * 3 + 1] = randomRange(PARTICLE_MIN_Y, PARTICLE_MAX_Y)
    positions[i * 3 + 2] = randomRange(PARTICLE_MIN_Z, PARTICLE_MAX_Z)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))

  const material = new PointsMaterial({
    map: spriteTexture,
    color: 0xfff2c9,
    size: 0.1,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: 0.6
  })

  const points = new Points(geometry, material)

  let lastNow = 0
  function update(now: number) {
    const delta = lastNow === 0 ? 0 : now - lastNow
    lastNow = now
    const attr = geometry.getAttribute('position') as BufferAttribute

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const motion = motions[i]!
      let y = attr.getY(i) + motion.riseSpeed * delta
      let x = attr.getX(i)
      let z = attr.getZ(i)

      if (y > PARTICLE_MAX_Y) {
        y = PARTICLE_MIN_Y
        motion.baseX = randomRange(-maxX, maxX)
        motion.freq = randomRange(0.15, 0.45)
        motion.phase = randomRange(0, Math.PI * 2)
        motion.amplitude = randomRange(0.15, 0.5)
        z = randomRange(PARTICLE_MIN_Z, PARTICLE_MAX_Z)
        x = motion.baseX
      } else {
        x = motion.baseX + Math.sin(now * motion.freq + motion.phase) * motion.amplitude
      }

      attr.setXYZ(i, x, y, z)
    }
    attr.needsUpdate = true

    material.opacity = 0.5 + Math.sin(now * 0.4) * 0.1
  }

  update(0)
  return { points, update }
}

/**
 * Camada de ambientacao sutil do gramado: um sheen de reflexo deslizante
 * (textura estatica, so o offset anima) e poeira/brilho flutuando perto do
 * gol — tudo com MeshBasicMaterial/PointsMaterial, sem luz real.
 */
export function buildFieldAtmosphere(layout: WorldLayout): FieldAtmosphere {
  const group = new Group()

  const sheen = buildSheen(layout)
  group.add(sheen)
  const sheenTexture = (sheen.material as MeshBasicMaterial).map!

  const particles = buildParticles(layout)
  group.add(particles.points)

  function update(now: number) {
    sheenTexture.offset.x = (now * SHEEN_SCROLL_SPEED) % 1
    particles.update(now)
  }

  return { object3D: group, update }
}
