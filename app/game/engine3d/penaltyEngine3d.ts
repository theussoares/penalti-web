import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Mesh,
  Scene,
  WebGLRenderer
} from 'three'
import type { EngineCallbacks, EngineState, ShotOutcome, Vec2 } from '../types'
import type { Character } from './character'
import { createCharacter } from './character'
import { buildBallMesh } from './ballMesh'
import { arcHeight, ballFlightPosition } from './ballFlight'
import { buildAimReticle, type AimReticle } from './aimReticle'
import { buildBlobShadow } from './blobShadow'
import { buildCameraRig, type CameraRig } from './cameraRig'
import { buildFieldAtmosphere, type FieldAtmosphere } from './fieldAtmosphere'
import { buildGoalFrame } from './goalFrameMesh'
import { decideShot } from './goalkeeperAI'
import { buildNetMesh, type NetMesh } from './netMesh'
import type { Ripple } from './netRipple'
import { screenToAim } from './aimInput'
import { clampAim, computeWorldLayout, type WorldLayout } from './worldGeometry'
import { loadKeeperDiveModel, type KeeperDiveModel } from './keeperDiveModel'

const TIMINGS = { runup: 0.72, strike: 0.16, flight: 0.5, aftermath: 1.35 }

export class PenaltyEngine3D {
  private canvas: HTMLCanvasElement
  private cb: EngineCallbacks
  private renderer: WebGLRenderer
  private cameraRig: CameraRig
  private layout: WorldLayout
  private clock = new Clock()
  private raf = 0
  private destroyed = false

  state: EngineState = 'ready'
  private stateStart = 0

  private hasAim = false
  private pointerActive = false
  private aim: Vec2 = { x: 0, y: 0 }
  private shotTarget: Vec2 = { x: 0, y: 0 }
  private outcome: ShotOutcome = 'goal'
  private diveTarget: Vec2 = { x: 0, y: 0 }

  private ballStart = { x: 0, y: 0.11, z: 0 }
  private ballEnd = { x: 0, y: 0.11, z: 0 }
  private ballPos = { x: 0, y: 0.11, z: 0 }
  /** Velocidade da bola no pos-impacto (rebote/queda), em m/s. */
  private ballVel = { x: 0, y: 0, z: 0 }
  /** Corrida de aproximacao do batedor: de onde parte e onde chuta. */
  private kickerStartPos = { x: -1.7, z: 0 }
  private kickerKickPos = { x: -0.35, z: 0 }
  private ripples: Ripple[] = []
  private resultSent = false

  private scene = new Scene()
  private ballMesh: Mesh
  private netMesh: NetMesh
  private fieldAtmosphere: FieldAtmosphere
  private aimReticle: AimReticle
  private ballShadow: Mesh
  private kickerShadow: Mesh
  private kicker: Character
  private keeper: Character
  private keeperDiveModel: KeeperDiveModel | null = null
  /** Modelo real presente na cena (substituiu o procedural apos carregar). */
  private diveModelActive = false
  /** Clipe de mergulho ja disparado neste lance. */
  private divePlayed = false

  private resizeObserver: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas
    this.cb = callbacks
    this.layout = computeWorldLayout()
    this.ballStart = { x: 0, y: this.layout.ballRadius, z: this.layout.spotZ }
    this.ballPos = { ...this.ballStart }
    // Aproximacao curta em diagonal: o suficiente para dar vida ao runup
    // sem tirar o batedor do enquadramento (fov estreito) nem deixa-lo
    // gigante na frente da camera.
    this.kickerStartPos = { x: -1.7, z: this.layout.spotZ + 0.9 }
    this.kickerKickPos = { x: -0.35, z: this.layout.spotZ + 0.35 }

    // alpha:true + clear color transparente para o fundo estatico (foto de
    // estadio gerada por IA, ver PenaltyGame.client.vue) aparecer por tras
    // da cena 3D — so o gol/bola/personagens/sombras sao WebGL de verdade
    // agora; torcida, refletores, telao e fumaca vem da foto.
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power', alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setClearColor(0x000000, 0)
    // shadowMap.enabled fica false (padrao) de proposito: sem sombras dinamicas no v1.

    this.cameraRig = buildCameraRig()

    this.scene.add(new AmbientLight(0xffffff, 0.7))
    const sun = new DirectionalLight(0xfff2d0, 0.8)
    sun.position.set(-4, 8, 6)
    this.scene.add(sun)

    this.scene.add(buildGoalFrame(this.layout))

    this.ballMesh = buildBallMesh(this.layout.ballRadius)
    this.scene.add(this.ballMesh)

    this.netMesh = buildNetMesh(this.layout)
    this.scene.add(this.netMesh.mesh)

    this.aimReticle = buildAimReticle(this.layout.ballRadius, this.layout.goalLineZ)
    this.scene.add(this.aimReticle.object3D)

    // Brilho/particulas sutis sobre o gramado da foto — unico efeito
    // ambiente que sobra em 3D, o resto (torcida/refletores/telao/fumaca)
    // ja vem da imagem de fundo.
    this.fieldAtmosphere = buildFieldAtmosphere(this.layout)
    this.scene.add(this.fieldAtmosphere.object3D)

    // Sombras falsas coladas no gramado (sem sombra dinamica no v1).
    this.ballShadow = buildBlobShadow(this.layout.ballRadius * 2.2)
    this.scene.add(this.ballShadow)
    this.kickerShadow = buildBlobShadow(0.5)
    this.scene.add(this.kickerShadow)
    const keeperShadow = buildBlobShadow(0.55)
    keeperShadow.position.set(0, 0.01, this.layout.goalLineZ - 0.1)
    this.scene.add(keeperShadow)

    this.kicker = createCharacter('kicker')
    this.kicker.object3D.position.set(this.kickerStartPos.x, 0, this.kickerStartPos.z)
    this.scene.add(this.kicker.object3D)

    this.keeper = createCharacter('keeper')
    this.keeper.object3D.position.set(0, 0, this.layout.goalLineZ - 0.1)
    this.scene.add(this.keeper.object3D)

    void this.loadDiveModelAsync()

    this.handleResize()
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    this.stateStart = this.clock.getElapsedTime()
    this.raf = requestAnimationFrame(this.frame)
  }

  private async loadDiveModelAsync() {
    this.keeperDiveModel = await loadKeeperDiveModel()
    if (!this.keeperDiveModel || this.destroyed) return
    // Modelo real assume o goleiro em todas as fases (idle em loop com o
    // clipe base do .glb); o procedural fica so como fallback de carga.
    this.scene.remove(this.keeper.object3D)
    this.keeperDiveModel.object3D.position.copy(this.keeper.object3D.position)
    this.scene.add(this.keeperDiveModel.object3D)
    this.keeperDiveModel.playIdle()
    this.diveModelActive = true
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.renderer.dispose()
  }

  reset() {
    this.setState('ready')
    this.hasAim = false
    this.pointerActive = false
    this.resultSent = false
    this.ripples = []
    this.ballPos = { ...this.ballStart }
    this.kicker.object3D.position.set(this.kickerStartPos.x, 0, this.kickerStartPos.z)
    this.divePlayed = false
    // Modelo real fica na cena; so volta do mergulho para o idle em loop.
    if (this.diveModelActive) this.keeperDiveModel!.playIdle()
  }

  // ------------------------------------------------------------------
  // Entrada do jogador
  // ------------------------------------------------------------------

  private onPointerDown = (e: PointerEvent) => {
    if (this.state !== 'ready' && this.state !== 'aiming') return
    this.pointerActive = true
    this.aim = screenToAim(e.clientX, e.clientY, this.canvas.getBoundingClientRect(), this.cameraRig.camera, this.layout)
    this.hasAim = true
    this.setState('aiming')
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerActive || this.state !== 'aiming') return
    this.aim = screenToAim(e.clientX, e.clientY, this.canvas.getBoundingClientRect(), this.cameraRig.camera, this.layout)
  }

  private onPointerUp = () => {
    if (!this.pointerActive) return
    this.pointerActive = false
    if (this.state === 'aiming' && this.hasAim) this.shoot(this.aim)
  }

  // ------------------------------------------------------------------
  // Logica da cobranca
  // ------------------------------------------------------------------

  private shoot(target: Vec2) {
    this.shotTarget = clampAim(target.x, target.y, this.layout.aimBounds)
    const decision = decideShot(this.shotTarget, this.layout)
    this.outcome = decision.outcome
    this.diveTarget = decision.diveTarget

    this.ballEnd =
      this.outcome === 'out'
        ? { x: this.shotTarget.x * 1.3, y: this.shotTarget.y, z: this.layout.goalLineZ - this.layout.goalDepth * 1.6 }
        : { x: this.shotTarget.x, y: this.shotTarget.y, z: this.layout.goalLineZ }

    this.hasAim = false
    this.setState('runup')
  }

  private setState(s: EngineState) {
    this.state = s
    this.stateStart = this.clock.getElapsedTime()
    this.cb.onStateChange?.(s)
  }

  // ------------------------------------------------------------------
  // Loop principal
  // ------------------------------------------------------------------

  private frame = () => {
    if (this.destroyed) return
    const delta = this.clock.getDelta()
    const now = this.clock.getElapsedTime()
    this.update(now, delta)
    this.render()
    this.raf = requestAnimationFrame(this.frame)
  }

  private stateT(now: number) {
    return now - this.stateStart
  }

  private update(now: number, delta: number) {
    const t = this.stateT(now)

    switch (this.state) {
      case 'runup': {
        const rt = Math.min(1, t / TIMINGS.runup)
        this.kicker.update('runup', rt, delta)
        this.kicker.object3D.position.set(
          this.kickerStartPos.x + (this.kickerKickPos.x - this.kickerStartPos.x) * rt,
          0,
          this.kickerStartPos.z + (this.kickerKickPos.z - this.kickerStartPos.z) * rt
        )
        this.updateKeeperIdle(now, delta)
        if (t >= TIMINGS.runup) this.setState('strike')
        break
      }
      case 'strike':
        this.kicker.update('kick', Math.min(1, t / TIMINGS.strike), delta)
        this.updateKeeperIdle(now, delta)
        if (t >= TIMINGS.strike) {
          this.cb.onKick?.()
          this.setState('flight')
        }
        break
      case 'flight': {
        const ft = Math.min(1, t / TIMINGS.flight)
        const height = arcHeight(this.shotTarget.y, this.layout.goalHeight)
        this.ballPos = ballFlightPosition(this.ballStart, this.ballEnd, ft, height)
        const divePhase = this.diveTarget.x < -0.3 ? 'diveLeft' : this.diveTarget.x > 0.3 ? 'diveRight' : 'diveCenter'

        if (this.diveModelActive) {
          if (!this.divePlayed) {
            this.divePlayed = true
            this.keeperDiveModel!.play(divePhase, TIMINGS.flight + TIMINGS.aftermath)
          }
          this.keeperDiveModel!.update(delta)
        } else {
          this.keeper.update(divePhase, ft, delta)
        }

        if (ft >= 1) this.onBallArrive(now)
        break
      }
      case 'aftermath':
        if (this.diveModelActive) this.keeperDiveModel!.update(delta)
        this.updateBallAftermath(delta)
        if (t >= TIMINGS.aftermath) {
          if (!this.resultSent) {
            this.resultSent = true
            this.cb.onResult(this.outcome)
          }
          this.setState('done')
        }
        break
      default:
        this.kicker.update('idle', now, delta)
        this.updateKeeperIdle(now, delta)
    }

    const aiming = this.state === 'aiming' && this.hasAim
    const b = this.layout.aimBounds
    const aimInGoal =
      this.aim.x > b.minX && this.aim.x < b.maxX &&
      this.aim.y > b.minY && this.aim.y < b.maxY
    this.aimReticle.update(aiming ? this.aim : null, aimInGoal, now)

    this.fieldAtmosphere.update(now)
    this.netMesh.update(this.ripples, now)
    this.ballMesh.position.set(this.ballPos.x, this.ballPos.y, this.ballPos.z)

    // Sombras seguem bola (encolhendo com a altura) e batedor.
    this.ballShadow.position.x = this.ballPos.x
    this.ballShadow.position.z = this.ballPos.z
    const shadowScale = 1 / (1 + this.ballPos.y * 0.7)
    this.ballShadow.scale.setScalar(shadowScale)
    this.kickerShadow.position.x = this.kicker.object3D.position.x
    this.kickerShadow.position.z = this.kicker.object3D.position.z
    this.cameraRig.update(this.state, t, this.ballPos)
  }

  /** Goleiro parado: modelo real com o clipe base em loop, ou o procedural. */
  private updateKeeperIdle(now: number, delta: number) {
    if (this.diveModelActive) {
      this.keeperDiveModel!.update(delta)
    } else {
      this.keeper.update('idle', now, delta)
    }
  }

  private onBallArrive(now: number) {
    this.cb.onImpact?.(this.outcome)
    if (this.outcome === 'goal') {
      this.ripples.push({ x: this.ballEnd.x, y: this.ballEnd.y, start: now })
    }

    // Velocidade inicial do pos-impacto — antes disso a bola congelava no
    // ar em defesa/fora (so o gol "parecia" certo por estar contra a rede).
    const sideways = Math.sign(this.ballEnd.x) || 1
    if (this.outcome === 'save') {
      // Rebatida do goleiro: volta para o campo, aberta para o lado do mergulho.
      this.ballVel = { x: sideways * 2.2, y: 1.6, z: 4.2 }
    } else if (this.outcome === 'out') {
      // Segue o rumo, perdendo forca e caindo atras do gol.
      this.ballVel = { x: sideways * 1.4, y: 0.4, z: -2.6 }
    } else {
      // Gol: a rede segura e a bola escorrega para o chao.
      this.ballVel = { x: 0, y: -0.6, z: -1.2 }
    }

    this.setState('aftermath')
  }

  /** Integra gravidade + quique amortecido no chao durante o aftermath. */
  private updateBallAftermath(delta: number) {
    const GRAVITY = 9.8
    this.ballVel.y -= GRAVITY * delta
    this.ballPos.x += this.ballVel.x * delta
    this.ballPos.y += this.ballVel.y * delta
    this.ballPos.z += this.ballVel.z * delta

    const floor = this.layout.ballRadius
    if (this.ballPos.y < floor) {
      this.ballPos.y = floor
      this.ballVel.y = Math.abs(this.ballVel.y) > 0.8 ? -this.ballVel.y * 0.45 : 0
      this.ballVel.x *= 0.7
      this.ballVel.z *= 0.7
    }

    // No gol, a rede segura a bola — nao deixa atravessar o fundo.
    const netZ = this.layout.goalLineZ - this.layout.goalDepth + this.layout.ballRadius
    if (this.outcome === 'goal' && this.ballPos.z < netZ) {
      this.ballPos.z = netZ
      this.ballVel.z = 0
    }
  }

  private render() {
    this.renderer.render(this.scene, this.cameraRig.camera)
  }

  // ------------------------------------------------------------------
  // Resize
  // ------------------------------------------------------------------

  private handleResize() {
    const parent = this.canvas.parentElement
    const w = parent?.clientWidth ?? window.innerWidth
    const h = parent?.clientHeight ?? window.innerHeight
    this.renderer.setSize(w, h, false)
    this.cameraRig.resize(w / h)
  }
}
