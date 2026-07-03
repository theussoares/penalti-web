/**
 * Tipos compartilhados entre o motor 2D (engine.ts) e o motor 3D (engine3d/*).
 */

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

export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}
