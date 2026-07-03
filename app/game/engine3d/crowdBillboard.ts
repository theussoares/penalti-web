import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

export interface CrowdBillboard {
  mesh: Mesh
  /** Chamar a cada quadro com o nivel de empolgacao (0 a 1) e o tempo atual em segundos. */
  setExcitement(value: number, now: number): void
}

const ROWS = 26
const CROWD_COLORS = [
  '#d8433b', '#e0e4ea', '#2e5fa3', '#e8b13f', '#43955f',
  '#8a4fa0', '#d97941', '#3fa3a0', '#c4cad4', '#a33b52'
]
const SKIN_TONES = ['#c98e63', '#8a5a3b', '#e2b48c', '#6e4428']

/**
 * Reaproveita a mesma tecnica de `renderCrowdLayers()` do motor 2D: dois
 * quadros pre-renderizados (variante 0 e 1, um com "pulo") aplicados como
 * texturas numa placa 3D atras do gol, com crossfade dirigido por
 * `crowdExcitement` — sem modelar a torcida em geometria 3D.
 */
export function buildCrowdBillboard(width: number, height: number): CrowdBillboard {
  const canvasA = buildCrowdCanvas(0)
  const canvasB = buildCrowdCanvas(1)
  const textureA = new CanvasTexture(canvasA)
  const textureB = new CanvasTexture(canvasB)

  const materialA = new MeshBasicMaterial({ map: textureA, transparent: true, opacity: 1 })
  const materialB = new MeshBasicMaterial({ map: textureB, transparent: true, opacity: 0 })

  const geometry = new PlaneGeometry(width, height)
  const mesh = new Mesh(geometry, materialA)

  const meshB = new Mesh(geometry.clone(), materialB)
  meshB.position.z = -0.01
  mesh.add(meshB)

  return {
    mesh,
    setExcitement(value, now) {
      const speed = value > 0 ? 9 : 2.2
      const phase = (Math.sin(now * speed) + 1) / 2
      const opacityB = Math.min(1, Math.max(0, phase)) * (value > 0 ? 1 : 0.55)
      // Crossfade simetrico: A cai conforme B sobe, para nao depender dos
      // vaos transparentes entre as figuras de A para revelar B por baixo.
      materialB.opacity = opacityB
      materialA.opacity = 1 - opacityB
    }
  }
}

function buildCrowdCanvas(variant: number): HTMLCanvasElement {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  let rng = 12345
  const rand = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff
    return rng / 0x7fffffff
  }

  for (let r = 0; r < ROWS; r++) {
    const t = r / (ROWS - 1)
    const y = t * size
    const bodySize = 6 + t * 6
    const step = bodySize * 2.1
    for (let x = step / 2 + (r % 2) * step * 0.5; x < size; x += step) {
      const bob = variant === 1 && rand() > 0.5 ? -bodySize * 0.45 : 0
      ctx.fillStyle = CROWD_COLORS[Math.floor(rand() * CROWD_COLORS.length)]!
      ctx.beginPath()
      ctx.arc(x, y + bob, bodySize * 0.62, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)]!
      ctx.beginPath()
      ctx.arc(x, y + bob - bodySize * 0.72, bodySize * 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return canvas
}
