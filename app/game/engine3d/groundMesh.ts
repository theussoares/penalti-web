import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import type { WorldLayout } from './worldGeometry'

const GOAL_AREA_DEPTH = 5.5
const GOAL_AREA_HALF_WIDTH = 9.16
const PENALTY_AREA_DEPTH = 16.5
const PENALTY_ARC_RADIUS = 9.15
const STRIPE_DEPTH = 2.2

/**
 * Gramado com listras alternadas e as linhas da area (linha do gol,
 * pequena area, marca do penalti e arco da grande area) desenhadas numa
 * textura procedural — mesma ambientacao do campo do motor 2D.
 *
 * `anisotropy` vem de `renderer.capabilities.getMaxAnisotropy()`: sem ela,
 * o angulo rasante da camera borra as linhas brancas ate sumirem.
 */
export function buildGroundMesh(layout: WorldLayout, anisotropy = 1): Mesh {
  const width = layout.goalWidth * 4.5
  const nearZ = layout.spotZ + 6
  const farZ = layout.goalLineZ - layout.goalDepth - 1
  const depth = nearZ - farZ

  const texture = buildPitchTexture(layout, width, nearZ, farZ)
  texture.anisotropy = anisotropy
  const material = new MeshStandardMaterial({ map: texture, roughness: 0.95 })
  const mesh = new Mesh(new PlaneGeometry(width, depth), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(layout.goalCenterX, 0, (nearZ + farZ) / 2)
  return mesh
}

function buildPitchTexture(
  layout: WorldLayout,
  width: number,
  nearZ: number,
  farZ: number
): CanvasTexture {
  const cw = 1024
  const ch = 1024
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!

  const depth = nearZ - farZ
  // Topo do canvas = lado do gol (farZ); base = lado do batedor (nearZ) —
  // orientacao confirmada empiricamente com faixas de debug coloridas.
  const toX = (x: number) => ((x - layout.goalCenterX + width / 2) / width) * cw
  const toY = (z: number) => ((z - farZ) / depth) * ch
  const pxPerMeterX = cw / width
  const pxPerMeterY = ch / depth

  // Listras horizontais alternadas (paralelas a linha do gol).
  ctx.fillStyle = '#2b8a3c'
  ctx.fillRect(0, 0, cw, ch)
  for (let z = farZ, i = 0; z < nearZ; z += STRIPE_DEPTH, i++) {
    if (i % 2 === 0) continue
    ctx.fillStyle = '#41b25a'
    ctx.fillRect(0, toY(z), cw, STRIPE_DEPTH * pxPerMeterY + 1)
  }

  // Linhas bem mais grossas que os 13cm oficiais: no angulo rasante da
  // camera a espessura real viraria 1-2px e sumiria — a arte 2D de
  // referencia tambem usa linhas exageradas.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = 0.6 * pxPerMeterY

  // Linha do gol.
  line(ctx, 0, toY(layout.goalLineZ), cw, toY(layout.goalLineZ))

  // Pequena area.
  const boxTop = toY(layout.goalLineZ)
  const boxBottom = toY(layout.goalLineZ + GOAL_AREA_DEPTH)
  ctx.strokeRect(
    toX(-GOAL_AREA_HALF_WIDTH),
    boxTop,
    (GOAL_AREA_HALF_WIDTH * 2) * pxPerMeterX,
    boxBottom - boxTop
  )

  // Linha da grande area (a largura oficial excede o canvas — vai de ponta a ponta).
  const penaltyLineY = toY(layout.goalLineZ + PENALTY_AREA_DEPTH)
  line(ctx, 0, penaltyLineY, cw, penaltyLineY)

  // Arco da grande area: so o trecho que fica alem da linha (lado do batedor).
  const sinLimit = PENALTY_AREA_DEPTH - (layout.spotZ - layout.goalLineZ)
  const angle = Math.asin(sinLimit / PENALTY_ARC_RADIUS)
  ctx.beginPath()
  ctx.ellipse(
    toX(0),
    toY(layout.spotZ),
    PENALTY_ARC_RADIUS * pxPerMeterX,
    PENALTY_ARC_RADIUS * pxPerMeterY,
    0,
    angle,
    Math.PI - angle
  )
  ctx.stroke()

  // Marca do penalti.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.beginPath()
  ctx.ellipse(toX(0), toY(layout.spotZ), 0.16 * pxPerMeterX, 0.16 * pxPerMeterY, 0, 0, Math.PI * 2)
  ctx.fill()

  return new CanvasTexture(canvas)
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}
