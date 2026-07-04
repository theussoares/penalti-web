/**
 * Motor do jogo de penalti em Canvas 2D.
 *
 * Cena: visao de tras do batedor, olhando para o gol. Camadas:
 *  - fundo estatico pre-renderizado (ceu, arquibancada, refletores, gramado, linhas)
 *  - torcida animada (dois quadros pre-renderizados em crossfade + pulo no gol)
 *  - gol com rede fisica (ondulacao radial quando a bola toca a rede)
 *  - goleiro (idle animado + mergulho com rotacao)
 *  - batedor (corrida + chute com esqueleto procedural)
 *  - bola (voo com perspectiva, sombra, giro)
 *  - particulas (confete no gol), vinheta e chacoalhar de camera
 */

export type ShotOutcome = 'goal' | 'save' | 'out'

export type EngineState =
  | 'ready'
  | 'aiming'
  | 'runup'
  | 'strike'
  | 'flight'
  | 'aftermath'
  | 'done'

export interface EngineCallbacks {
  onResult(outcome: ShotOutcome): void
  onStateChange?(state: EngineState): void
  onKick?(): void
  onImpact?(outcome: ShotOutcome): void
}

interface Vec {
  x: number
  y: number
}

interface Ripple {
  x: number
  y: number
  start: number
}

interface Confetti {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  w: number
  h: number
  color: string
  born: number
  life: number
}

interface Layout {
  W: number
  H: number
  horizonY: number
  boardTop: number
  boardBottom: number
  goalCx: number
  goalLineY: number
  goalW: number
  goalH: number
  postW: number
  ballR: number
  spot: Vec
  keeperH: number
  kickerH: number
}

const TAU = Math.PI * 2

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
const easeInQuad = (t: number) => t * t
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const CROWD_COLORS = [
  '#d8433b', '#e0e4ea', '#2e5fa3', '#e8b13f', '#43955f',
  '#8a4fa0', '#d97941', '#3fa3a0', '#c4cad4', '#a33b52',
  '#5577c9', '#ddd08a', '#7c9a5a', '#b8b2c9', '#e0e4ea'
]

const CONFETTI_COLORS = ['#ffd23f', '#3fa9f5', '#ff5d5d', '#5dff8f', '#ff8ff3', '#fff7d6']

const SKIN_TONES = ['#c98e63', '#8a5a3b', '#e2b48c', '#6e4428']

interface Timings {
  runup: number
  strike: number
  flight: number
  aftermath: number
}

const TIMINGS: Timings = {
  runup: 0.72,
  strike: 0.16,
  flight: 0.5,
  aftermath: 1.35
}

export class PenaltyEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cb: EngineCallbacks
  private dpr = 1
  private raf = 0
  private destroyed = false

  private layout!: Layout
  private staticLayer: HTMLCanvasElement | null = null
  private crowdA: HTMLCanvasElement | null = null
  private crowdB: HTMLCanvasElement | null = null
  private vignette: HTMLCanvasElement | null = null

  state: EngineState = 'ready'
  private stateStart = 0
  private now = 0

  private aim: Vec = { x: 0, y: 0 }
  private hasAim = false
  private pointerActive = false

  private shotTarget: Vec = { x: 0, y: 0 }
  private outcome: ShotOutcome = 'goal'
  private keeperDive: { dir: number; target: Vec; active: boolean } = {
    dir: 0,
    target: { x: 0, y: 0 },
    active: false
  }

  private ballPos: Vec = { x: 0, y: 0 }
  private ballScale = 1
  private ballSpin = 0
  private impactPoint: Vec = { x: 0, y: 0 }
  private deflectTarget: Vec = { x: 0, y: 0 }

  private ripples: Ripple[] = []
  private confetti: Confetti[] = []
  private ballTrail: { x: number; y: number; r: number }[] = []
  private crowdExcitement = 0
  private shake = 0
  private shakeStart = 0

  private resizeObserver: ResizeObserver | null = null
  private resultSent = false

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D indisponivel')
    this.ctx = ctx
    this.cb = callbacks

    this.handleResize()
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    this.now = performance.now() / 1000
    this.stateStart = this.now
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
  }

  reset() {
    this.setState('ready')
    this.hasAim = false
    this.pointerActive = false
    this.resultSent = false
    this.keeperDive.active = false
    this.ripples = []
    this.confetti = []
    this.ballTrail = []
    this.crowdExcitement = 0
    this.ballPos = { ...this.layout.spot }
    this.ballScale = 1
    this.ballSpin = 0
  }

  // ------------------------------------------------------------------
  // Layout e camadas estaticas
  // ------------------------------------------------------------------

  private handleResize() {
    const parent = this.canvas.parentElement
    const w = parent?.clientWidth ?? window.innerWidth
    const h = parent?.clientHeight ?? window.innerHeight
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2)
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`

    const W = w
    const H = h
    const horizonY = H * 0.33
    const goalW = Math.min(W * 0.8, H * 0.85)
    const goalH = goalW * 0.34
    const goalLineY = H * 0.47
    const layout: Layout = {
      W,
      H,
      horizonY,
      boardTop: horizonY - H * 0.005,
      boardBottom: horizonY + H * 0.045,
      goalCx: W / 2,
      goalLineY,
      goalW,
      goalH,
      postW: Math.max(3, goalW * 0.016),
      ballR: clamp(goalW * 0.05, 9, 22),
      spot: { x: W / 2, y: H * 0.795 },
      keeperH: goalH * 0.66,
      kickerH: H * 0.23
    }
    this.layout = layout
    this.ballPos = { ...layout.spot }

    this.renderStaticLayer()
    this.renderCrowdLayers()
    this.renderVignette()
  }

  private makeLayer(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas')
    c.width = this.canvas.width
    c.height = this.canvas.height
    const ctx = c.getContext('2d')!
    ctx.scale(this.dpr, this.dpr)
    return [c, ctx]
  }

  private renderStaticLayer() {
    const [layer, ctx] = this.makeLayer()
    const { W, H, horizonY, boardTop, boardBottom, goalCx, goalLineY, goalW } = this.layout

    // Ceu noturno de estadio
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY)
    sky.addColorStop(0, '#0a1633')
    sky.addColorStop(0.7, '#14264d')
    sky.addColorStop(1, '#1d3560')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, horizonY + 2)

    // Cobertura do estadio
    ctx.fillStyle = '#0b1224'
    ctx.beginPath()
    ctx.moveTo(-W * 0.05, H * 0.1)
    ctx.quadraticCurveTo(W * 0.5, H * 0.015, W * 1.05, H * 0.1)
    ctx.lineTo(W * 1.05, 0)
    ctx.lineTo(-W * 0.05, 0)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#233457'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-W * 0.05, H * 0.1)
    ctx.quadraticCurveTo(W * 0.5, H * 0.015, W * 1.05, H * 0.1)
    ctx.stroke()

    // Refletores
    const lightY = H * 0.055
    for (const fx of [W * 0.16, W * 0.38, W * 0.62, W * 0.84]) {
      const glow = ctx.createRadialGradient(fx, lightY, 0, fx, lightY, W * 0.09)
      glow.addColorStop(0, 'rgba(255,250,220,0.95)')
      glow.addColorStop(0.25, 'rgba(255,244,190,0.35)')
      glow.addColorStop(1, 'rgba(255,244,190,0)')
      ctx.fillStyle = glow
      ctx.fillRect(fx - W * 0.09, lightY - W * 0.09, W * 0.18, W * 0.18)
      ctx.fillStyle = '#e8ecf5'
      ctx.fillRect(fx - W * 0.022, lightY - H * 0.008, W * 0.044, H * 0.016)
    }

    // Estrutura da arquibancada (a torcida vai por cima, animada)
    const standTop = H * 0.09
    const stands = ctx.createLinearGradient(0, standTop, 0, horizonY)
    stands.addColorStop(0, '#1a2338')
    stands.addColorStop(1, '#2c3a58')
    ctx.fillStyle = stands
    ctx.fillRect(0, standTop, W, horizonY - standTop)

    // Divisorias dos aneis da arquibancada
    ctx.strokeStyle = 'rgba(10,14,26,0.8)'
    ctx.lineWidth = Math.max(1.5, H * 0.004)
    for (const ty of [0.45, 0.72]) {
      const y = lerp(standTop, horizonY, ty)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // Placas de publicidade estilo painel de LED atras do gol
    const boardH = boardBottom - boardTop
    ctx.fillStyle = '#070d18'
    ctx.fillRect(0, boardTop, W, boardH)
    ctx.fillStyle = 'rgba(120,180,255,0.25)'
    ctx.fillRect(0, boardTop, W, 1.5)
    const ledColors = ['#41d6ff', '#ffd23f', '#41d6ff', '#8dff5a', '#ffd23f', '#41d6ff']
    const bw = W / ledColors.length
    ledColors.forEach((c, i) => {
      ctx.save()
      ctx.beginPath()
      ctx.rect(i * bw + 3, boardTop, bw - 6, boardH)
      ctx.clip()
      ctx.shadowColor = c
      ctx.shadowBlur = 10
      ctx.fillStyle = c
      ctx.globalAlpha = 0.9
      ctx.font = `800 ${Math.min(boardH * 0.44, bw * 0.14)}px 'Segoe UI', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('PREMIADO', i * bw + bw / 2, boardTop + boardH * 0.54)
      ctx.restore()
    })

    // Gramado com perspectiva
    const grass = ctx.createLinearGradient(0, boardBottom, 0, H)
    grass.addColorStop(0, '#26703a')
    grass.addColorStop(0.4, '#2f8a45')
    grass.addColorStop(0.8, '#2c9146')
    grass.addColorStop(1, '#26953f')
    ctx.fillStyle = grass
    ctx.fillRect(0, boardBottom, W, H - boardBottom)

    // Faixas do corte de grama com borda suave (largura cresce com a proximidade)
    let y = boardBottom
    let bandH = H * 0.018
    let i = 0
    while (y < H) {
      const band = ctx.createLinearGradient(0, y, 0, y + bandH)
      if (i % 2 === 0) {
        band.addColorStop(0, 'rgba(255,255,240,0.085)')
        band.addColorStop(0.75, 'rgba(255,255,240,0.045)')
        band.addColorStop(1, 'rgba(255,255,240,0.01)')
      } else {
        band.addColorStop(0, 'rgba(4,44,18,0.09)')
        band.addColorStop(0.7, 'rgba(4,44,18,0.04)')
        band.addColorStop(1, 'rgba(4,44,18,0.01)')
      }
      ctx.fillStyle = band
      ctx.fillRect(0, y, W, bandH)
      y += bandH
      bandH *= 1.32
      i++
    }

    // Luz do refletor sobre o campo
    const fieldGlow = ctx.createRadialGradient(
      W / 2, goalLineY, goalW * 0.1,
      W / 2, goalLineY + H * 0.1, Math.max(W, H) * 0.75
    )
    fieldGlow.addColorStop(0, 'rgba(255,255,220,0.16)')
    fieldGlow.addColorStop(1, 'rgba(255,255,220,0)')
    ctx.fillStyle = fieldGlow
    ctx.fillRect(0, boardBottom, W, H - boardBottom)

    // Linhas da grande area em perspectiva
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = Math.max(2, H * 0.004)
    ctx.lineJoin = 'round'

    const vanish: Vec = { x: W / 2, y: horizonY - H * 0.3 }
    const persp = (gx: number, gy: number): Vec => {
      // gx: -1..1 (largura do campo), gy: 0 (linha do gol)..1 (perto da camera)
      const yy = lerp(goalLineY, H * 1.06, easeInQuad(gy))
      const spread = lerp(goalW * 1.55, W * 2.4, easeInQuad(gy))
      return { x: goalCx + (gx * spread) / 2, y: yy }
    }
    void vanish

    // Linha do gol
    ctx.beginPath()
    ctx.moveTo(0, goalLineY)
    ctx.lineTo(W, goalLineY)
    ctx.stroke()

    // Grande area
    const bigArea = [persp(-0.98, 0), persp(-0.98, 0.62), persp(0.98, 0.62), persp(0.98, 0)]
    ctx.beginPath()
    ctx.moveTo(bigArea[0]!.x, bigArea[0]!.y)
    for (const p of bigArea.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()

    // Pequena area
    const smallArea = [persp(-0.44, 0), persp(-0.44, 0.24), persp(0.44, 0.24), persp(0.44, 0)]
    ctx.beginPath()
    ctx.moveTo(smallArea[0]!.x, smallArea[0]!.y)
    for (const p of smallArea.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()

    // Meia-lua da area
    ctx.beginPath()
    ctx.ellipse(W / 2, bigArea[1]!.y, goalW * 0.42, H * 0.05, 0, 0.15, Math.PI - 0.15)
    ctx.stroke()

    // Segundo padrao de corte: colunas verticais convergindo em perspectiva
    for (let c = -5; c < 5; c++) {
      if ((c + 10) % 2 === 0) continue
      const a = persp(c / 5, 0)
      const b = persp((c + 1) / 5, 0)
      const a1 = persp(c / 5, 1)
      const b1 = persp((c + 1) / 5, 1)
      ctx.fillStyle = 'rgba(255,255,240,0.022)'
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(b1.x, b1.y)
      ctx.lineTo(a1.x, a1.y)
      ctx.closePath()
      ctx.fill()
    }

    // Marca do penalti
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.ellipse(this.layout.spot.x, this.layout.spot.y, this.layout.ballR * 0.55, this.layout.ballR * 0.22, 0, 0, TAU)
    ctx.fill()

    // ---- Texturizacao do gramado (por cima das linhas, para dar desgaste) ----
    let grng = 98765
    const grand = () => {
      grng = (grng * 1103515245 + 12345) & 0x7fffffff
      return grng / 0x7fffffff
    }

    // Boca do gol gasta (faixa de terra na linha do gol)
    const mouth = ctx.createRadialGradient(goalCx, goalLineY + H * 0.006, 0, goalCx, goalLineY + H * 0.006, goalW * 0.55)
    mouth.addColorStop(0, 'rgba(115,86,42,0.22)')
    mouth.addColorStop(0.55, 'rgba(115,86,42,0.1)')
    mouth.addColorStop(1, 'rgba(115,86,42,0)')
    ctx.fillStyle = mouth
    ctx.beginPath()
    ctx.ellipse(goalCx, goalLineY + H * 0.006, goalW * 0.55, H * 0.022, 0, 0, TAU)
    ctx.fill()

    // Area gasta ao redor da marca do penalti
    const worn = ctx.createRadialGradient(
      this.layout.spot.x, this.layout.spot.y, 0,
      this.layout.spot.x, this.layout.spot.y, this.layout.ballR * 5.5
    )
    worn.addColorStop(0, 'rgba(115,86,42,0.3)')
    worn.addColorStop(0.55, 'rgba(115,86,42,0.12)')
    worn.addColorStop(1, 'rgba(115,86,42,0)')
    ctx.fillStyle = worn
    ctx.beginPath()
    ctx.ellipse(this.layout.spot.x, this.layout.spot.y, this.layout.ballR * 5.5, this.layout.ballR * 2.4, 0, 0, TAU)
    ctx.fill()

    // Manchas irregulares de desgaste espalhadas
    for (let k = 0; k < 14; k++) {
      const px = grand() * W
      const py = lerp(boardBottom + H * 0.03, H, easeInQuad(grand()))
      const depth = (py - boardBottom) / (H - boardBottom)
      const pr = lerp(H * 0.006, H * 0.03, depth) * (0.5 + grand())
      const blob = ctx.createRadialGradient(px, py, 0, px, py, pr)
      const tone = grand() > 0.5 ? '104,120,44' : '112,88,46'
      blob.addColorStop(0, `rgba(${tone},${0.05 + grand() * 0.06})`)
      blob.addColorStop(1, `rgba(${tone},0)`)
      ctx.fillStyle = blob
      ctx.beginPath()
      ctx.ellipse(px, py, pr, pr * 0.45, grand() * Math.PI, 0, TAU)
      ctx.fill()
    }

    // Fios de grama individuais (densidade cresce com a proximidade)
    const bladeCount = Math.min(4200, Math.round((W * (H - boardBottom)) / 320))
    ctx.lineCap = 'round'
    for (let k = 0; k < bladeCount; k++) {
      const gy = lerp(boardBottom + 2, H, easeInQuad(grand()))
      const gx = grand() * W
      const depth = (gy - boardBottom) / (H - boardBottom)
      const len = lerp(1.4, 6.5, depth) * (0.65 + grand() * 0.7)
      const leanAmt = (grand() - 0.5) * len * 0.5
      const light = grand() > 0.52
      ctx.strokeStyle = light
        ? `rgba(196,255,196,${0.05 + 0.07 * depth})`
        : `rgba(6,48,20,${0.06 + 0.08 * depth})`
      ctx.lineWidth = depth > 0.55 ? 1.25 : 0.8
      ctx.beginPath()
      ctx.moveTo(gx, gy)
      ctx.lineTo(gx + leanAmt, gy - len)
      ctx.stroke()
    }

    // Granulado fino por cima de todo o campo
    const grain = document.createElement('canvas')
    grain.width = 96
    grain.height = 96
    const gctx = grain.getContext('2d')!
    const img = gctx.createImageData(96, 96)
    for (let p = 0; p < img.data.length; p += 4) {
      const v = Math.floor(grand() * 255)
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = 14
    }
    gctx.putImageData(img, 0, 0)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, boardBottom, W, H - boardBottom)
    ctx.clip()
    ctx.fillStyle = ctx.createPattern(grain, 'repeat')!
    ctx.fillRect(0, boardBottom, W, H - boardBottom)
    ctx.restore()

    this.staticLayer = layer
  }

  private renderCrowdLayers() {
    const { W, H, horizonY } = this.layout
    const standTop = H * 0.095
    const rows = 26
    const seed = 12345
    let rng = seed
    const rand = () => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff
      return rng / 0x7fffffff
    }

    const build = (variant: number) => {
      const [layer, ctx] = this.makeLayer()
      let localRng = seed
      const lrand = () => {
        localRng = (localRng * 1103515245 + 12345) & 0x7fffffff
        return localRng / 0x7fffffff
      }
      for (let r = 0; r < rows; r++) {
        const t = r / (rows - 1)
        const y = lerp(standTop + 4, horizonY - 4, t)
        const size = lerp(H * 0.006, H * 0.011, t)
        const step = size * 2.1
        for (let x = step / 2 + (r % 2) * step * 0.5; x < W; x += step) {
          // Setores de torcida organizada: blocos amarelos e azuis
          const section = Math.floor((x / W) * 9)
          const sectionColor = section % 3 === 0 ? '#e8b13f' : section % 3 === 2 ? '#2e5fa3' : null
          const cIdx = Math.floor(lrand() * CROWD_COLORS.length)
          const jitterX = (lrand() - 0.5) * size
          const jitterY = (lrand() - 0.5) * size * 0.8
          const bob = variant === 1 && lrand() > 0.5 ? -size * 0.45 : 0
          ctx.fillStyle = sectionColor && lrand() < 0.55 ? sectionColor : CROWD_COLORS[cIdx]!
          ctx.beginPath()
          ctx.arc(x + jitterX, y + jitterY + bob, size * 0.62, 0, TAU)
          ctx.fill()
          // cabeca
          ctx.fillStyle = SKIN_TONES[Math.floor(lrand() * SKIN_TONES.length)]!
          ctx.beginPath()
          ctx.arc(x + jitterX, y + jitterY + bob - size * 0.72, size * 0.4, 0, TAU)
          ctx.fill()
        }
      }
      // sombra suave sobre a torcida para dar profundidade
      const shade = ctx.createLinearGradient(0, standTop, 0, horizonY)
      shade.addColorStop(0, 'rgba(8,12,24,0.55)')
      shade.addColorStop(1, 'rgba(8,12,24,0.05)')
      ctx.fillStyle = shade
      ctx.fillRect(0, standTop - 2, W, horizonY - standTop + 4)
      return layer
    }

    void rand
    this.crowdA = build(0)
    this.crowdB = build(1)
  }

  private renderVignette() {
    const [layer, ctx] = this.makeLayer()
    const { W, H, goalCx, goalLineY } = this.layout

    // Feixes volumetricos dos refletores em direcao a area
    const lightY = H * 0.055
    ctx.globalCompositeOperation = 'lighter'
    for (const fx of [W * 0.16, W * 0.38, W * 0.62, W * 0.84]) {
      const beam = ctx.createLinearGradient(fx, lightY, goalCx, goalLineY + H * 0.15)
      beam.addColorStop(0, 'rgba(255,248,214,0.10)')
      beam.addColorStop(0.55, 'rgba(255,248,214,0.035)')
      beam.addColorStop(1, 'rgba(255,248,214,0)')
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(fx - W * 0.015, lightY)
      ctx.lineTo(fx + W * 0.015, lightY)
      ctx.lineTo(goalCx + W * 0.34, goalLineY + H * 0.22)
      ctx.lineTo(goalCx - W * 0.34, goalLineY + H * 0.22)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'

    const g = ctx.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.45, W / 2, H * 0.52, Math.max(W, H) * 0.82)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(2,8,4,0.5)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    this.vignette = layer
  }

  // ------------------------------------------------------------------
  // Entrada do jogador
  // ------------------------------------------------------------------

  private toLocal(e: PointerEvent): Vec {
    const rect = this.canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  private aimBounds() {
    const { goalCx, goalLineY, goalW, goalH } = this.layout
    return {
      minX: goalCx - goalW * 0.66,
      maxX: goalCx + goalW * 0.66,
      minY: goalLineY - goalH * 1.32,
      maxY: goalLineY - goalH * 0.04
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.state !== 'ready' && this.state !== 'aiming') return
    this.pointerActive = true
    const b = this.aimBounds()
    const p = this.toLocal(e)
    this.aim = { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) }
    this.hasAim = true
    this.setState('aiming')
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerActive || this.state !== 'aiming') return
    const b = this.aimBounds()
    const p = this.toLocal(e)
    this.aim = { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) }
  }

  private onPointerUp = () => {
    if (!this.pointerActive) return
    this.pointerActive = false
    if (this.state === 'aiming' && this.hasAim) this.shoot(this.aim)
  }

  // ------------------------------------------------------------------
  // Logica da cobranca
  // ------------------------------------------------------------------

  private goalInnerRect() {
    const { goalCx, goalLineY, goalW, goalH, postW } = this.layout
    return {
      left: goalCx - goalW / 2 + postW,
      right: goalCx + goalW / 2 - postW,
      top: goalLineY - goalH + postW,
      bottom: goalLineY
    }
  }

  private shoot(target: Vec) {
    const rect = this.goalInnerRect()
    this.shotTarget = { ...target }

    const inGoal =
      target.x > rect.left && target.x < rect.right &&
      target.y > rect.top && target.y < rect.bottom

    // Goleiro escolhe um canto: tende a ir para o lado certo, mas nem sempre
    const cols = [lerp(rect.left, rect.right, 0.16), (rect.left + rect.right) / 2, lerp(rect.left, rect.right, 0.84)]
    const rowsY = [lerp(rect.top, rect.bottom, 0.32), lerp(rect.top, rect.bottom, 0.82)]
    const targetCol = target.x < lerp(rect.left, rect.right, 0.38) ? 0 : target.x > lerp(rect.left, rect.right, 0.62) ? 2 : 1
    const targetRow = target.y < lerp(rect.top, rect.bottom, 0.5) ? 0 : 1

    let col: number
    const guessRight = Math.random() < 0.58
    if (guessRight) col = targetCol
    else {
      const others = [0, 1, 2].filter((c) => c !== targetCol)
      col = others[Math.floor(Math.random() * others.length)]!
    }
    const row = Math.random() < (col === targetCol ? 0.62 : 0.5) ? targetRow : 1 - targetRow

    const dive: Vec = { x: cols[col]!, y: rowsY[row]! }
    this.keeperDive = { dir: Math.sign(dive.x - this.layout.goalCx) || 0, target: dive, active: true }

    if (!inGoal) {
      this.outcome = 'out'
    } else {
      const reach = this.layout.goalH * 0.36
      const dist = Math.hypot(dive.x - target.x, dive.y - target.y)
      this.outcome = dist < reach ? 'save' : 'goal'
      if (this.outcome === 'save') {
        this.impactPoint = {
          x: lerp(dive.x, target.x, 0.55),
          y: lerp(dive.y, target.y, 0.55)
        }
        const outX = this.impactPoint.x < this.layout.goalCx
          ? rect.left - this.layout.goalW * 0.42
          : rect.right + this.layout.goalW * 0.42
        this.deflectTarget = { x: outX, y: this.layout.goalLineY + this.layout.H * 0.06 }
      }
    }

    if (this.outcome === 'goal') this.impactPoint = { ...target }
    if (this.outcome === 'out') {
      // A bola segue alem do gol ate as placas
      const over = target.y < rect.top
      this.impactPoint = {
        x: lerp(this.layout.spot.x, target.x, over ? 1.25 : 1.18),
        y: over ? this.layout.boardTop + this.layout.H * 0.012 : lerp(this.layout.boardBottom, this.layout.goalLineY, 0.4)
      }
    }

    this.hasAim = false
    this.setState('runup')
  }

  private setState(s: EngineState) {
    this.state = s
    this.stateStart = this.now
    this.cb.onStateChange?.(s)
  }

  // ------------------------------------------------------------------
  // Loop principal
  // ------------------------------------------------------------------

  private frame = (ms: number) => {
    if (this.destroyed) return
    this.now = ms / 1000
    this.update()
    this.draw()
    this.raf = requestAnimationFrame(this.frame)
  }

  private stateT() {
    return this.now - this.stateStart
  }

  private update() {
    const t = this.stateT()
    const L = this.layout

    switch (this.state) {
      case 'runup': {
        if (t >= TIMINGS.runup) {
          this.setState('strike')
        }
        break
      }
      case 'strike': {
        if (t >= TIMINGS.strike) {
          this.cb.onKick?.()
          this.setState('flight')
        }
        break
      }
      case 'flight': {
        const ft = clamp(t / TIMINGS.flight, 0, 1)
        const end = this.outcome === 'save' ? this.impactPoint : this.outcome === 'goal' ? this.impactPoint : this.impactPoint
        const p = easeOutQuad(ft)
        this.ballPos = {
          x: lerp(L.spot.x, end.x, p),
          y: lerp(L.spot.y, end.y, p) - this.arcHeight() * Math.sin(Math.PI * ft)
        }
        this.ballScale = lerp(1, 0.42, p)
        this.ballSpin += 0.35
        this.pushTrail()
        if (ft >= 1) {
          this.onBallArrive()
          this.setState('aftermath')
        }
        break
      }
      case 'aftermath': {
        this.updateAftermath(t)
        if (t >= TIMINGS.aftermath) {
          if (!this.resultSent) {
            this.resultSent = true
            this.cb.onResult(this.outcome)
          }
          this.setState('done')
        }
        break
      }
    }

    // O rastro da bola se dissipa quando ela para de voar
    if (this.ballTrail.length && (this.state === 'done' || (this.state === 'aftermath' && this.outcome !== 'save'))) {
      this.ballTrail.shift()
    }

    // Confete
    if (this.confetti.length) {
      const dt = 1 / 60
      this.confetti = this.confetti.filter((c) => this.now - c.born < c.life)
      for (const c of this.confetti) {
        c.vy += 260 * dt
        c.vx *= 0.995
        c.x += c.vx * dt + Math.sin((this.now - c.born) * 6 + c.rot) * 0.6
        c.y += c.vy * dt
        c.rot += c.vrot * dt
      }
    }

    if (this.crowdExcitement > 0 && this.state === 'done') {
      this.crowdExcitement = Math.max(0, this.crowdExcitement - 0.004)
    }
  }

  private arcHeight() {
    const L = this.layout
    // Chutes altos sobem mais reto; chutes rasteiros fazem arco menor
    const targetH = clamp((L.goalLineY - this.shotTarget.y) / L.goalH, 0, 1.4)
    return lerp(L.H * 0.055, L.H * 0.012, clamp(targetH, 0, 1))
  }

  private onBallArrive() {
    this.shakeStart = this.now
    this.cb.onImpact?.(this.outcome)
    if (this.outcome === 'goal') {
      this.shake = 6
      this.ripples.push({ x: this.impactPoint.x, y: this.impactPoint.y, start: this.now })
      this.crowdExcitement = 1
      this.spawnConfetti()
    } else if (this.outcome === 'save') {
      this.shake = 4
    } else {
      this.shake = 3
    }
  }

  private updateAftermath(t: number) {
    const L = this.layout
    if (this.outcome === 'goal') {
      // A bola afunda na rede e cai
      const sink = clamp(t / 0.28, 0, 1)
      const drop = clamp((t - 0.3) / 0.7, 0, 1)
      this.ballPos = {
        x: this.impactPoint.x,
        y: this.impactPoint.y + easeOutQuad(sink) * L.goalH * 0.05 + easeInQuad(drop) * (L.goalLineY - this.impactPoint.y) * 0.9
      }
      this.ballScale = lerp(0.42, 0.4, sink)
    } else if (this.outcome === 'save') {
      // Rebote para fora apos a defesa
      const dt = clamp(t / 0.55, 0, 1)
      const p = easeOutQuad(dt)
      this.ballPos = {
        x: lerp(this.impactPoint.x, this.deflectTarget.x, p),
        y: lerp(this.impactPoint.y, this.deflectTarget.y, p) - L.H * 0.03 * Math.sin(Math.PI * dt)
      }
      this.ballScale = lerp(0.42, 0.5, p)
      this.ballSpin += 0.3
      this.pushTrail()
    } else {
      // Fora: a bola quica nas placas e rola
      const dt = clamp(t / 0.8, 0, 1)
      const bounce = Math.abs(Math.sin(dt * Math.PI * 1.6)) * (1 - dt)
      this.ballPos = {
        x: this.impactPoint.x + dt * (this.impactPoint.x > L.goalCx ? 1 : -1) * L.W * 0.04,
        y: this.impactPoint.y - bounce * L.H * 0.02
      }
      this.ballScale = 0.4
    }
  }

  private pushTrail() {
    this.ballTrail.push({ x: this.ballPos.x, y: this.ballPos.y, r: this.layout.ballR * this.ballScale })
    if (this.ballTrail.length > 8) this.ballTrail.shift()
  }

  private spawnConfetti() {
    const { W, H, horizonY } = this.layout
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * W
      const y = lerp(H * 0.1, horizonY, Math.random())
      this.confetti.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: Math.random() * 40 - 60,
        rot: Math.random() * TAU,
        vrot: (Math.random() - 0.5) * 10,
        w: lerp(3, 7, Math.random()),
        h: lerp(5, 11, Math.random()),
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
        born: this.now,
        life: lerp(1.6, 3, Math.random())
      })
    }
  }

  // ------------------------------------------------------------------
  // Desenho
  // ------------------------------------------------------------------

  private draw() {
    const ctx = this.ctx
    const L = this.layout
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    // Chacoalhar de camera
    if (this.shake > 0) {
      const st = this.now - this.shakeStart
      const decay = Math.max(0, 1 - st / 0.5)
      if (decay > 0) {
        ctx.translate(
          Math.sin(st * 55) * this.shake * decay,
          Math.cos(st * 47) * this.shake * decay * 0.6
        )
      } else {
        this.shake = 0
      }
    }

    // Zoom sutil de camera acompanhando o lance
    let zoom = 1
    if (this.state === 'flight') {
      zoom = 1 + 0.045 * easeInQuad(clamp(this.stateT() / TIMINGS.flight, 0, 1))
    } else if (this.state === 'aftermath') {
      zoom = 1 + 0.045 * (1 - clamp(this.stateT() / 0.9, 0, 1))
    }
    if (zoom !== 1) {
      const fx = L.W / 2
      const fy = L.H * 0.45
      ctx.translate(fx, fy)
      ctx.scale(zoom, zoom)
      ctx.translate(-fx, -fy)
    }

    if (this.staticLayer) ctx.drawImage(this.staticLayer, 0, 0, L.W, L.H)

    this.drawCrowd(ctx)
    this.drawNetAndGoal(ctx)
    this.drawKeeper(ctx)
    this.drawAimHint(ctx)
    this.drawBallShadow(ctx)
    this.drawKicker(ctx)
    this.drawBallTrail(ctx)
    this.drawBall(ctx)
    this.drawConfetti(ctx)

    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, L.W, L.H)
  }

  private drawCrowd(ctx: CanvasRenderingContext2D) {
    if (!this.crowdA || !this.crowdB) return
    const L = this.layout
    const excited = this.crowdExcitement
    const speed = excited > 0 ? 9 : 2.2
    const phase = (Math.sin(this.now * speed) + 1) / 2
    const jump = excited * Math.abs(Math.sin(this.now * 11)) * L.H * 0.006

    ctx.save()
    ctx.globalAlpha = 1
    ctx.drawImage(this.crowdA, 0, jump ? -jump : 0, L.W, L.H)
    ctx.globalAlpha = clamp(phase, 0, 1) * (excited > 0 ? 1 : 0.55)
    ctx.drawImage(this.crowdB, 0, -jump * 1.6, L.W, L.H)
    ctx.restore()
  }

  private netDisplacement(x: number, y: number): number {
    let d = 0
    for (const r of this.ripples) {
      const age = this.now - r.start
      if (age > 1.4) continue
      const dist = Math.hypot(x - r.x, y - r.y)
      d +=
        Math.exp(-dist / (this.layout.goalW * 0.16)) *
        Math.exp(-age * 3.2) *
        Math.sin(dist / (this.layout.goalW * 0.045) - age * 26) *
        this.layout.goalH * 0.06
    }
    return d
  }

  private drawNetAndGoal(ctx: CanvasRenderingContext2D) {
    const L = this.layout
    const { goalCx, goalLineY, goalW, goalH, postW } = L
    const left = goalCx - goalW / 2
    const right = goalCx + goalW / 2
    const top = goalLineY - goalH
    this.ripples = this.ripples.filter((r) => this.now - r.start < 1.4)

    const depth = goalW * 0.075
    const backLeft = left + depth
    const backRight = right - depth
    const backTop = top + depth * 0.55

    ctx.save()
    ctx.strokeStyle = 'rgba(235,240,248,0.5)'
    ctx.lineWidth = 1

    // Rede de fundo (malha com fisica de ondulacao)
    const cols = 15
    const rows = 8
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath()
      for (let r = 0; r <= rows; r++) {
        const bx = lerp(backLeft, backRight, c / cols)
        const sag = Math.sin((c / cols) * Math.PI) * goalH * 0.035 * (r / rows)
        const by = lerp(backTop, goalLineY, r / rows) + sag
        const disp = this.netDisplacement(bx, by)
        const px = bx + disp * 0.35
        const py = by + disp
        r === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath()
      for (let c = 0; c <= cols; c++) {
        const bx = lerp(backLeft, backRight, c / cols)
        const sag = Math.sin((c / cols) * Math.PI) * goalH * 0.035 * (r / rows)
        const by = lerp(backTop, goalLineY, r / rows) + sag
        const disp = this.netDisplacement(bx, by)
        const px = bx + disp * 0.35
        const py = by + disp
        c === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    // Redes laterais
    ctx.strokeStyle = 'rgba(235,240,248,0.35)'
    for (let i = 0; i <= 6; i++) {
      const t = i / 6
      ctx.beginPath()
      ctx.moveTo(left, lerp(top, goalLineY, t))
      ctx.lineTo(backLeft, lerp(backTop, goalLineY, t))
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(right, lerp(top, goalLineY, t))
      ctx.lineTo(backRight, lerp(backTop, goalLineY, t))
      ctx.stroke()
    }
    // Rede do teto
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      ctx.beginPath()
      ctx.moveTo(lerp(left, right, t), top)
      ctx.lineTo(lerp(backLeft, backRight, t), backTop)
      ctx.stroke()
    }

    // Traves com leve volume
    const postGrad = ctx.createLinearGradient(0, top, 0, goalLineY)
    postGrad.addColorStop(0, '#ffffff')
    postGrad.addColorStop(1, '#cfd6e0')
    ctx.fillStyle = postGrad
    ctx.fillRect(left - postW / 2, top - postW / 2, postW, goalH + postW)
    ctx.fillRect(right - postW / 2, top - postW / 2, postW, goalH + postW)
    ctx.fillRect(left - postW / 2, top - postW / 2, goalW + postW, postW)
    ctx.fillStyle = 'rgba(30,40,60,0.25)'
    ctx.fillRect(left + postW / 2 - 1, top - postW / 2, 1.5, goalH + postW)
    ctx.fillRect(right + postW / 2 - 1.5, top - postW / 2, 1.5, goalH + postW)

    ctx.restore()
  }

  // Capsula: membro com pontas arredondadas
  private limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // Capsula com sombreamento cilindrico (claro -> base -> escuro no eixo perpendicular)
  private limbShaded(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    w: number, hi: string, base: string, sh: string
  ) {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * (w / 2)
    const ny = (dx / len) * (w / 2)
    const g = ctx.createLinearGradient(x1 + nx, y1 + ny, x1 - nx, y1 - ny)
    g.addColorStop(0, hi)
    g.addColorStop(0.5, base)
    g.addColorStop(1, sh)
    ctx.strokeStyle = g
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  private drawKeeper(ctx: CanvasRenderingContext2D) {
    const L = this.layout
    const h = L.keeperH
    const u = h / 7 // unidade corporal
    const baseX = L.goalCx
    const baseY = L.goalLineY - 2

    ctx.save()

    const keeperShadow = (cx: number, spread: number) => {
      ctx.fillStyle = 'rgba(8,30,14,0.3)'
      ctx.beginPath()
      ctx.ellipse(cx, L.goalLineY + u * 0.3, u * spread, u * 0.42, 0, 0, TAU)
      ctx.fill()
    }

    if (this.keeperDive.active && (this.state === 'flight' || this.state === 'aftermath' || this.state === 'done' || this.state === 'strike' || this.state === 'runup')) {
      // Mergulho comeca junto com o chute
      let dt = 0
      if (this.state === 'flight') dt = clamp(this.stateT() / (TIMINGS.flight * 0.95), 0, 1)
      else if (this.state === 'aftermath' || this.state === 'done') dt = 1

      if (dt > 0) {
        const p = easeOutQuad(dt)
        const tx = this.keeperDive.target.x
        const ty = this.keeperDive.target.y
        const cx = lerp(baseX, tx, p)
        const cy = lerp(baseY - u * 3.6, ty, p) + Math.sin(p * Math.PI) * -u * 0.8
        const angle = lerp(0, Math.atan2(ty - (baseY - u * 3.6), tx - baseX) * 0.55, p)

        keeperShadow(cx, 2.6 + p * 1.4)
        ctx.translate(cx, cy)
        ctx.rotate(angle)
        this.drawKeeperFigure(ctx, u, 1, p)
        ctx.restore()
        return
      }
    }

    // Idle: balanco lateral + flexao
    const sway = Math.sin(this.now * 2.1) * u * 0.5
    const bounce = Math.abs(Math.sin(this.now * 2.1)) * u * 0.22
    keeperShadow(baseX + sway, 2.2)
    ctx.translate(baseX + sway, baseY - u * 3.6 + bounce)
    this.drawKeeperFigure(ctx, u, 0, 0)
    ctx.restore()
  }

  /** Goleiro de preto com paineis, frisos neon e luvas verdes com dedos. mode 0 = idle, 1 = mergulho. */
  private drawKeeperFigure(ctx: CanvasRenderingContext2D, u: number, mode: number, diveP: number) {
    const kit = '#17181d'
    const kitHi = '#2e3039'
    const kitSh = '#0c0d11'
    const panel = '#22242c'
    const neon = '#8dff5a'
    const accent = '#3d7a22'
    const gloveSh = '#5ec432'
    const skin = '#c98e63'
    const skinSh = '#a06f48'
    const hairColor = '#1c1108'

    // Luva com palma e dedos abertos apontando para "ang"
    const glove = (x: number, y: number, s: number, ang: number) => {
      ctx.fillStyle = gloveSh
      ctx.beginPath()
      ctx.arc(x, y, s, 0, TAU)
      ctx.fill()
      ctx.fillStyle = neon
      ctx.beginPath()
      ctx.arc(x - s * 0.12, y - s * 0.12, s * 0.82, 0, TAU)
      ctx.fill()
      for (let f = -1.5; f <= 1.5; f++) {
        const fa = ang + f * 0.42
        ctx.fillStyle = neon
        ctx.beginPath()
        ctx.arc(x + Math.cos(fa) * s * 1.05, y + Math.sin(fa) * s * 1.05, s * 0.3, 0, TAU)
        ctx.fill()
      }
    }

    // Cabeca com sombreamento e cabelo curto
    const head = (x: number, y: number, r: number) => {
      ctx.fillStyle = skinSh
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = skin
      ctx.beginPath()
      ctx.arc(x - r * 0.12, y - r * 0.1, r * 0.9, 0, TAU)
      ctx.fill()
      ctx.fillStyle = hairColor
      ctx.beginPath()
      ctx.arc(x, y - r * 0.28, r * 0.94, Math.PI * 0.95, TAU * 1.025)
      ctx.fill()
    }

    if (mode === 0) {
      const armDrop = Math.sin(this.now * 2.1) * u * 0.12

      // Pernas flexionadas em dois segmentos (coxa + canela) com meiao
      const leg = (side: number) => {
        const hip: Vec = { x: side * u * 0.55, y: u * 1.55 }
        const knee: Vec = { x: side * u * 1.0, y: u * 2.45 }
        const ankle: Vec = { x: side * u * 1.08, y: u * 3.32 }
        this.limbShaded(ctx, hip.x, hip.y, knee.x, knee.y, u * 0.64, kitHi, kit, kitSh)
        this.limbShaded(ctx, knee.x, knee.y, ankle.x, ankle.y, u * 0.5, kitHi, kit, kitSh)
        this.limb(ctx, knee.x, knee.y, lerp(knee.x, ankle.x, 0.12), lerp(knee.y, ankle.y, 0.12), u * 0.34, accent)
        this.limbShaded(ctx, ankle.x, ankle.y, ankle.x + side * u * 0.42, ankle.y + u * 0.1, u * 0.4, '#3a4152', '#0a0a0d', '#050508')
      }
      leg(-1)
      leg(1)

      // Tronco com paineis e frisos neon
      const torsoGrad = ctx.createLinearGradient(-u, 0, u, 0)
      torsoGrad.addColorStop(0, kitHi)
      torsoGrad.addColorStop(0.5, kit)
      torsoGrad.addColorStop(1, kitSh)
      ctx.fillStyle = torsoGrad
      ctx.beginPath()
      ctx.moveTo(-u * 1.05, -u * 1.4)
      ctx.quadraticCurveTo(0, -u * 1.78, u * 1.05, -u * 1.4)
      ctx.quadraticCurveTo(u * 1.12, u * 0.2, u * 0.85, u * 1.7)
      ctx.quadraticCurveTo(0, u * 2, -u * 0.85, u * 1.7)
      ctx.quadraticCurveTo(-u * 1.12, u * 0.2, -u * 1.05, -u * 1.4)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = panel
      ctx.fillRect(-u * 0.2, -u * 1.55, u * 0.4, u * 3.1)
      ctx.strokeStyle = 'rgba(141,255,90,0.4)'
      ctx.lineWidth = u * 0.05
      ctx.beginPath()
      ctx.moveTo(-u * 0.92, -u * 1.3)
      ctx.quadraticCurveTo(-u * 1.0, u * 0.2, -u * 0.78, u * 1.62)
      ctx.moveTo(u * 0.92, -u * 1.3)
      ctx.quadraticCurveTo(u * 1.0, u * 0.2, u * 0.78, u * 1.62)
      ctx.stroke()
      // Numero 1 nas costas
      ctx.font = `800 ${u * 0.9}px 'Segoe UI', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(141,255,90,0.75)'
      ctx.fillText('1', 0, -u * 0.45)

      // Bracos prontos em dois segmentos com punho neon
      const arm = (side: number) => {
        const shoulder: Vec = { x: side * u * 0.98, y: -u * 1.12 }
        const elbow: Vec = { x: side * u * 1.62, y: -u * 0.25 + armDrop * 0.5 }
        const wrist: Vec = { x: side * u * 1.92, y: u * 0.5 + armDrop }
        this.limbShaded(ctx, shoulder.x, shoulder.y, elbow.x, elbow.y, u * 0.5, kitHi, kit, kitSh)
        this.limbShaded(ctx, elbow.x, elbow.y, wrist.x, wrist.y, u * 0.44, kitHi, kit, kitSh)
        this.limb(ctx, lerp(elbow.x, wrist.x, 0.85), lerp(elbow.y, wrist.y, 0.85), wrist.x, wrist.y, u * 0.3, accent)
        glove(side * u * 2.02, u * 0.72 + armDrop, u * 0.3, side > 0 ? 0.5 : Math.PI - 0.5)
      }
      arm(-1)
      arm(1)

      head(0, -u * 2.2, u * 0.62)
    } else {
      const stretch = lerp(0.4, 1, diveP)

      // Corpo esticado na direcao do mergulho, com sombreamento e painel
      const bodyGrad = ctx.createLinearGradient(0, -u, 0, u)
      bodyGrad.addColorStop(0, kitHi)
      bodyGrad.addColorStop(0.5, kit)
      bodyGrad.addColorStop(1, kitSh)
      ctx.fillStyle = bodyGrad
      ctx.beginPath()
      ctx.ellipse(0, 0, u * 1.7 * stretch + u * 0.6, u * 1.02, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(141,255,90,0.4)'
      ctx.lineWidth = u * 0.05
      ctx.beginPath()
      ctx.ellipse(0, 0, u * 1.45 * stretch + u * 0.45, u * 0.78, 0, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()

      // Pernas juntas para tras (coxa + canela) com meiao e chuteira
      const legBack = (off: number, tone0: string, tone1: string) => {
        const hip: Vec = { x: -u * 1.3 * stretch, y: off }
        const knee: Vec = { x: -u * 2.3 * stretch, y: off + u * 0.42 }
        const ankle: Vec = { x: -u * 3.25 * stretch, y: off + u * 0.55 }
        this.limbShaded(ctx, hip.x, hip.y, knee.x, knee.y, u * 0.58, tone0, kit, kitSh)
        this.limbShaded(ctx, knee.x, knee.y, ankle.x, ankle.y, u * 0.46, tone1, kit, kitSh)
        this.limb(ctx, knee.x, knee.y, lerp(knee.x, ankle.x, 0.15), lerp(knee.y, ankle.y, 0.15), u * 0.32, accent)
        this.limbShaded(ctx, ankle.x, ankle.y, ankle.x - u * 0.4, ankle.y + u * 0.08, u * 0.38, '#3a4152', '#0a0a0d', '#050508')
      }
      legBack(u * 0.32, kitHi, kitHi)
      legBack(-u * 0.05, panel, panel)

      // Bracos esticados na direcao da bola com luvas abertas
      const armDive = (sx: number, sy: number, ex: number, ey: number, tone: string) => {
        const mid: Vec = { x: lerp(sx, ex, 0.5), y: lerp(sy, ey, 0.5) - u * 0.12 }
        this.limbShaded(ctx, sx, sy, mid.x, mid.y, u * 0.5, tone, kit, kitSh)
        this.limbShaded(ctx, mid.x, mid.y, ex, ey, u * 0.44, tone, kit, kitSh)
        this.limb(ctx, lerp(mid.x, ex, 0.85), lerp(mid.y, ey, 0.85), ex, ey, u * 0.3, accent)
      }
      armDive(u * 1.1 * stretch, -u * 0.4, u * 2.9 * stretch, -u * 1.15, kitHi)
      armDive(u * 1.1 * stretch, u * 0.1, u * 3.1 * stretch, -u * 0.55, panel)
      const reachAng = Math.atan2(-u * 1.15 + u * 0.4, u * 2.9 - u * 1.1)
      glove(u * 3.02 * stretch, -u * 1.22, u * 0.32, reachAng)
      glove(u * 3.22 * stretch, -u * 0.6, u * 0.32, reachAng)

      head(u * 1.35 * stretch, -u * 0.75, u * 0.6)
    }
  }

  private kickerAnchor(): { pos: Vec; runP: number; kickP: number } {
    const L = this.layout
    const start: Vec = { x: L.spot.x - L.ballR * 4.0, y: L.spot.y + L.ballR * 1.5 }
    const plant: Vec = { x: L.spot.x - L.ballR * 2.1, y: L.spot.y + L.ballR * 0.9 }

    if (this.state === 'runup') {
      const t = easeInQuad(clamp(this.stateT() / TIMINGS.runup, 0, 1))
      return { pos: { x: lerp(start.x, plant.x, t), y: lerp(start.y, plant.y, t) }, runP: clamp(this.stateT() / TIMINGS.runup, 0, 1), kickP: 0 }
    }
    if (this.state === 'strike') {
      return { pos: plant, runP: 1, kickP: clamp(this.stateT() / TIMINGS.strike, 0, 1) }
    }
    if (this.state === 'flight' || this.state === 'aftermath' || this.state === 'done') {
      return { pos: plant, runP: 1, kickP: 1 }
    }
    return { pos: start, runP: 0, kickP: 0 }
  }

  /**
   * Batedor com anatomia humanizada: membros afunilados com volume muscular,
   * joelhos e cotovelos resolvidos por IK de dois ossos, deltoides, tronco em
   * formato de costas, chuteiras modeladas e cabeca com silhueta de cabelo.
   * Camisa amarela com detalhes verdes, calcao azul. Vista de costas.
   */
  private drawKicker(ctx: CanvasRenderingContext2D) {
    const L = this.layout
    const { pos, runP, kickP } = this.kickerAnchor()
    const u = L.kickerH / 7

    const skin = '#8a5a3b'
    const skinHi = '#a5714b'
    const skinSh = '#61402a'
    const shirt = '#ffd23f'
    const shirtHi = '#ffe37a'
    const shirtSh = '#d9a015'
    const trim = '#127a45'
    const shorts = '#1f4fd0'
    const shortsHi = '#3f6ae8'
    const shortsSh = '#132f86'
    const sock = '#1f4fd0'
    const sockHi = '#3f6ae8'
    const sockSh = '#12308c'
    const bootC = '#15181f'
    const bootHi = '#3a4152'
    const hairC = '#241509'
    const hairHi = '#412a13'

    // Membro afunilado com barriga muscular e sombreamento cilindrico
    const muscle = (
      a: Vec, b: Vec, wa: number, wb: number, bulge: number,
      hi: string, base: string, sh: string
    ) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const th = Math.atan2(dy, dx)
      const nx = -dy / len
      const ny = dx / len
      const midW = Math.max(wa, wb) / 2 + bulge
      const m1: Vec = { x: a.x + dx * 0.42 + nx * midW, y: a.y + dy * 0.42 + ny * midW }
      const m2: Vec = { x: a.x + dx * 0.42 - nx * midW, y: a.y + dy * 0.42 - ny * midW }
      const g = ctx.createLinearGradient(a.x + nx * midW, a.y + ny * midW, a.x - nx * midW, a.y - ny * midW)
      g.addColorStop(0, hi)
      g.addColorStop(0.55, base)
      g.addColorStop(1, sh)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(a.x, a.y, wa / 2, th + Math.PI / 2, th - Math.PI / 2)
      ctx.quadraticCurveTo(m2.x, m2.y, b.x - nx * (wb / 2), b.y - ny * (wb / 2))
      ctx.arc(b.x, b.y, wb / 2, th - Math.PI / 2, th + Math.PI / 2)
      ctx.quadraticCurveTo(m1.x, m1.y, a.x + nx * (wa / 2), a.y + ny * (wa / 2))
      ctx.closePath()
      ctx.fill()
    }

    // IK de dois ossos: posicao do joelho/cotovelo dado quadril/ombro e tornozelo/mao
    const solveJoint = (root: Vec, end: Vec, l1: number, l2: number, sign: number): Vec => {
      let dx = end.x - root.x
      let dy = end.y - root.y
      let d = Math.hypot(dx, dy) || 0.0001
      const maxD = (l1 + l2) * 0.995
      if (d > maxD) {
        dx *= maxD / d
        dy *= maxD / d
        d = maxD
      }
      const proj = (d * d + l1 * l1 - l2 * l2) / (2 * d)
      const h = Math.sqrt(Math.max(l1 * l1 - proj * proj, 0.0001))
      return {
        x: root.x + (dx * proj) / d + ((-dy / d) * h) * sign,
        y: root.y + (dy * proj) / d + ((dx / d) * h) * sign
      }
    }

    ctx.save()
    ctx.translate(pos.x, pos.y)

    // Sombra de contato
    ctx.fillStyle = 'rgba(8,30,14,0.35)'
    ctx.beginPath()
    ctx.ellipse(u * 0.2, u * 3.5, u * 1.7, u * 0.48, 0, 0, TAU)
    ctx.fill()

    const running = this.state === 'runup'
    const idle = this.state === 'ready' || this.state === 'aiming'
    const breath = idle ? Math.sin(this.now * 1.8) * u * 0.05 : 0
    const swing = kickP > 0 ? easeOutCubic(kickP) : (running ? -easeInQuad(runP) : 0)

    // Tronco inclina: leve na espera, preparo no runup, chicote no chute
    const lean = kickP > 0 ? lerp(0.1, -0.24, swing) : running ? lerp(0.03, 0.1, runP) : 0.03
    ctx.rotate(lean)

    const hipL: Vec = { x: -u * 0.42, y: u * 0.95 }
    const hipR: Vec = { x: u * 0.42, y: u * 0.95 }
    const thighLen = u * 1.28
    const shinLen = u * 1.22

    // Tornozelos: passo e preparo para o chute
    let ankleL: Vec = { x: hipL.x - u * 0.14, y: u * 3.42 }
    let ankleR: Vec = { x: hipR.x + u * 0.14, y: u * 3.42 }
    if (running) {
      // Perna esquerda vai plantando pra frente no passo
      ankleL.x -= runP * u * 1.0
      ankleL.y -= Math.sin(runP * Math.PI) * u * 0.5
    } else if (kickP > 0 || this.state === 'flight' || this.state === 'aftermath' || this.state === 'done') {
      ankleL.x -= u * 1.0
    }

    let footAngR = 0
    if (kickP > 0 || running) {
      const ang = swing < 0 
         ? lerp(Math.PI * 0.45, Math.PI * 0.8, -swing) 
         : lerp(Math.PI * 0.8, -Math.PI * 0.3, swing)
      const reach = (thighLen + shinLen) * 0.92
      ankleR = {
        x: hipR.x + Math.cos(ang + Math.PI / 2) * reach * 0.88,
        y: hipR.y + Math.sin(ang + Math.PI / 2) * reach
      }
      footAngR = swing < 0 
         ? lerp(0.06, 0.9, -swing)
         : lerp(0.9, -0.55, swing)
    }

    // Chuteira modelada: calcanhar, sola e bico
    const bootShape = (ankle: Vec, dir: number, angle: number) => {
      ctx.save()
      ctx.translate(ankle.x, ankle.y + u * 0.08)
      ctx.rotate(angle)
      const g = ctx.createLinearGradient(0, -u * 0.18, 0, u * 0.2)
      g.addColorStop(0, bootHi)
      g.addColorStop(0.5, bootC)
      g.addColorStop(1, '#06080c')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(-dir * u * 0.28, -u * 0.14)
      ctx.quadraticCurveTo(-dir * u * 0.36, u * 0.08, -dir * u * 0.24, u * 0.16)
      ctx.lineTo(dir * u * 0.4, u * 0.17)
      ctx.quadraticCurveTo(dir * u * 0.62, u * 0.15, dir * u * 0.58, u * 0.02)
      ctx.quadraticCurveTo(dir * u * 0.5, -u * 0.12, dir * u * 0.16, -u * 0.16)
      ctx.closePath()
      ctx.fill()
      // Sola
      ctx.strokeStyle = '#dfe5ee'
      ctx.lineWidth = u * 0.055
      ctx.beginPath()
      ctx.moveTo(-dir * u * 0.26, u * 0.185)
      ctx.lineTo(dir * u * 0.46, u * 0.19)
      ctx.stroke()
      ctx.restore()
    }

    // Perna completa: coxa afunilando, joelho continuo, panturrilha no meiao, chuteira
    const drawLeg = (hip: Vec, ankle: Vec, kneeSign: number, bootDir: number, bootAng: number) => {
      const knee = solveJoint(hip, ankle, thighLen, shinLen, kneeSign)
      const sockTop: Vec = { x: lerp(knee.x, ankle.x, 0.28), y: lerp(knee.y, ankle.y, 0.28) }
      // Coxa: larga no quadril, estreita no joelho
      muscle(hip, knee, u * 0.56, u * 0.36, u * 0.03, skinHi, skin, skinSh)
      // Panturrilha nua ate o meiao (mesma largura do joelho para nao criar degrau)
      muscle(knee, sockTop, u * 0.36, u * 0.33, u * 0.02, skinHi, skin, skinSh)
      // Meiao com barriga da panturrilha
      muscle(sockTop, ankle, u * 0.38, u * 0.24, u * 0.06, sockHi, sock, sockSh)
      // Punho amarelo do meiao
      this.limb(ctx, sockTop.x, sockTop.y, lerp(sockTop.x, ankle.x, 0.13), lerp(sockTop.y, ankle.y, 0.13), u * 0.34, shirt)
      bootShape(ankle, bootDir, bootAng)
    }

    // As duas pernas ficam atras do calcao: o tecido cobre o topo das coxas
    drawLeg(hipL, ankleL, -1, -1, running ? -0.1 : -0.06)
    drawLeg(hipR, ankleR, (kickP > 0 || running) ? (swing < 0.4 ? 1 : -1) : 1, 1, (kickP > 0 || running) ? footAngR : 0.06)

    // Calcao azul: pelvis com abertura das pernas e frisos
    const shortsGrad = ctx.createLinearGradient(-u, 0, u, 0)
    shortsGrad.addColorStop(0, shortsHi)
    shortsGrad.addColorStop(0.5, shorts)
    shortsGrad.addColorStop(1, shortsSh)
    ctx.fillStyle = shortsGrad
    ctx.beginPath()
    ctx.moveTo(-u * 0.88, u * 0.1)
    ctx.lineTo(u * 0.88, u * 0.1)
    ctx.quadraticCurveTo(u * 1.06, u * 0.75, u * 1.0, u * 1.34)
    ctx.quadraticCurveTo(u * 0.66, u * 1.5, u * 0.3, u * 1.44)
    ctx.quadraticCurveTo(u * 0.1, u * 1.1, 0, u * 1.08)
    ctx.quadraticCurveTo(-u * 0.1, u * 1.1, -u * 0.3, u * 1.44)
    ctx.quadraticCurveTo(-u * 0.66, u * 1.5, -u * 1.0, u * 1.34)
    ctx.quadraticCurveTo(-u * 1.06, u * 0.75, -u * 0.88, u * 0.1)
    ctx.closePath()
    ctx.fill()
    // Sombra da barra das pernas do calcao
    ctx.strokeStyle = 'rgba(6,16,50,0.5)'
    ctx.lineWidth = u * 0.06
    ctx.beginPath()
    ctx.moveTo(-u * 0.94, u * 1.3)
    ctx.quadraticCurveTo(-u * 0.6, u * 1.44, -u * 0.32, u * 1.4)
    ctx.moveTo(u * 0.94, u * 1.3)
    ctx.quadraticCurveTo(u * 0.6, u * 1.44, u * 0.32, u * 1.4)
    ctx.stroke()
    // Frisos amarelos laterais
    ctx.strokeStyle = shirt
    ctx.lineWidth = u * 0.07
    ctx.beginPath()
    ctx.moveTo(-u * 0.9, u * 0.18)
    ctx.quadraticCurveTo(-u * 1.02, u * 0.75, -u * 0.97, u * 1.26)
    ctx.moveTo(u * 0.9, u * 0.18)
    ctx.quadraticCurveTo(u * 1.02, u * 0.75, u * 0.97, u * 1.26)
    ctx.stroke()

    // Tronco: costas com ombros largos, latissimo afunilando para a cintura
    const shirtGrad = ctx.createLinearGradient(-u * 1.1, 0, u * 1.1, 0)
    shirtGrad.addColorStop(0, shirtHi)
    shirtGrad.addColorStop(0.45, shirt)
    shirtGrad.addColorStop(1, shirtSh)
    ctx.fillStyle = shirtGrad
    ctx.beginPath()
    ctx.moveTo(-u * 0.5, -u * 2.32)
    ctx.quadraticCurveTo(-u * 1.02, -u * 2.28, -u * 1.12, -u * 1.78)
    ctx.quadraticCurveTo(-u * 1.08, -u * 0.6, -u * 0.86, u * 0.42)
    ctx.quadraticCurveTo(0, u * 0.66, u * 0.86, u * 0.42)
    ctx.quadraticCurveTo(u * 1.08, -u * 0.6, u * 1.12, -u * 1.78)
    ctx.quadraticCurveTo(u * 1.02, -u * 2.28, u * 0.5, -u * 2.32)
    ctx.quadraticCurveTo(0, -u * 2.2, -u * 0.5, -u * 2.32)
    ctx.closePath()
    ctx.fill()
    // Sombra da coluna e escapulas
    ctx.strokeStyle = 'rgba(120,80,0,0.22)'
    ctx.lineWidth = u * 0.05
    ctx.beginPath()
    ctx.moveTo(0, -u * 2.1)
    ctx.lineTo(0, u * 0.44)
    ctx.moveTo(-u * 0.55, -u * 1.86)
    ctx.quadraticCurveTo(-u * 0.3, -u * 1.6, -u * 0.5, -u * 1.3)
    ctx.moveTo(u * 0.55, -u * 1.86)
    ctx.quadraticCurveTo(u * 0.3, -u * 1.6, u * 0.5, -u * 1.3)
    ctx.stroke()
    // Barra da camisa com faixa verde
    ctx.strokeStyle = trim
    ctx.lineWidth = u * 0.09
    ctx.beginPath()
    ctx.moveTo(-u * 0.84, u * 0.46)
    ctx.quadraticCurveTo(0, u * 0.7, u * 0.84, u * 0.46)
    ctx.stroke()
    // Numero 9 com contorno
    ctx.font = `800 ${u * 1.1}px 'Segoe UI', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = u * 0.15
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.strokeText('9', 0, -u * 0.8)
    ctx.fillStyle = '#12326e'
    ctx.fillText('9', 0, -u * 0.8)

    // Bracos com cotovelo por IK: manga, antebraco de pele e punho fechado
    const upperLen = u * 1.05
    const foreLen = u * 1.0
    const drawArm = (side: number, hand: Vec, elbowSign: number) => {
      const shoulder: Vec = { x: side * u * 0.94, y: -u * 1.98 }
      const elbow = solveJoint(shoulder, hand, upperLen, foreLen, elbowSign)
      // Manga curta ate acima do cotovelo (a ponta redonda faz o ombro)
      const sleeveEnd: Vec = { x: lerp(shoulder.x, elbow.x, 0.6), y: lerp(shoulder.y, elbow.y, 0.6) }
      muscle(shoulder, sleeveEnd, u * 0.44, u * 0.36, u * 0.01, shirtHi, shirt, shirtSh)
      this.limb(ctx, lerp(shoulder.x, sleeveEnd.x, 0.88), lerp(shoulder.y, sleeveEnd.y, 0.88), sleeveEnd.x, sleeveEnd.y, u * 0.3, trim)
      // Biceps/triceps de pele + antebraco afunilando ate o punho
      muscle(sleeveEnd, elbow, u * 0.3, u * 0.26, u * 0.02, skinHi, skin, skinSh)
      muscle(elbow, hand, u * 0.26, u * 0.17, u * 0.02, skinHi, skin, skinSh)
      // Mao
      ctx.fillStyle = skin
      ctx.beginPath()
      ctx.ellipse(hand.x, hand.y, u * 0.17, u * 0.21, Math.atan2(hand.y - elbow.y, hand.x - elbow.x), 0, TAU)
      ctx.fill()
    }

    let handL: Vec
    let handR: Vec
    if (running || kickP > 0) {
      // Bracos abrem equilibrando durante windup (swing < 0) e chute (swing > 0)
      const p = swing < 0 ? -swing : 0
      const k = swing > 0 ? swing : 0
      handL = { 
        x: lerp(lerp(-u * 1.02, -u * 1.1, p), -u * 1.85, k), 
        y: lerp(lerp(u * 0.4, u * 0.1, p), -u * 1.5, k) 
      }
      handR = { 
        x: lerp(lerp(u * 1.02, u * 1.1, p), u * 1.5, k), 
        y: lerp(lerp(u * 0.4, u * 0.1, p), u * 0.75, k) 
      }
    } else {
      // Bracos relaxados ao lado do corpo
      handL = { x: -u * 1.02, y: u * 0.4 + breath * 2 }
      handR = { x: u * 1.02, y: u * 0.4 + breath * 2 }
    }
    drawArm(-1, handL, -1)
    drawArm(1, handR, 1)

    // Pescoco com trapezio
    const neckGrad = ctx.createLinearGradient(-u * 0.2, 0, u * 0.2, 0)
    neckGrad.addColorStop(0, skinHi)
    neckGrad.addColorStop(1, skinSh)
    ctx.fillStyle = neckGrad
    ctx.beginPath()
    ctx.moveTo(-u * 0.46, -u * 2.24)
    ctx.quadraticCurveTo(-u * 0.2, -u * 2.42, -u * 0.19, -u * 2.62)
    ctx.lineTo(u * 0.19, -u * 2.62)
    ctx.quadraticCurveTo(u * 0.2, -u * 2.42, u * 0.46, -u * 2.24)
    ctx.quadraticCurveTo(0, -u * 2.38, -u * 0.46, -u * 2.24)
    ctx.closePath()
    ctx.fill()
    // Gola verde
    ctx.strokeStyle = trim
    ctx.lineWidth = u * 0.11
    ctx.beginPath()
    ctx.moveTo(-u * 0.42, -u * 2.28)
    ctx.quadraticCurveTo(0, -u * 2.46, u * 0.42, -u * 2.28)
    ctx.stroke()

    // Cabeca: cranio levemente oval, orelhas, cabelo curto com linha da nuca
    const headY = -u * 3.02 + breath
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.ellipse(0, headY, u * 0.5, u * 0.56, 0, 0, TAU)
    ctx.fill()
    // Sombra do queixo/mandibula na base
    ctx.fillStyle = skinSh
    ctx.beginPath()
    ctx.ellipse(0, headY + u * 0.34, u * 0.32, u * 0.18, 0, 0, Math.PI)
    ctx.fill()
    // Orelhas
    for (const s of [-1, 1]) {
      ctx.fillStyle = skin
      ctx.beginPath()
      ctx.ellipse(s * u * 0.5, headY + u * 0.05, u * 0.1, u * 0.15, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = skinSh
      ctx.beginPath()
      ctx.ellipse(s * u * 0.5, headY + u * 0.05, u * 0.045, u * 0.08, 0, 0, TAU)
      ctx.fill()
    }
    // Cabelo: coroa cheia com nuca em W suave
    ctx.fillStyle = hairC
    ctx.beginPath()
    ctx.moveTo(-u * 0.52, headY + u * 0.1)
    ctx.quadraticCurveTo(-u * 0.6, headY - u * 0.42, -u * 0.22, headY - u * 0.58)
    ctx.quadraticCurveTo(0, headY - u * 0.66, u * 0.22, headY - u * 0.58)
    ctx.quadraticCurveTo(u * 0.6, headY - u * 0.42, u * 0.52, headY + u * 0.1)
    ctx.quadraticCurveTo(u * 0.34, headY + u * 0.3, u * 0.18, headY + u * 0.16)
    ctx.quadraticCurveTo(0, headY + u * 0.28, -u * 0.18, headY + u * 0.16)
    ctx.quadraticCurveTo(-u * 0.34, headY + u * 0.3, -u * 0.52, headY + u * 0.1)
    ctx.closePath()
    ctx.fill()
    // Brilho do cabelo
    ctx.strokeStyle = hairHi
    ctx.lineWidth = u * 0.06
    ctx.beginPath()
    ctx.arc(0, headY - u * 0.08, u * 0.42, Math.PI * 1.12, Math.PI * 1.55)
    ctx.stroke()

    ctx.restore()
  }

  private drawBallShadow(ctx: CanvasRenderingContext2D) {
    const L = this.layout
    const groundY = this.state === 'flight' || this.state === 'aftermath' || this.state === 'done'
      ? Math.max(this.ballPos.y, lerp(L.goalLineY, L.spot.y, 0.1))
      : L.spot.y
    const height = clamp((groundY - this.ballPos.y) / (L.H * 0.2), 0, 1)
    ctx.fillStyle = `rgba(8,30,14,${lerp(0.4, 0.12, height)})`
    ctx.beginPath()
    ctx.ellipse(
      this.ballPos.x,
      groundY + L.ballR * 0.4,
      L.ballR * this.ballScale * lerp(1.15, 0.7, height),
      L.ballR * this.ballScale * 0.34,
      0, 0, TAU
    )
    ctx.fill()
  }

  private drawBallTrail(ctx: CanvasRenderingContext2D) {
    const n = this.ballTrail.length
    if (n < 2) return
    for (let i = 0; i < n; i++) {
      const p = this.ballTrail[i]!
      ctx.fillStyle = `rgba(255,255,255,${(0.22 * (i + 1)) / n})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * (0.5 + (0.4 * (i + 1)) / n), 0, TAU)
      ctx.fill()
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D) {
    const L = this.layout
    const r = L.ballR * this.ballScale
    const { x, y } = this.ballPos

    ctx.save()
    ctx.translate(x, y)

    const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.05)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.75, '#e9edf2')
    grad.addColorStop(1, '#b9c2cf')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()

    // Gomos girando
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.clip()
    ctx.rotate(this.ballSpin)
    ctx.fillStyle = '#20262e'
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU
      const px = Math.cos(a) * r * 0.62
      const py = Math.sin(a) * r * 0.62
      ctx.beginPath()
      ctx.moveTo(px, py - r * 0.26)
      for (let k = 1; k <= 5; k++) {
        const b = a + (k / 5) * TAU
        ctx.lineTo(px + Math.cos(b) * r * 0.26, py - r * 0.26 + Math.sin(b) * r * 0.26 + r * 0.13)
      }
      ctx.closePath()
      ctx.fill()
    }
    ctx.beginPath()
    ctx.fillStyle = '#20262e'
    for (let k = 0; k <= 5; k++) {
      const b = (k / 5) * TAU - Math.PI / 2
      const vx = Math.cos(b) * r * 0.3
      const vy = Math.sin(b) * r * 0.3
      k === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Brilho
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.28, r * 0.18, -0.6, 0, TAU)
    ctx.fill()

    ctx.restore()
  }

  private drawAimHint(ctx: CanvasRenderingContext2D) {
    if (this.state !== 'aiming' && this.state !== 'ready') return
    const L = this.layout

    if (this.state === 'aiming' && this.hasAim) {
      const rect = this.goalInnerRect()
      // Grade de zonas sutil
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 1
      for (let c = 1; c < 3; c++) {
        const x = lerp(rect.left, rect.right, c / 3)
        ctx.beginPath()
        ctx.moveTo(x, rect.top)
        ctx.lineTo(x, rect.bottom)
        ctx.stroke()
      }
      const midY = lerp(rect.top, rect.bottom, 0.5)
      ctx.beginPath()
      ctx.moveTo(rect.left, midY)
      ctx.lineTo(rect.right, midY)
      ctx.stroke()

      // Mira
      const pulse = 1 + Math.sin(this.now * 7) * 0.08
      const rr = L.ballR * 1.5 * pulse
      const inGoal =
        this.aim.x > rect.left && this.aim.x < rect.right &&
        this.aim.y > rect.top && this.aim.y < rect.bottom
      const color = inGoal ? 'rgba(141,255,90,0.95)' : 'rgba(255,110,90,0.95)'
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(this.aim.x, this.aim.y, rr, 0, TAU)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(this.aim.x, this.aim.y, rr * 0.45, 0, TAU)
      ctx.stroke()
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4
        ctx.beginPath()
        ctx.moveTo(this.aim.x + Math.cos(a) * rr * 1.15, this.aim.y + Math.sin(a) * rr * 1.15)
        ctx.lineTo(this.aim.x + Math.cos(a) * rr * 1.5, this.aim.y + Math.sin(a) * rr * 1.5)
        ctx.stroke()
      }

      // Linha tracejada da bola ate a mira
      ctx.setLineDash([6, 8])
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(L.spot.x, L.spot.y - L.ballR)
      ctx.quadraticCurveTo(
        (L.spot.x + this.aim.x) / 2,
        Math.min(L.spot.y, this.aim.y) - L.H * 0.05,
        this.aim.x,
        this.aim.y
      )
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
  }

  private drawConfetti(ctx: CanvasRenderingContext2D) {
    for (const c of this.confetti) {
      const age = (this.now - c.born) / c.life
      ctx.save()
      ctx.globalAlpha = clamp(1 - age, 0, 1)
      ctx.translate(c.x, c.y)
      ctx.rotate(c.rot)
      ctx.fillStyle = c.color
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * (0.4 + Math.abs(Math.sin(c.rot * 2)) * 0.6))
      ctx.restore()
    }
  }
}
