import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

const AD_TEXT = 'PREMIADO'
const AD_COLORS = ['#38bdf8', '#facc15', '#4ade80', '#facc15', '#38bdf8', '#4ade80']

/**
 * Faixa de placas de publicidade "PREMIADO" entre o gol e a arquibancada,
 * reproduzindo a ambientacao do motor 2D.
 */
export function buildAdBoards(width: number, height: number): Mesh {
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
    const textWidth = ctx.measureText(AD_TEXT).width
    ctx.fillText(AD_TEXT, i * step + (step - textWidth) / 2, ch / 2)
  }

  const material = new MeshBasicMaterial({ map: new CanvasTexture(canvas) })
  return new Mesh(new PlaneGeometry(width, height), material)
}
