import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Sprite,
  SpriteMaterial
} from 'three'

export interface CrowdBillboard {
  mesh: Mesh
  /** Chamar a cada quadro com o nivel de empolgacao (0 a 1) e o tempo atual em segundos. */
  setExcitement(value: number, now: number): void
  /** Chamar uma unica vez no instante do gol — dispara onda + flashes por ~1.5-2s. */
  celebrate(now: number): void
}

const ROWS = 22
// Duracao da celebracao disparada por `celebrate()`, em segundos.
const CELEBRATION_DURATION = 1.8
const FLASH_COUNT = 13
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

  // Camada da "onda": faixa vertical clara sobre fundo transparente, varrida
  // via `texture.offset.x` (RepeatWrapping) — nunca redesenhada por frame.
  const waveTexture = buildWaveTexture()
  const waveMaterial = new MeshBasicMaterial({
    map: waveTexture,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false
  })
  const meshWave = new Mesh(geometry.clone(), waveMaterial)
  meshWave.position.z = 0.02
  meshWave.visible = false
  mesh.add(meshWave)

  const { group: flashGroup, update: updateFlashes } = buildFlashGroup(width, height)
  flashGroup.position.z = 0.03
  flashGroup.visible = false
  mesh.add(flashGroup)

  let celebrationStart = -Infinity

  return {
    mesh,
    setExcitement(value, now) {
      const speed = value > 0 ? 9 : 2.2
      const phase = (Math.sin(now * speed) + 1) / 2
      materialB.opacity = Math.min(1, Math.max(0, phase)) * (value > 0 ? 1 : 0.55)
      // `setExcitement` roda todo frame no loop principal (`penaltyEngine3d.ts`),
      // entao e aqui que a janela de celebracao avanca — `celebrate()` so marca
      // o instante de disparo, sem acesso a um `update()` proprio por frame.
      updateCelebration(now)
    },
    celebrate(now) {
      celebrationStart = now
    }
  }

  function updateCelebration(now: number): void {
    const elapsed = now - celebrationStart
    const active = elapsed >= 0 && elapsed < CELEBRATION_DURATION
    flashGroup.visible = active
    meshWave.visible = active

    if (!active) {
      return
    }

    const t = elapsed / CELEBRATION_DURATION
    // Onda varre a placa da esquerda para a direita uma vez e meia, com fade
    // in/out nas bordas do ciclo para nao "cortar" abruptamente.
    waveTexture.offset.x = 1 - t * 1.5
    waveMaterial.opacity = Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.8

    updateFlashes(now)
  }
}

/** Faixa vertical clara com bordas suaves sobre fundo transparente. */
function buildWaveTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 4
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, 'rgba(255, 250, 220, 0)')
  gradient.addColorStop(0.42, 'rgba(255, 250, 220, 0)')
  gradient.addColorStop(0.5, 'rgba(255, 250, 220, 0.9)')
  gradient.addColorStop(0.58, 'rgba(255, 250, 220, 0)')
  gradient.addColorStop(1, 'rgba(255, 250, 220, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  return texture
}

interface FlashState {
  material: SpriteMaterial
  /** Instante (em segundos) do proximo disparo deste flash. */
  nextFire: number
}

interface FlashGroup {
  group: Group
  update(now: number): void
}

/** ~10-15 sprites de flash espalhados pela area da torcida, ocultos por padrao. */
function buildFlashGroup(width: number, height: number): FlashGroup {
  const group = new Group()
  const texture = buildFlashTexture()
  const states: FlashState[] = []

  let rng = 987654321
  const rand = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff
    return rng / 0x7fffffff
  }

  for (let i = 0; i < FLASH_COUNT; i++) {
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending
    })
    const sprite = new Sprite(material)
    sprite.position.set(
      (rand() - 0.5) * width * 0.92,
      (rand() - 0.5) * height * 0.7,
      0
    )
    const size = 0.15 + rand() * 0.25
    sprite.scale.set(size, size, 1)
    group.add(sprite)
    states.push({ material, nextFire: rand() * CELEBRATION_DURATION })
  }

  function update(now: number): void {
    for (const state of states) {
      // Cada flash pisca em rajada curta: sobe rapido para opacidade alta e
      // decai a zero em poucos frames, depois espera ate o proximo disparo
      // aleatorio dentro da janela de celebracao.
      const sinceFire = now - state.nextFire
      if (sinceFire < 0) {
        state.material.opacity = 0
        continue
      }
      const burst = 0.12
      if (sinceFire < burst) {
        state.material.opacity = 1 - sinceFire / burst
      } else {
        state.material.opacity = 0
        if (sinceFire > burst + rand() * 0.5) {
          state.nextFire = now + rand() * 0.4
        }
      }
    }
  }

  return { group, update }
}

/** Sprite circular branco com glow suave, mesma tecnica de `stadiumLights.ts::buildGlowTexture()`. */
function buildFlashTexture(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
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
