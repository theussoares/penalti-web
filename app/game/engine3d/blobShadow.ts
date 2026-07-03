import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

let sharedTexture: CanvasTexture | null = null

/** Gradiente radial preto->transparente, gerado uma vez e compartilhado. */
function getShadowTexture(): CanvasTexture {
  if (sharedTexture) return sharedTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  sharedTexture = new CanvasTexture(canvas)
  return sharedTexture
}

/**
 * Sombra falsa (blob) no gramado — sombras dinamicas estao fora do
 * orcamento de performance (Android de entrada), entao cada personagem e a
 * bola ganham um disco de gradiente colado no chao, como na arte 2D.
 */
export function buildBlobShadow(radius: number): Mesh {
  const material = new MeshBasicMaterial({
    map: getShadowTexture(),
    transparent: true,
    depthWrite: false
  })
  const mesh = new Mesh(new PlaneGeometry(radius * 2, radius * 2), material)
  mesh.rotation.x = -Math.PI / 2
  // Um tico acima do gramado para nao dar z-fighting.
  mesh.position.y = 0.01
  return mesh
}
