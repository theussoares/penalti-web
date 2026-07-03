import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

export interface StadiumLights {
  object3D: Group
  update(now: number): void
}

const PULSE_MIN = 0.7
const PULSE_MAX = 1.0
const PULSE_CYCLE_MIN = 4
const PULSE_CYCLE_MAX = 6

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Gradiente radial branco->transparente para o halo dos refletores. */
function buildGlowTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 250, 230, 0.95)')
  gradient.addColorStop(0.25, 'rgba(255, 245, 210, 0.5)')
  gradient.addColorStop(1, 'rgba(255, 240, 200, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * Linha de teto do estadio com refletores brilhando acima da arquibancada,
 * como na arte 2D de referencia: uma faixa escura de cobertura + halos de
 * luz em billboard (sem luz dinamica real, so sprite).
 */
export function buildStadiumLights(width: number, topY: number, z: number): StadiumLights {
  const group = new Group()

  const roof = new Mesh(
    new PlaneGeometry(width, 0.5),
    new MeshBasicMaterial({ color: 0x0a0d16 })
  )
  roof.position.set(0, topY, z)
  group.add(roof)

  const glowTexture = buildGlowTexture()
  // ±18% da largura para os laterais cairem dentro do FOV estreito da camera.
  const positions = [-width * 0.18, 0, width * 0.18]
  const glows: { material: MeshBasicMaterial; baseOpacity: number; freq: number; phase: number }[] = []
  for (const x of positions) {
    const fixture = new Mesh(
      new PlaneGeometry(1.0, 0.2),
      new MeshBasicMaterial({ color: 0xccd6e4 })
    )
    fixture.position.set(x, topY + 0.45, z)
    group.add(fixture)

    const glowMaterial = new MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      depthWrite: false
    })
    const glow = new Mesh(new PlaneGeometry(5, 5), glowMaterial)
    glow.position.set(x, topY + 0.5, z + 0.05)
    group.add(glow)

    glows.push({
      material: glowMaterial,
      baseOpacity: glowMaterial.opacity,
      freq: (Math.PI * 2) / randomRange(PULSE_CYCLE_MIN, PULSE_CYCLE_MAX),
      phase: randomRange(0, Math.PI * 2)
    })
  }

  function update(now: number) {
    for (const glow of glows) {
      const pulse = PULSE_MIN + ((Math.sin(now * glow.freq + glow.phase) + 1) / 2) * (PULSE_MAX - PULSE_MIN)
      glow.material.opacity = glow.baseOpacity * pulse
    }
  }

  return { object3D: group, update }
}
