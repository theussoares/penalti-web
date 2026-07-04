/**
 * Motor 3D do jogo de penalti (Three.js / WebGL).
 *
 * Mundo em metros, regras reais: gol 7,32 x 2,44, marca do penalti a 11m.
 * Eixos: batedor olha para -Z; linha do gol em z = -11; marca em (0,0,0).
 *
 * A mira e travada DENTRO do gol: nao existe chute para fora. Os desfechos
 * possiveis sao apenas 'goal' e 'save'.
 */

import * as THREE from 'three'

export type ShotOutcome = 'goal' | 'save'

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

const GOAL_Z = -11
const GOAL_W = 7.32
const GOAL_H = 2.44
const POST_R = 0.06
const BALL_R = 0.11
const NET_DEPTH = 1.7

const AIM = { minX: -GOAL_W / 2 + 0.45, maxX: GOAL_W / 2 - 0.45, minY: 0.3, maxY: GOAL_H - 0.28 }

const TIMINGS = { runup: 0.78, strike: 0.16, flight: 0.5, aftermath: 1.6 }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
const easeInQuad = (t: number) => t * t
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// ---------------------------------------------------------------------------
// Texturas procedurais (canvas): gramado, rede, bola, placas, fundo, brilho
// ---------------------------------------------------------------------------

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

let rngState = 424242
function rng() {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff
  return rngState / 0x7fffffff
}

/** Gramado 44m x 30m com faixas, linhas, desgaste e granulado. */
function grassTexture(): THREE.CanvasTexture {
  const W = 2048
  const H = 1400
  const [c, ctx] = makeCanvas(W, H)
  // Escala: 44m -> 2048px, 30m -> 1400px. Origem do mundo (0,0) fica em
  // px = W/2, pz: z=-14m -> y0, z=+16m -> yH... mapeamos z de -14 a 16.
  const px = (x: number) => (x / 44 + 0.5) * W
  const pz = (z: number) => ((z + 14) / 30) * H
  const mPerPxX = 44 / W

  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0, '#2a7c3e')
  base.addColorStop(0.5, '#2f8a45')
  base.addColorStop(1, '#2c9243')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  // Faixas de corte perpendiculares ao eixo do chute
  const stripeM = 2.6
  for (let z = -14; z < 16; z += stripeM) {
    if (Math.round((z + 14) / stripeM) % 2 === 0) continue
    const g = ctx.createLinearGradient(0, pz(z), 0, pz(z + stripeM))
    g.addColorStop(0, 'rgba(255,255,235,0.07)')
    g.addColorStop(1, 'rgba(255,255,235,0.015)')
    ctx.fillStyle = g
    ctx.fillRect(0, pz(z), W, pz(z + stripeM) - pz(z))
  }
  // Segundo padrao de corte, colunas
  for (let x = -22; x < 22; x += 4.4) {
    if (Math.round((x + 22) / 4.4) % 2 === 0) continue
    ctx.fillStyle = 'rgba(4,44,18,0.05)'
    ctx.fillRect(px(x), 0, px(x + 4.4) - px(x), H)
  }

  // Linhas oficiais
  const lw = Math.max(2, 0.12 / mPerPxX)
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  // Linha do gol
  line(ctx, px(-22), pz(GOAL_Z), px(22), pz(GOAL_Z))
  // Grande area (16,5m da linha, 40,3m de largura)
  ctx.strokeRect(px(-20.15), pz(GOAL_Z), px(20.15) - px(-20.15), pz(GOAL_Z + 16.5) - pz(GOAL_Z))
  // Pequena area (5,5m, 18,32m)
  ctx.strokeRect(px(-9.16), pz(GOAL_Z), px(9.16) - px(-9.16), pz(GOAL_Z + 5.5) - pz(GOAL_Z))
  // Meia-lua (9,15m da marca, so fora da grande area)
  ctx.beginPath()
  ctx.ellipse(px(0), pz(0), 9.15 / mPerPxX, (9.15 / 30) * H * 0.98, 0, Math.PI * 0.145, Math.PI * 0.855)
  ctx.stroke()
  // Marca do penalti
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.arc(px(0), pz(0), lw * 1.1, 0, Math.PI * 2)
  ctx.fill()

  // Desgaste: boca do gol e marca do penalti
  wearPatch(ctx, px(0), pz(GOAL_Z + 0.4), 5.4 / mPerPxX, 40, 0.2)
  wearPatch(ctx, px(0), pz(0.15), 1.5 / mPerPxX, 34, 0.24)
  for (let i = 0; i < 16; i++) {
    wearPatch(ctx, rng() * W, rng() * H, (0.4 + rng() * 1.1) / mPerPxX, 20, 0.05 + rng() * 0.05)
  }

  // Granulado / fios
  for (let i = 0; i < 22000; i++) {
    const x = rng() * W
    const y = rng() * H
    ctx.fillStyle = rng() > 0.5 ? 'rgba(210,255,210,0.05)' : 'rgba(5,45,18,0.06)'
    ctx.fillRect(x, y, 1.6, rng() * 3 + 1)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function wearPatch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ry: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(116,88,44,${a})`)
  g.addColorStop(0.6, `rgba(116,88,44,${a * 0.45})`)
  g.addColorStop(1, 'rgba(116,88,44,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

/** Bola: branca com gomos escuros. */
function ballTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128)
  ctx.fillStyle = '#f4f6f8'
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = '#1e242c'
  for (let i = 0; i < 14; i++) {
    const x = (i % 7) * 38 + (i > 6 ? 19 : 0) + 10
    const y = i > 6 ? 88 : 30
    ctx.beginPath()
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2
      const px2 = x + Math.cos(a) * 13
      const py2 = y + Math.sin(a) * 13
      k === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2)
    }
    ctx.closePath()
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Placa de publicidade em estilo painel de LED. */
function boardTexture(text: string, color: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 64)
  ctx.fillStyle = '#081020'
  ctx.fillRect(0, 0, 512, 64)
  ctx.strokeStyle = 'rgba(120,180,255,0.25)'
  ctx.strokeRect(1, 1, 510, 62)
  ctx.font = '800 34px "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.fillStyle = color
  ctx.fillText(text, 256, 34)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Fundo: ceu noturno de estadio com brilho dos refletores. */
function skyTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 512)
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, '#050a18')
  g.addColorStop(0.45, '#0c1730')
  g.addColorStop(0.75, '#1a2c52')
  g.addColorStop(1, '#23375f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Sprite radial para brilho de refletor. */
function glowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,250,225,1)')
  g.addColorStop(0.25, 'rgba(255,246,200,0.5)')
  g.addColorStop(1, 'rgba(255,246,200,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

// ---------------------------------------------------------------------------
// Personagens: rig procedural low-poly com articulacoes animaveis
// ---------------------------------------------------------------------------

interface HumanColors {
  shirt: number
  shirtTrim: number
  shorts: number
  socks: number
  sockTrim: number
  skin: number
  hair: number
  boots: number
  gloves?: number
  backNumber?: string
  numberColor?: string
}

interface HumanRig {
  root: THREE.Group
  pelvis: THREE.Group
  torso: THREE.Group
  head: THREE.Group
  hipL: THREE.Group
  hipR: THREE.Group
  kneeL: THREE.Group
  kneeR: THREE.Group
  shoulderL: THREE.Group
  shoulderR: THREE.Group
  elbowL: THREE.Group
  elbowR: THREE.Group
  footL: THREE.Group
  footR: THREE.Group
}

const HIP_H = 0.96
const THIGH_L = 0.44
const SHIN_L = 0.44
const UPPER_ARM_L = 0.3
const FOREARM_L = 0.28

function mat(color: number, rough = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 })
}

function capsule(r: number, len: number, material: THREE.Material): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(r, len, 4, 10)
  const m = new THREE.Mesh(geo, material)
  m.castShadow = true
  return m
}

/**
 * Constroi um humanoide articulado. Cada articulacao e um Group cuja rotacao
 * anima o membro; as malhas pendem para -Y a partir da articulacao.
 */
function buildHuman(colors: HumanColors): HumanRig {
  const root = new THREE.Group()
  const skinM = mat(colors.skin, 0.6)
  const shirtM = mat(colors.shirt)
  const shortsM = mat(colors.shorts)
  const socksM = mat(colors.socks)
  const bootsM = mat(colors.boots, 0.4)
  const hairM = mat(colors.hair, 0.85)

  const pelvis = new THREE.Group()
  pelvis.position.y = HIP_H
  root.add(pelvis)

  // Calcao (pelvis)
  const shortsMesh = capsule(0.155, 0.16, shortsM)
  shortsMesh.scale.set(1.35, 1, 0.95)
  shortsMesh.position.y = -0.02
  pelvis.add(shortsMesh)

  // Tronco
  const torso = new THREE.Group()
  torso.position.y = 0.08
  pelvis.add(torso)
  const chest = capsule(0.16, 0.34, shirtM)
  chest.scale.set(1.35, 1, 0.88)
  chest.position.y = 0.36
  torso.add(chest)

  // Numero nas costas
  if (colors.backNumber) {
    const [nc, nctx] = makeCanvas(128, 128)
    nctx.font = '800 92px "Segoe UI", sans-serif'
    nctx.textAlign = 'center'
    nctx.textBaseline = 'middle'
    nctx.lineWidth = 12
    nctx.strokeStyle = 'rgba(255,255,255,0.9)'
    nctx.strokeText(colors.backNumber, 64, 70)
    nctx.fillStyle = colors.numberColor ?? '#12326e'
    nctx.fillText(colors.backNumber, 64, 70)
    const ntex = new THREE.CanvasTexture(nc)
    ntex.colorSpace = THREE.SRGBColorSpace
    const nmesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.26),
      new THREE.MeshBasicMaterial({ map: ntex, transparent: true })
    )
    nmesh.position.set(0, 0.4, 0.175)
    torso.add(nmesh)
  }

  // Cabeca
  const head = new THREE.Group()
  head.position.y = 0.62
  torso.add(head)
  const neck = capsule(0.055, 0.06, skinM)
  neck.position.y = 0.02
  head.add(neck)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skinM)
  skull.scale.set(0.92, 1.05, 0.98)
  skull.position.y = 0.16
  skull.castShadow = true
  head.add(skull)
  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairM
  )
  hairMesh.scale.set(0.95, 1.05, 1.0)
  hairMesh.position.set(0, 0.17, 0.012)
  head.add(hairMesh)

  // Bracos
  const mkArm = (side: number) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.245, 0.56, 0)
    torso.add(shoulder)
    const sleeve = capsule(0.062, UPPER_ARM_L * 0.62, shirtM)
    sleeve.position.y = -UPPER_ARM_L * 0.36
    shoulder.add(sleeve)
    const upperSkin = capsule(0.05, UPPER_ARM_L * 0.3, skinM)
    upperSkin.position.y = -UPPER_ARM_L * 0.82
    shoulder.add(upperSkin)
    const elbow = new THREE.Group()
    elbow.position.y = -UPPER_ARM_L
    shoulder.add(elbow)
    const fore = capsule(0.042, FOREARM_L * 0.8, skinM)
    fore.position.y = -FOREARM_L * 0.5
    elbow.add(fore)
    const handR = colors.gloves ? 0.075 : 0.05
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(handR, 10, 8),
      colors.gloves ? mat(colors.gloves, 0.5) : skinM
    )
    hand.position.y = -FOREARM_L - handR * 0.4
    hand.castShadow = true
    elbow.add(hand)
    return { shoulder, elbow }
  }
  const armL = mkArm(-1)
  const armR = mkArm(1)

  // Pernas
  const mkLeg = (side: number) => {
    const hip = new THREE.Group()
    hip.position.set(side * 0.115, -0.04, 0)
    pelvis.add(hip)
    const thigh = capsule(0.077, THIGH_L * 0.72, skinM)
    thigh.position.y = -THIGH_L * 0.5
    hip.add(thigh)
    const knee = new THREE.Group()
    knee.position.y = -THIGH_L
    hip.add(knee)
    const calf = capsule(0.06, SHIN_L * 0.34, skinM)
    calf.position.y = -SHIN_L * 0.22
    knee.add(calf)
    const sockMesh = capsule(0.056, SHIN_L * 0.4, socksM)
    sockMesh.position.y = -SHIN_L * 0.66
    knee.add(sockMesh)
    const cuff = capsule(0.06, 0.02, mat(colors.sockTrim))
    cuff.position.y = -SHIN_L * 0.42
    knee.add(cuff)
    const foot = new THREE.Group()
    foot.position.y = -SHIN_L
    knee.add(foot)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.24), bootsM)
    boot.position.set(0, -0.035, -0.055)
    boot.castShadow = true
    foot.add(boot)
    return { hip, knee, foot }
  }
  const legL = mkLeg(-1)
  const legR = mkLeg(1)

  return {
    root,
    pelvis,
    torso,
    head,
    hipL: legL.hip,
    hipR: legR.hip,
    kneeL: legL.knee,
    kneeR: legR.knee,
    footL: legL.foot,
    footR: legR.foot,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    elbowL: armL.elbow,
    elbowR: armR.elbow
  }
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

export class Penalty3D {
  private canvas: HTMLCanvasElement
  private cb: EngineCallbacks
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private raf = 0
  private destroyed = false
  private clock = new THREE.Clock()
  private now = 0

  state: EngineState = 'ready'
  private stateStart = 0
  private interactive = true

  private kicker!: HumanRig
  private keeper!: HumanRig
  private ball!: THREE.Mesh
  private ballShadow!: THREE.Mesh
  private reticle!: THREE.Group
  private netBack!: THREE.LineSegments
  private netBase!: Float32Array

  private crowdFront!: THREE.InstancedMesh
  private crowdHeads!: THREE.InstancedMesh
  private crowdData: { x: number; y: number; z: number; s: number; phase: number }[] = []
  private crowdExcite = 0

  private confetti!: THREE.Points
  private confettiVel: Float32Array | null = null
  private confettiOn = false

  private aim = new THREE.Vector2(0, 1.2)
  private hasAim = false
  private pointerDown = false
  private raycaster = new THREE.Raycaster()
  private goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_Z)

  private shotTarget = new THREE.Vector3()
  private outcome: ShotOutcome = 'goal'
  private diveTarget = new THREE.Vector3()
  private diveDir = 1
  private savePoint = new THREE.Vector3()
  private deflect = new THREE.Vector3()
  private ripple: { x: number; y: number; t: number } | null = null
  private shake = 0
  private shakeT = 0
  private resultSent = false

  private baseCamPos = new THREE.Vector3()
  private baseLook = new THREE.Vector3(0, 1.15, GOAL_Z)
  private resizeObs: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas
    this.cb = callbacks

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.camera = new THREE.PerspectiveCamera(56, 1, 0.1, 120)
    this.scene.background = skyTexture()
    this.scene.fog = new THREE.Fog(0x0a1424, 30, 90)

    this.buildLights()
    this.buildPitch()
    this.buildGoal()
    this.buildStands()
    this.buildCharacters()
    this.buildBall()
    this.buildReticle()
    this.buildConfetti()

    this.handleResize()
    this.resizeObs = new ResizeObserver(() => this.handleResize())
    this.resizeObs.observe(canvas.parentElement ?? canvas)

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)

    this.stateStart = 0
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.resizeObs?.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    this.renderer.dispose()
  }

  setInteractive(v: boolean) {
    this.interactive = v
  }

  reset() {
    this.setState('ready')
    this.hasAim = false
    this.pointerDown = false
    this.resultSent = false
    this.ripple = null
    this.crowdExcite = 0
    this.confettiOn = false
    if (this.confetti) this.confetti.visible = false
    this.ball.position.set(0, BALL_R, 0)
    this.ball.rotation.set(0, 0, 0)
    this.kicker.root.position.set(-0.85, 0, 1.7)
    this.kicker.root.rotation.set(0, 0, 0)
    this.keeper.root.position.set(0, 0, GOAL_Z + 0.25)
    this.keeper.root.rotation.set(0, 0, 0)
    this.restoreNet()
  }

  // ------------------------------ cena ------------------------------

  private buildLights() {
    const hemi = new THREE.HemisphereLight(0xbdd3ff, 0x1c4a26, 0.75)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xfff4d8, 1.9)
    key.position.set(8, 16, 6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -12
    key.shadow.camera.right = 12
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -14
    key.shadow.camera.far = 45
    key.shadow.bias = -0.0015
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35)
    fill.position.set(-9, 10, -4)
    this.scene.add(fill)

    // Brilhos dos refletores
    const glowTex = glowTexture()
    for (const x of [-14, -5, 5, 14]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }))
      s.position.set(x, 12.4, GOAL_Z - 7.5)
      s.scale.set(4.6, 4.6, 1)
      this.scene.add(s)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6), mat(0x36404f, 0.5))
      pole.position.set(x, 9.4, GOAL_Z - 7.6)
      this.scene.add(pole)
    }
  }

  private buildPitch() {
    const tex = grassTexture()
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 30),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, 0, 1) // cobre z de -14 a +16
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  private buildGoal() {
    const postM = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.35, metalness: 0.15 })
    const mk = (geo: THREE.CylinderGeometry, x: number, y: number, z: number, rz = 0, rx = 0) => {
      const m = new THREE.Mesh(geo, postM)
      m.position.set(x, y, z)
      m.rotation.z = rz
      m.rotation.x = rx
      m.castShadow = true
      this.scene.add(m)
      return m
    }
    const postGeo = new THREE.CylinderGeometry(POST_R, POST_R, GOAL_H + POST_R, 12)
    mk(postGeo, -GOAL_W / 2, GOAL_H / 2, GOAL_Z)
    mk(postGeo, GOAL_W / 2, GOAL_H / 2, GOAL_Z)
    const barGeo = new THREE.CylinderGeometry(POST_R, POST_R, GOAL_W + POST_R * 2, 12)
    mk(barGeo, 0, GOAL_H, GOAL_Z, Math.PI / 2)
    // Suportes traseiros
    const backGeo = new THREE.CylinderGeometry(0.035, 0.035, NET_DEPTH * 1.25, 8)
    mk(backGeo, -GOAL_W / 2, GOAL_H * 0.5, GOAL_Z - NET_DEPTH * 0.55, 0, Math.PI / 2.6)
    mk(backGeo, GOAL_W / 2, GOAL_H * 0.5, GOAL_Z - NET_DEPTH * 0.55, 0, Math.PI / 2.6)

    // Rede traseira (grade de linhas, deformavel)
    const cols = 26
    const rows = 12
    const pts: number[] = []
    const grid: THREE.Vector3[][] = []
    for (let r = 0; r <= rows; r++) {
      grid.push([])
      for (let cIdx = 0; cIdx <= cols; cIdx++) {
        const x = lerp(-GOAL_W / 2, GOAL_W / 2, cIdx / cols)
        const y = lerp(0.02, GOAL_H, r / rows)
        // A rede pende para tras, com barriga
        const sag = Math.sin((cIdx / cols) * Math.PI) * 0.12
        const z = GOAL_Z - lerp(NET_DEPTH, NET_DEPTH * 0.45, r / rows) - sag * (1 - r / rows)
        grid[r]!.push(new THREE.Vector3(x, y, z))
      }
    }
    for (let r = 0; r <= rows; r++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        pts.push(...grid[r]![cIdx]!.toArray(), ...grid[r]![cIdx + 1]!.toArray())
      }
    }
    for (let cIdx = 0; cIdx <= cols; cIdx++) {
      for (let r = 0; r < rows; r++) {
        pts.push(...grid[r]![cIdx]!.toArray(), ...grid[r + 1]![cIdx]!.toArray())
      }
    }
    const netGeo = new THREE.BufferGeometry()
    netGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const netM = new THREE.LineBasicMaterial({ color: 0xdfe7f0, transparent: true, opacity: 0.5 })
    this.netBack = new THREE.LineSegments(netGeo, netM)
    this.scene.add(this.netBack)
    this.netBase = new Float32Array(pts)

    // Redes laterais e teto (estaticas)
    const sidePts: number[] = []
    for (const side of [-1, 1]) {
      const x = (side * GOAL_W) / 2
      for (let i = 0; i <= 8; i++) {
        const y = lerp(0.02, GOAL_H, i / 8)
        sidePts.push(x, y, GOAL_Z, x, y * 0.55 + 0.02, GOAL_Z - lerp(NET_DEPTH, NET_DEPTH * 0.45, i / 8))
      }
      for (let i = 0; i <= 6; i++) {
        const z = GOAL_Z - (i / 6) * NET_DEPTH
        sidePts.push(x, 0.02, z, x, GOAL_H * (1 - (i / 6) * 0.5), GOAL_Z - (i / 6) * NET_DEPTH * 0.9)
      }
    }
    for (let i = 0; i <= 14; i++) {
      const x = lerp(-GOAL_W / 2, GOAL_W / 2, i / 14)
      sidePts.push(x, GOAL_H, GOAL_Z, x, GOAL_H * 0.55, GOAL_Z - NET_DEPTH * 0.5)
    }
    const sideGeo = new THREE.BufferGeometry()
    sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePts, 3))
    this.scene.add(new THREE.LineSegments(sideGeo, new THREE.LineBasicMaterial({ color: 0xdfe7f0, transparent: true, opacity: 0.35 })))
  }

  private buildStands() {
    // Placas de publicidade
    const colors = ['#41d6ff', '#ffd23f', '#8dff5a', '#ffd23f', '#41d6ff', '#8dff5a']
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(7.4, 0.95, 0.12),
        [
          mat(0x081020), mat(0x081020), mat(0x081020), mat(0x081020),
          new THREE.MeshBasicMaterial({ map: boardTexture('PREMIADO', colors[i]!) }),
          mat(0x081020)
        ]
      )
      b.position.set((i - 2.5) * 7.55, 0.48, GOAL_Z - 3.4)
      this.scene.add(b)
    }

    // Arquibancada: tres aneis atras do gol
    const standM = mat(0x232c3f, 0.9)
    const tiers = [
      { z: GOAL_Z - 6.5, y0: 1.1, rows: 7 },
      { z: GOAL_Z - 12.5, y0: 4.6, rows: 8 },
      { z: GOAL_Z - 19, y0: 9.2, rows: 8 }
    ]
    const seatRise = 0.46
    const seatDepth = 0.82

    const bodies: { x: number; y: number; z: number; s: number; c: THREE.Color }[] = []
    const palette = [0xd8433b, 0xe0e4ea, 0x2e5fa3, 0xe8b13f, 0x43955f, 0x8a4fa0, 0xd97941, 0x3fa3a0, 0xa33b52, 0x5577c9]

    for (const tier of tiers) {
      const width = 52
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, tier.rows * seatRise, tier.rows * seatDepth), standM)
      slab.rotation.x = Math.atan2(seatRise, seatDepth)
      slab.position.set(0, tier.y0 + (tier.rows * seatRise) / 2 - 0.4, tier.z - (tier.rows * seatDepth) / 2)
      this.scene.add(slab)

      for (let r = 0; r < tier.rows; r++) {
        const y = tier.y0 + r * seatRise
        const z = tier.z - r * seatDepth
        for (let x = -width / 2 + 0.5; x < width / 2; x += 0.62) {
          if (rng() < 0.12) continue
          const section = Math.floor((x + width / 2) / (width / 9))
          const secColor = section % 3 === 0 ? 0xe8b13f : section % 3 === 2 ? 0x2e5fa3 : null
          const color = new THREE.Color(secColor !== null && rng() < 0.55 ? secColor : palette[Math.floor(rng() * palette.length)]!)
          bodies.push({ x: x + (rng() - 0.5) * 0.3, y, z: z + (rng() - 0.5) * 0.2, s: 0.85 + rng() * 0.35, phase: rng() * Math.PI * 2 } as never)
          ;(bodies[bodies.length - 1] as never as { c: THREE.Color }).c = color
        }
      }
    }

    const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.36, 3, 6)
    const headGeo = new THREE.SphereGeometry(0.11, 6, 5)
    const bodyM = new THREE.MeshLambertMaterial()
    const headM = new THREE.MeshLambertMaterial(({ color: 0xc9a07a } as never))
    this.crowdFront = new THREE.InstancedMesh(bodyGeo, bodyM, bodies.length)
    this.crowdHeads = new THREE.InstancedMesh(headGeo, headM, bodies.length)
    const m4 = new THREE.Matrix4()
    bodies.forEach((b, i) => {
      m4.makeScale(b.s, b.s, b.s)
      m4.setPosition(b.x, b.y + 0.35 * b.s, b.z)
      this.crowdFront.setMatrixAt(i, m4)
      this.crowdFront.setColorAt(i, (b as never as { c: THREE.Color }).c)
      m4.makeScale(b.s, b.s, b.s)
      m4.setPosition(b.x, b.y + 0.72 * b.s, b.z)
      this.crowdHeads.setMatrixAt(i, m4)
      this.crowdData.push({ x: b.x, y: b.y, z: b.z, s: b.s, phase: (b as never as { phase: number }).phase })
    })
    this.crowdFront.instanceMatrix.needsUpdate = true
    this.crowdHeads.instanceMatrix.needsUpdate = true
    this.scene.add(this.crowdFront, this.crowdHeads)

    // Cobertura
    const roof = new THREE.Mesh(new THREE.BoxGeometry(56, 0.5, 9), mat(0x0d1526, 0.9))
    roof.position.set(0, 14.6, GOAL_Z - 17)
    roof.rotation.x = 0.16
    this.scene.add(roof)
  }

  private buildCharacters() {
    this.kicker = buildHuman({
      shirt: 0xffd23f,
      shirtTrim: 0x127a45,
      shorts: 0x1f4fd0,
      socks: 0x1f4fd0,
      sockTrim: 0xffd23f,
      skin: 0x8a5a3b,
      hair: 0x241509,
      boots: 0x15181f,
      backNumber: '9'
    })
    this.kicker.root.position.set(-0.85, 0, 1.7)
    this.scene.add(this.kicker.root)

    this.keeper = buildHuman({
      shirt: 0x17181d,
      shirtTrim: 0x8dff5a,
      shorts: 0x101116,
      socks: 0x101116,
      sockTrim: 0x3d7a22,
      skin: 0xc98e63,
      hair: 0x1c1108,
      boots: 0x0a0a0d,
      gloves: 0x8dff5a,
      backNumber: '1',
      numberColor: '#8dff5a'
    })
    this.keeper.root.position.set(0, 0, GOAL_Z + 0.25)
    this.scene.add(this.keeper.root)
  }

  private buildBall() {
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 20, 16),
      new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 })
    )
    this.ball.castShadow = true
    this.ball.position.set(0, BALL_R, 0)
    this.scene.add(this.ball)

    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 1.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x03140a, transparent: true, opacity: 0.4, depthWrite: false })
    )
    sh.rotation.x = -Math.PI / 2
    sh.position.set(0, 0.012, 0)
    this.ballShadow = sh
    this.scene.add(sh)
  }

  private buildReticle() {
    this.reticle = new THREE.Group()
    const ringM = new THREE.MeshBasicMaterial({ color: 0x8dff5a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), ringM)
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.14, 24), ringM)
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), ringM)
    this.reticle.add(ring, inner, dot)
    this.reticle.position.set(0, 1.2, GOAL_Z + 0.1)
    this.reticle.visible = false
    this.reticle.renderOrder = 20
    this.scene.add(this.reticle)
  }

  private buildConfetti() {
    const N = 420
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    this.confettiVel = new Float32Array(N * 3)
    const colors = [0xffd23f, 0x3fa9f5, 0xff5d5d, 0x5dff8f, 0xff8ff3, 0xfff7d6]
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rng() - 0.5) * 30
      pos[i * 3 + 1] = 5 + rng() * 9
      pos[i * 3 + 2] = GOAL_Z - 4 - rng() * 10
      this.confettiVel![i * 3] = (rng() - 0.5) * 1.4
      this.confettiVel![i * 3 + 1] = 0.6 + rng() * 1.2
      this.confettiVel![i * 3 + 2] = (rng() - 0.5) * 0.8
      c.setHex(colors[Math.floor(rng() * colors.length)]!)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    this.confetti = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.95 }))
    this.confetti.visible = false
    this.scene.add(this.confetti)
  }

  // ------------------------------ camera ------------------------------

  private handleResize() {
    const parent = this.canvas.parentElement
    const w = parent?.clientWidth ?? window.innerWidth
    const h = parent?.clientHeight ?? window.innerHeight
    const dpr = clamp(window.devicePixelRatio || 1, 1, 1.9)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    // Distancia para o gol ocupar ~78% da largura da tela
    const vFov = (this.camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect)
    let dist = GOAL_W / 2 / (0.39 * Math.tan(hFov / 2))
    dist = clamp(dist, 13.4, 26)
    this.baseCamPos.set(0.35, this.camera.aspect < 1 ? 2.15 : 1.85, GOAL_Z + dist)
    this.camera.position.copy(this.baseCamPos)
    this.camera.lookAt(this.baseLook)
  }

  // ------------------------------ entrada ------------------------------

  private pickAim(e: PointerEvent): THREE.Vector2 | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.goalPlane, hit)) return null
    // Mira SEMPRE dentro do gol
    return new THREE.Vector2(clamp(hit.x, AIM.minX, AIM.maxX), clamp(hit.y, AIM.minY, AIM.maxY))
  }

  private onDown = (e: PointerEvent) => {
    if (!this.interactive) return
    if (this.state !== 'ready' && this.state !== 'aiming') return
    const a = this.pickAim(e)
    if (!a) return
    this.pointerDown = true
    this.aim.copy(a)
    this.hasAim = true
    this.setState('aiming')
  }

  private onMove = (e: PointerEvent) => {
    if (!this.pointerDown || this.state !== 'aiming') return
    const a = this.pickAim(e)
    if (a) this.aim.copy(a)
  }

  private onUp = () => {
    if (!this.pointerDown) return
    this.pointerDown = false
    if (this.state === 'aiming' && this.hasAim) this.shoot()
  }

  // ------------------------------ jogo ------------------------------

  private shoot() {
    this.shotTarget.set(this.aim.x, this.aim.y, GOAL_Z)

    // Goleiro: escolhe canto com vies para o lado certo
    const colsX = [-GOAL_W * 0.31, 0, GOAL_W * 0.31]
    const rowsY = [0.7, GOAL_H * 0.72]
    const tCol = this.aim.x < -GOAL_W * 0.12 ? 0 : this.aim.x > GOAL_W * 0.12 ? 2 : 1
    const tRow = this.aim.y > GOAL_H * 0.5 ? 1 : 0
    let col: number
    if (Math.random() < 0.58) col = tCol
    else {
      const others = [0, 1, 2].filter((v) => v !== tCol)
      col = others[Math.floor(Math.random() * others.length)]!
    }
    const row = Math.random() < (col === tCol ? 0.6 : 0.5) ? tRow : 1 - tRow
    this.diveTarget.set(colsX[col]!, rowsY[row]!, GOAL_Z + 0.2)
    this.diveDir = Math.sign(this.diveTarget.x - 0) || (Math.random() < 0.5 ? -1 : 1)

    const reach = 0.92
    const dist = Math.hypot(this.diveTarget.x - this.aim.x, this.diveTarget.y - this.aim.y)
    this.outcome = dist < reach ? 'save' : 'goal'
    if (this.outcome === 'save') {
      this.savePoint.set(
        lerp(this.diveTarget.x, this.aim.x, 0.5),
        lerp(this.diveTarget.y, this.aim.y, 0.5),
        GOAL_Z + 0.3
      )
      const outX = this.savePoint.x < 0 ? -GOAL_W * 0.75 : GOAL_W * 0.75
      this.deflect.set(outX, 0.12, GOAL_Z + 2.6)
    }

    this.hasAim = false
    this.setState('runup')
  }

  private setState(s: EngineState) {
    this.state = s
    this.stateStart = this.now
    this.cb.onStateChange?.(s)
  }

  private stateT() {
    return this.now - this.stateStart
  }

  // ------------------------------ loop ------------------------------

  private frame = () => {
    if (this.destroyed) return
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.now += dt
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.frame)
  }

  private update(dt: number) {
    const t = this.stateT()

    switch (this.state) {
      case 'runup':
        if (t >= TIMINGS.runup) this.setState('strike')
        break
      case 'strike':
        if (t >= TIMINGS.strike) {
          this.cb.onKick?.()
          this.setState('flight')
        }
        break
      case 'flight': {
        const ft = clamp(t / TIMINGS.flight, 0, 1)
        const p = easeOutQuad(ft)
        const end = this.outcome === 'save' ? this.savePoint : this.shotTarget
        this.ball.position.x = lerp(0, end.x, p)
        this.ball.position.z = lerp(0, end.z, p)
        const arc = Math.max(0.25, 0.75 - end.y * 0.18)
        this.ball.position.y = lerp(BALL_R, end.y, p) + Math.sin(Math.PI * ft) * arc
        this.ball.rotation.x -= dt * 22
        if (ft >= 1) {
          this.onArrive()
          this.setState('aftermath')
        }
        break
      }
      case 'aftermath': {
        this.updateAftermath(t, dt)
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

    this.animateKicker(t)
    this.animateKeeper(t)
    this.updateNet(dt)
    this.updateCrowd(dt)
    this.updateConfetti(dt)
    this.updateReticle()
    this.updateBallShadow()
    this.updateCamera(dt)
  }

  private onArrive() {
    this.shakeT = this.now
    this.cb.onImpact?.(this.outcome)
    if (this.outcome === 'goal') {
      this.shake = 0.05
      this.ripple = { x: this.shotTarget.x, y: this.shotTarget.y, t: this.now }
      this.crowdExcite = 1
      this.confettiOn = true
      this.confetti.visible = true
    } else {
      this.shake = 0.035
    }
  }

  private updateAftermath(t: number, dt: number) {
    if (this.outcome === 'goal') {
      // Bola afunda na rede e cai
      const sink = clamp(t / 0.22, 0, 1)
      const drop = clamp((t - 0.28) / 0.9, 0, 1)
      this.ball.position.z = GOAL_Z - easeOutQuad(sink) * (NET_DEPTH * 0.55)
      this.ball.position.y = lerp(this.shotTarget.y, BALL_R, easeInQuad(drop))
      this.ball.position.x = this.shotTarget.x
    } else {
      // Rebote da defesa
      const p = clamp(t / 0.7, 0, 1)
      const e = easeOutQuad(p)
      this.ball.position.x = lerp(this.savePoint.x, this.deflect.x, e)
      this.ball.position.z = lerp(this.savePoint.z, this.deflect.z, e)
      this.ball.position.y = Math.max(BALL_R, lerp(this.savePoint.y, BALL_R, e) + Math.sin(Math.PI * p) * 0.5)
      this.ball.rotation.x -= dt * 10
    }
  }

  // --------------------------- animacoes ---------------------------

  private poseIdleKicker() {
    const k = this.kicker
    const b = Math.sin(this.now * 1.8) * 0.02
    k.root.position.set(-0.85, 0, 1.7)
    k.root.rotation.y = -0.08
    k.pelvis.position.y = HIP_H + b
    k.torso.rotation.x = 0.05
    k.head.rotation.x = -0.06
    k.hipL.rotation.set(-0.04, 0, 0.03)
    k.hipR.rotation.set(-0.04, 0, -0.03)
    k.kneeL.rotation.x = 0.08
    k.kneeR.rotation.x = 0.08
    k.footL.rotation.x = -0.04
    k.footR.rotation.x = -0.04
    k.shoulderL.rotation.set(0.06 + b, 0, 0.12)
    k.shoulderR.rotation.set(0.06 - b, 0, -0.12)
    k.elbowL.rotation.x = -0.25
    k.elbowR.rotation.x = -0.25
  }

  private animateKicker(t: number) {
    const k = this.kicker
    if (this.state === 'ready' || this.state === 'aiming') {
      this.poseIdleKicker()
      return
    }

    if (this.state === 'runup') {
      const p = clamp(t / TIMINGS.runup, 0, 1)
      const eased = easeInQuad(p)
      // Trajetoria da corrida ate o pe de apoio ao lado da bola
      k.root.position.x = lerp(-0.85, -0.24, eased)
      k.root.position.z = lerp(1.7, 0.32, eased)
      k.root.rotation.y = lerp(-0.08, 0.06, p)
      const phase = p * Math.PI * 2 * 2.6
      const s = Math.sin(phase)
      const c = Math.cos(phase)
      k.pelvis.position.y = HIP_H - 0.03 + Math.abs(c) * 0.045
      k.torso.rotation.x = 0.24
      k.head.rotation.x = -0.18
      k.hipL.rotation.x = s * 0.75
      k.hipR.rotation.x = -s * 0.75
      k.kneeL.rotation.x = Math.max(0, -s) * 1.5 + 0.15
      k.kneeR.rotation.x = Math.max(0, s) * 1.5 + 0.15
      k.footL.rotation.x = -0.1
      k.footR.rotation.x = -0.1
      k.shoulderL.rotation.set(-s * 0.85, 0, 0.16)
      k.shoulderR.rotation.set(s * 0.85, 0, -0.16)
      k.elbowL.rotation.x = -1.35
      k.elbowR.rotation.x = -1.35
      return
    }

    // strike + flight/aftermath: balanco do chute e follow-through
    let p: number
    if (this.state === 'strike') p = clamp(t / TIMINGS.strike, 0, 1) * 0.62
    else p = 0.62 + Math.min(0.38, this.stateT() * 2.2)

    k.root.position.set(-0.24, 0, 0.32)
    k.root.rotation.y = 0.06

    if (p < 0.62) {
      // Armar a perna atras
      const q = p / 0.62
      k.hipR.rotation.x = lerp(0.2, 1.15, q)
      k.kneeR.rotation.x = lerp(0.3, 1.7, q)
      k.torso.rotation.x = lerp(0.24, 0.06, q)
      k.shoulderL.rotation.x = lerp(-0.3, -1.15, q)
      k.shoulderL.rotation.z = 0.45
      k.shoulderR.rotation.x = lerp(0.3, 0.75, q)
      k.shoulderR.rotation.z = -0.3
    } else {
      // Chicote: perna cruza para frente estendida
      const q = (p - 0.62) / 0.38
      const e = easeOutCubic(q)
      k.hipR.rotation.x = lerp(1.15, -1.25, e)
      k.kneeR.rotation.x = lerp(1.7, 0.12, e)
      k.torso.rotation.x = lerp(0.06, 0.3, e)
      k.head.rotation.x = lerp(-0.1, -0.24, e)
      k.shoulderL.rotation.x = lerp(-1.15, -0.5, e)
      k.shoulderL.rotation.z = lerp(0.45, 0.9, e)
      k.shoulderR.rotation.x = lerp(0.75, 0.4, e)
      k.shoulderR.rotation.z = lerp(-0.3, -0.55, e)
    }
    k.footR.rotation.x = 0.55
    k.pelvis.position.y = HIP_H - 0.05
    k.hipL.rotation.x = -0.12
    k.kneeL.rotation.x = 0.28
    k.elbowL.rotation.x = -0.4
    k.elbowR.rotation.x = -0.5
  }

  private animateKeeper(t: number) {
    const g = this.keeper
    const diving = this.state === 'flight' || this.state === 'aftermath' || this.state === 'done'

    if (!diving) {
      // Espera: agachado, balanco lateral, bracos prontos
      const sway = Math.sin(this.now * 2.1)
      g.root.position.set(sway * 0.22, 0, GOAL_Z + 0.25)
      g.root.rotation.set(0, 0, 0)
      g.pelvis.position.y = HIP_H - 0.18
      g.pelvis.rotation.x = 0.22
      g.torso.rotation.x = 0.18
      g.head.rotation.x = -0.32
      g.hipL.rotation.set(-0.55, 0, 0.16)
      g.hipR.rotation.set(-0.55, 0, -0.16)
      g.kneeL.rotation.x = 0.95
      g.kneeR.rotation.x = 0.95
      g.footL.rotation.x = -0.4
      g.footR.rotation.x = -0.4
      g.shoulderL.rotation.set(-0.5, 0, 0.85)
      g.shoulderR.rotation.set(-0.5, 0, -0.85)
      g.elbowL.rotation.x = -0.75
      g.elbowR.rotation.x = -0.75
      return
    }

    // Mergulho
    let p: number
    if (this.state === 'flight') p = clamp(this.stateT() / (TIMINGS.flight * 0.95), 0, 1)
    else p = 1
    const e = easeOutQuad(p)
    const dir = Math.sign(this.diveTarget.x) || this.diveDir
    const targetX = this.outcome === 'save' ? this.savePoint.x : this.diveTarget.x
    const targetY = this.outcome === 'save' ? this.savePoint.y : this.diveTarget.y

    g.root.position.x = lerp(0, targetX * 0.72, e)
    g.root.position.y = Math.sin(e * Math.PI) * Math.max(0.15, targetY * 0.4) - e * 0.42
    g.root.position.z = GOAL_Z + 0.25
    g.root.rotation.z = -dir * e * (targetY > 1.1 ? 1.15 : 1.45)
    g.pelvis.position.y = HIP_H - 0.18
    g.pelvis.rotation.x = 0.1
    g.torso.rotation.x = 0.05
    // Bracos esticados na direcao da bola
    g.shoulderL.rotation.set(-1.2 * e - 0.4, 0, lerp(0.85, dir < 0 ? 1.5 : 0.2, e))
    g.shoulderR.rotation.set(-1.2 * e - 0.4, 0, lerp(-0.85, dir > 0 ? -1.5 : -0.2, e))
    g.elbowL.rotation.x = -0.15
    g.elbowR.rotation.x = -0.15
    // Pernas juntas esticadas
    g.hipL.rotation.set(lerp(-0.55, -0.15, e), 0, 0.08)
    g.hipR.rotation.set(lerp(-0.55, -0.1, e), 0, -0.08)
    g.kneeL.rotation.x = lerp(0.95, 0.25, e)
    g.kneeR.rotation.x = lerp(0.95, 0.2, e)
  }

  // --------------------------- efeitos ---------------------------

  private restoreNet() {
    const pos = this.netBack.geometry.getAttribute('position') as THREE.BufferAttribute
    ;(pos.array as Float32Array).set(this.netBase)
    pos.needsUpdate = true
  }

  private updateNet(_dt: number) {
    if (!this.ripple) return
    const age = this.now - this.ripple.t
    if (age > 1.3) {
      this.restoreNet()
      this.ripple = null
      return
    }
    const pos = this.netBack.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let i = 0; i < arr.length; i += 3) {
      const bx = this.netBase[i]!
      const by = this.netBase[i + 1]!
      const bz = this.netBase[i + 2]!
      const d = Math.hypot(bx - this.ripple.x, by - this.ripple.y)
      const w = Math.exp(-d * 1.6) * Math.exp(-age * 3) * Math.sin(d * 9 - age * 30) * 0.34
      arr[i] = bx
      arr[i + 1] = by
      arr[i + 2] = bz - w
    }
    pos.needsUpdate = true
  }

  private updateCrowd(dt: number) {
    if (this.crowdExcite <= 0) return
    if (this.state === 'done') this.crowdExcite = Math.max(0, this.crowdExcite - dt * 0.5)
    const m4 = new THREE.Matrix4()
    const n = this.crowdData.length
    for (let i = 0; i < n; i++) {
      const d = this.crowdData[i]!
      const jump = Math.max(0, Math.sin(this.now * 9 + d.phase)) * 0.3 * this.crowdExcite
      m4.makeScale(d.s, d.s, d.s)
      m4.setPosition(d.x, d.y + 0.35 * d.s + jump, d.z)
      this.crowdFront.setMatrixAt(i, m4)
      m4.setPosition(d.x, d.y + 0.72 * d.s + jump, d.z)
      this.crowdHeads.setMatrixAt(i, m4)
    }
    this.crowdFront.instanceMatrix.needsUpdate = true
    this.crowdHeads.instanceMatrix.needsUpdate = true
  }

  private updateConfetti(dt: number) {
    if (!this.confettiOn) return
    const pos = this.confetti.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const vel = this.confettiVel!
    for (let i = 0; i < arr.length; i += 3) {
      vel[i + 1] = vel[i + 1]! - dt * 1.6
      arr[i] = arr[i]! + vel[i]! * dt + Math.sin(this.now * 4 + i) * dt * 0.4
      arr[i + 1] = Math.max(0.2, arr[i + 1]! + vel[i + 1]! * dt)
      arr[i + 2] = arr[i + 2]! + vel[i + 2]! * dt
    }
    pos.needsUpdate = true
  }

  private updateReticle() {
    const visible = this.state === 'aiming' && this.hasAim
    this.reticle.visible = visible
    if (!visible) return
    this.reticle.position.set(this.aim.x, this.aim.y, GOAL_Z + 0.12)
    const pulse = 1 + Math.sin(this.now * 7) * 0.07
    this.reticle.scale.setScalar(pulse)
  }

  private updateBallShadow() {
    this.ballShadow.position.x = this.ball.position.x
    this.ballShadow.position.z = Math.max(GOAL_Z - 0.4, this.ball.position.z)
    const h = clamp(this.ball.position.y / 2.4, 0, 1)
    ;(this.ballShadow.material as THREE.MeshBasicMaterial).opacity = lerp(0.42, 0.1, h)
    this.ballShadow.scale.setScalar(lerp(1, 1.9, h))
  }

  private updateCamera(_dt: number) {
    const pos = this.baseCamPos.clone()
    const look = this.baseLook.clone()

    if (this.state === 'flight') {
      const ft = clamp(this.stateT() / TIMINGS.flight, 0, 1)
      pos.z -= ft * 0.9
      look.lerp(this.ball.position, 0.35 * ft)
    } else if (this.state === 'aftermath' || this.state === 'done') {
      const back = this.state === 'done' ? 1 : clamp(this.stateT() / 1.1, 0, 1)
      pos.z -= (1 - back) * 0.9
      look.lerp(this.ball.position, 0.35 * (1 - back))
    }

    // Chacoalhar no impacto
    if (this.shake > 0) {
      const st = this.now - this.shakeT
      const decay = Math.max(0, 1 - st / 0.5)
      if (decay > 0) {
        pos.x += Math.sin(st * 55) * this.shake * decay
        pos.y += Math.cos(st * 47) * this.shake * decay * 0.6
      } else {
        this.shake = 0
      }
    }

    this.camera.position.copy(pos)
    this.camera.lookAt(look)
  }
}
