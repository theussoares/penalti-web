import type { Object3D } from 'three'
import { buildProceduralCharacter, type CharacterPhase, type CharacterRole } from './proceduralCharacter'

export interface Character {
  object3D: Object3D
  /** Ver a nota sobre a semantica de `t` em `ProceduralCharacter.setPose`. */
  update(phase: CharacterPhase, t: number, deltaSeconds: number): void
}

/**
 * Personagem 3D construido inteiramente por codigo — sem asset externo.
 * Ver "Global Constraints" no plano: nenhum pacote gratuito de
 * jogador/goleiro riggado com chute e mergulho foi encontrado, entao o rig
 * procedural e o unico caminho, nao um fallback de algo melhor.
 */
export function createCharacter(role: CharacterRole): Character {
  const procedural = buildProceduralCharacter(role)
  return {
    object3D: procedural.root,
    update(phase, t) {
      procedural.setPose(phase, t)
    }
  }
}
