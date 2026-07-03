import type { Vec2 } from '../types'

export interface AimBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface WorldLayout {
  goalWidth: number
  goalHeight: number
  goalPostRadius: number
  goalDepth: number
  goalCenterX: number
  goalLineZ: number
  spotZ: number
  ballRadius: number
  aimBounds: AimBounds
}

const GOAL_WIDTH = 7.32
const GOAL_HEIGHT = 2.44
const PENALTY_SPOT_DISTANCE = 11
const AIM_MARGIN = 0.22

export function computeWorldLayout(): WorldLayout {
  const goalCenterX = 0
  const goalLineZ = 0
  return {
    goalWidth: GOAL_WIDTH,
    goalHeight: GOAL_HEIGHT,
    goalPostRadius: 0.06,
    goalDepth: 1.1,
    goalCenterX,
    goalLineZ,
    spotZ: goalLineZ + PENALTY_SPOT_DISTANCE,
    ballRadius: 0.11,
    aimBounds: {
      minX: goalCenterX - GOAL_WIDTH / 2 + AIM_MARGIN,
      maxX: goalCenterX + GOAL_WIDTH / 2 - AIM_MARGIN,
      minY: AIM_MARGIN,
      maxY: GOAL_HEIGHT - AIM_MARGIN
    }
  }
}

export function clampAim(x: number, y: number, bounds: AimBounds): Vec2 {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y))
  }
}
