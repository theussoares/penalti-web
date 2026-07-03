import { CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'

export type CharacterRole = 'kicker' | 'keeper'
export type CharacterPhase = 'idle' | 'runup' | 'kick' | 'diveLeft' | 'diveRight' | 'diveCenter'

export interface ProceduralCharacter {
  root: Group
  /**
   * Para fases com progresso definido (runup/kick/dive*), `t` vai de 0 a 1.
   * Para "idle", `t` e o tempo decorrido em segundos, usado so para gerar
   * uma oscilacao continua (balanco de respiracao) — nao ha "fim" da fase.
   */
  setPose(phase: CharacterPhase, t: number): void
}

interface Joints {
  hips: Group
  torso: Group
  head: Mesh
  armL: Group
  armR: Group
  legL: Group
  legR: Group
}

const PALETTE: Record<CharacterRole, { shirt: number; shorts: number; skin: number }> = {
  kicker: { shirt: 0xffd23f, shorts: 0x1f4fd0, skin: 0x8a5a3b },
  keeper: { shirt: 0x17181d, shorts: 0x17181d, skin: 0xc98e63 }
}

function limb(radius: number, length: number, color: number): Mesh {
  const mesh = new Mesh(new CapsuleGeometry(radius, length, 4, 8), new MeshStandardMaterial({ color }))
  mesh.position.y = -length / 2 - radius
  return mesh
}

function buildJoints(role: CharacterRole): { root: Group; joints: Joints } {
  const palette = PALETTE[role]
  const root = new Group()

  const hips = new Group()
  hips.position.y = 0.9
  root.add(hips)

  const torso = new Group()
  torso.add(limb(0.18, 0.55, palette.shirt))
  torso.position.y = 0.05
  hips.add(torso)

  const head = new Mesh(new SphereGeometry(0.13, 12, 12), new MeshStandardMaterial({ color: palette.skin }))
  head.position.y = 0.75
  torso.add(head)

  const armL = new Group()
  armL.add(limb(0.07, 0.5, palette.skin))
  armL.position.set(-0.22, 0.55, 0)
  torso.add(armL)

  const armR = new Group()
  armR.add(limb(0.07, 0.5, palette.skin))
  armR.position.set(0.22, 0.55, 0)
  torso.add(armR)

  const legL = new Group()
  legL.add(limb(0.09, 0.75, palette.shorts))
  legL.position.set(-0.12, 0, 0)
  hips.add(legL)

  const legR = new Group()
  legR.add(limb(0.09, 0.75, palette.shorts))
  legR.position.set(0.12, 0, 0)
  hips.add(legR)

  return { root, joints: { hips, torso, head, armL, armR, legL, legR } }
}

/**
 * Constroi um personagem low-poly por codigo (capsulas + esfera para a
 * cabeca), reaproveitando as mesmas fases de pose que o batedor/goleiro 2D
 * ja usavam (idle com balanco leve, corrida com passada, chute com chicote
 * de perna, mergulho esticado para o lado escolhido pela IA do goleiro).
 */
export function buildProceduralCharacter(role: CharacterRole): ProceduralCharacter {
  const { root, joints } = buildJoints(role)

  function setPose(phase: CharacterPhase, t: number) {
    const { torso, armL, armR, legL, legR, hips } = joints

    // Reset por quadro; cada fase abaixo so ajusta o que precisa.
    torso.rotation.set(0, 0, 0)
    armL.rotation.set(0, 0, 0)
    armR.rotation.set(0, 0, 0)
    legL.rotation.set(0, 0, 0)
    legR.rotation.set(0, 0, 0)
    hips.rotation.set(0, 0, 0)
    hips.position.y = 0.9

    switch (phase) {
      case 'idle': {
        const sway = Math.sin(t * Math.PI * 2) * 0.05
        torso.rotation.z = sway
        armL.rotation.x = sway * 0.6
        armR.rotation.x = -sway * 0.6
        break
      }
      case 'runup': {
        const stride = Math.sin(t * Math.PI * 2 * 3.2)
        legL.rotation.x = stride * 0.9
        legR.rotation.x = -stride * 0.9
        armL.rotation.x = -stride * 0.7
        armR.rotation.x = stride * 0.7
        torso.rotation.x = 0.15
        break
      }
      case 'kick': {
        const swing = t
        legR.rotation.x = -1.3 + swing * 2.1
        legL.rotation.x = 0.15
        armL.rotation.x = -0.6 - swing * 0.6
        armR.rotation.x = 0.3
        torso.rotation.x = -0.1 - swing * 0.25
        break
      }
      case 'diveLeft':
      case 'diveRight':
      case 'diveCenter': {
        const dir = phase === 'diveLeft' ? -1 : phase === 'diveRight' ? 1 : 0
        const stretch = t
        hips.rotation.z = dir * stretch * 1.1
        hips.position.y = 0.9 - stretch * 0.55
        armL.rotation.z = dir >= 0 ? stretch * 1.4 : -stretch * 0.4
        armR.rotation.z = dir <= 0 ? -stretch * 1.4 : stretch * 0.4
        legL.rotation.z = dir * stretch * 0.5
        legR.rotation.z = dir * stretch * 0.5
        break
      }
    }
  }

  setPose('idle', 0)
  return { root, setPose }
}
