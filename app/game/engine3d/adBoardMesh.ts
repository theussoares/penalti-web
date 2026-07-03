import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

export interface AdBoards {
  mesh: Mesh
  /** Chamar a cada quadro com o tempo atual em segundos. */
  update(now: number): void
}

const AD_MESSAGES = ['★ PREMIADO ★', 'GANHE AGORA', 'NÚMEROS DA SORTE']
const AD_COLORS = ['#38bdf8', '#facc15', '#4ade80', '#facc15', '#38bdf8', '#4ade80']

// Telao giratorio: cada mensagem fica visivel por HOLD_SECONDS e depois
// faz um crossfade de TRANSITION_SECONDS para a proxima, em loop.
const HOLD_SECONDS = 2.8
const TRANSITION_SECONDS = 0.6
const CYCLE_SECONDS = HOLD_SECONDS + TRANSITION_SECONDS

/**
 * Placa de publicidade atras do gol, alternando entre mensagens
 * pre-renderizadas (estilo neon, igual ao "PREMIADO" da arquibancada em
 * `crowdBillboard.ts`). Mesma tecnica de duas camadas: `meshA` opaca por
 * baixo e `meshB` transparente por cima, crossfade via `materialB.opacity`.
 */
export function buildAdBoards(width: number, height: number): AdBoards {
  const textures = AD_MESSAGES.map((message) => new CanvasTexture(buildAdCanvas(message)))

  const materialA = new MeshBasicMaterial({ map: textures[0]! })
  const materialB = new MeshBasicMaterial({ map: textures[1 % textures.length]!, transparent: true, opacity: 0 })

  const geometry = new PlaneGeometry(width, height)
  const mesh = new Mesh(geometry, materialA)

  const meshB = new Mesh(geometry.clone(), materialB)
  meshB.position.z = 0.01
  mesh.add(meshB)

  let currentIndex = 0

  return {
    mesh,
    update(now) {
      const cyclePos = now % (CYCLE_SECONDS * textures.length)
      const index = Math.floor(cyclePos / CYCLE_SECONDS)
      const nextIndex = (index + 1) % textures.length
      const timeInCycle = cyclePos - index * CYCLE_SECONDS

      if (index !== currentIndex) {
        currentIndex = index
        materialA.map = textures[currentIndex]!
        materialA.needsUpdate = true
      }

      if (timeInCycle < HOLD_SECONDS) {
        materialB.opacity = 0
      } else {
        materialB.map = textures[nextIndex]!
        materialB.needsUpdate = true
        const t = (timeInCycle - HOLD_SECONDS) / TRANSITION_SECONDS
        materialB.opacity = Math.min(1, Math.max(0, t))
      }
    }
  }
}

function buildAdCanvas(message: string): HTMLCanvasElement {
  const cw = 2048
  const ch = 96
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0c1220'
  ctx.fillRect(0, 0, cw, ch)
  ctx.font = 'bold 52px system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const step = cw / AD_COLORS.length
  for (let i = 0; i < AD_COLORS.length; i++) {
    ctx.fillStyle = AD_COLORS[i]!
    ctx.shadowColor = AD_COLORS[i]!
    ctx.shadowBlur = 18
    const textWidth = ctx.measureText(message).width
    ctx.fillText(message, i * step + (step - textWidth) / 2, ch / 2)
  }
  ctx.shadowBlur = 0

  return canvas
}
