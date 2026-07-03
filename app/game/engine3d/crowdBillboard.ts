import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

export interface CrowdBillboard {
  mesh: Mesh
  /** Chamar a cada quadro com o nivel de empolgacao (0 a 1) e o tempo atual em segundos. */
  setExcitement(value: number, now: number): void
}

const ROWS = 22
// Canvas largo (4:1) para casar com a proporcao da placa (~4.7:1) — canvas
// quadrado esticado era o que deixava as figuras em elipses gigantes.
const CANVAS_W = 2048
const CANVAS_H = 512
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

  const materialA = new MeshBasicMaterial({ map: textureA })
  const materialB = new MeshBasicMaterial({ map: textureB, transparent: true, opacity: 0 })

  const geometry = new PlaneGeometry(width, height)
  const mesh = new Mesh(geometry, materialA)

  // B fica NA FRENTE de A (mais perto da camera) para funcionar como um
  // overlay de verdade — igual ao motor 2D, que desenha a torcida base (A)
  // opaca e depois sobrepoe B por cima com opacidade variavel. A nunca muda
  // de opacidade; so B pulsa. (Colocar B atras de A so revelaria B pelos
  // vaos transparentes entre as figuras de A, nao como uma mistura de verdade.)
  const meshB = new Mesh(geometry.clone(), materialB)
  meshB.position.z = 0.01
  mesh.add(meshB)

  return {
    mesh,
    setExcitement(value, now) {
      const speed = value > 0 ? 9 : 2.2
      const phase = (Math.sin(now * speed) + 1) / 2
      materialB.opacity = Math.min(1, Math.max(0, phase)) * (value > 0 ? 1 : 0.55)
    }
  }
}

function buildCrowdCanvas(variant: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')!

  // Fundo escuro de arquibancada, para nao vazar preto puro entre as figuras.
  ctx.fillStyle = '#141824'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  let rng = 12345
  const rand = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff
    return rng / 0x7fffffff
  }

  for (let r = 0; r < ROWS; r++) {
    const t = r / (ROWS - 1)
    const y = (t * CANVAS_H) + CANVAS_H / ROWS / 2
    // Fileiras de baixo maiores (mais proximas), como arquibancada real.
    const bodySize = 6 + t * 6
    const step = bodySize * 2.1
    for (let x = step / 2 + (r % 2) * step * 0.5; x < CANVAS_W; x += step) {
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

  // Fascia entre os aneis da arquibancada com "PREMIADO" em neon, como na
  // arte 2D de referencia.
  const walkwayY = CANVAS_H * 0.44
  const walkwayH = CANVAS_H * 0.08
  ctx.fillStyle = '#0d1120'
  ctx.fillRect(0, walkwayY, CANVAS_W, walkwayH)
  const NEON_COLORS = ['#38bdf8', '#facc15', '#4ade80', '#facc15', '#38bdf8']
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  const step = CANVAS_W / NEON_COLORS.length
  for (let i = 0; i < NEON_COLORS.length; i++) {
    ctx.fillStyle = NEON_COLORS[i]!
    ctx.shadowColor = NEON_COLORS[i]!
    ctx.shadowBlur = 14
    const textWidth = ctx.measureText('PREMIADO').width
    ctx.fillText('PREMIADO', i * step + (step - textWidth) / 2, walkwayY + walkwayH / 2)
  }
  ctx.shadowBlur = 0

  // Sombreamento vertical: topo mais escuro (longe dos refletores), base
  // mais viva — arquibancada a meia-luz sem competir com o gol.
  const shade = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  shade.addColorStop(0, 'rgba(6, 9, 18, 0.5)')
  shade.addColorStop(0.5, 'rgba(10, 14, 26, 0.28)')
  shade.addColorStop(1, 'rgba(10, 14, 26, 0.16)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  return canvas
}
