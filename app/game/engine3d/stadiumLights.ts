import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

/** Gradiente radial branco->transparente para o halo dos refletores. */
function buildGlowTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 250, 230, 0.95)')
  gradient.addColorStop(0.25, 'rgba(255, 245, 210, 0.5)')
  gradient.addColorStop(1, 'rgba(255, 240, 200, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * Linha de teto do estadio com refletores brilhando acima da arquibancada,
 * como na arte 2D de referencia: uma faixa escura de cobertura + halos de
 * luz em billboard (sem luz dinamica real, so sprite).
 */
export function buildStadiumLights(width: number, topY: number, z: number): Group {
  const group = new Group()

  const roof = new Mesh(
    new PlaneGeometry(width, 0.5),
    new MeshBasicMaterial({ color: 0x0a0d16 })
  )
  roof.position.set(0, topY, z)
  group.add(roof)

  const glowTexture = buildGlowTexture()
  // ±18% da largura para os laterais cairem dentro do FOV estreito da camera.
  const positions = [-width * 0.18, 0, width * 0.18]
  for (const x of positions) {
    const fixture = new Mesh(
      new PlaneGeometry(1.0, 0.2),
      new MeshBasicMaterial({ color: 0xccd6e4 })
    )
    fixture.position.set(x, topY + 0.45, z)
    group.add(fixture)

    const glow = new Mesh(
      new PlaneGeometry(5, 5),
      new MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        depthWrite: false
      })
    )
    glow.position.set(x, topY + 0.5, z + 0.05)
    group.add(glow)
  }

  return group
}
