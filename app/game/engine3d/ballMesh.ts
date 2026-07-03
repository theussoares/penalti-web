import { CanvasTexture, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'

/** Textura procedural de gomos, gerada uma vez e reaproveitada como mapa esferico. */
function buildBallTexture(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#20262e'
  for (let i = 0; i < 5; i++) {
    const cx = (size / 5) * i + size / 10
    const cy = size / 2
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  return new CanvasTexture(canvas)
}

export function buildBallMesh(radius: number): Mesh {
  const geometry = new SphereGeometry(radius, 24, 24)
  const material = new MeshStandardMaterial({ map: buildBallTexture(), roughness: 0.5 })
  return new Mesh(geometry, material)
}
