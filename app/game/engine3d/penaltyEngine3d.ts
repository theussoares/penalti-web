import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Mesh,
  type Object3D,
  Scene,
  WebGLRenderer
} from 'three'
import type { EngineCallbacks, EngineState, ShotOutcome, Vec2 } from '../types'
import type { Character } from './character'
import { createCharacter } from './character'
import { buildAmbientSmoke, type AmbientEffects } from './ambientEffects'
import { buildBallMesh } from './ballMesh'
import { arcHeight, ballFlightPosition } from './ballFlight'
import { buildAimReticle, type AimReticle } from './aimReticle'
import { buildBlobShadow } from './blobShadow'
import { buildCameraRig, type CameraRig } from './cameraRig'
import { buildFieldAtmosphere, type FieldAtmosphere } from './fieldAtmosphere'
import { buildGoalFrame } from './goalFrameMesh'
import { computeDiveTarget } from './goalkeeperAI'
import { buildNetMesh, type NetMesh } from './netMesh'
import type { Ripple } from './netRipple'
import { computeWorldLayout, type WorldLayout } from './worldGeometry'
import { loadKeeperDiveModel, type KeeperDiveModel } from './keeperDiveModel'
import { loadKickerModel, type KickerModel } from './kickerModel'

const TIMINGS = { runup: 0.72, strike: 0.16, flight: 0.5, aftermath: 1.35 }
/** Velocidade angular (rad/s) do vaivem da mira automatica — ciclo completo em ~5.2s. */
const AUTO_AIM_SPEED = 1.2
/** Estadio ficou mais rico visualmente; o goleiro em escala 1:1 parecia pequeno. */
const KEEPER_SCALE = 1.13
/** Ajuste de escala do modelo real do batedor (calibrado visualmente). */
const KICKER_SCALE = 0.024

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

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

  /** Posicao X atual da mira automatica (vaivem esquerda<->direita). */
  private autoAimX = 0
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
  private ambientSmoke: AmbientEffects
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
  private kickerModel: KickerModel | null = null
  /** Modelo real do batedor presente na cena (substituiu o procedural). */
  private kickerModelActive = false
  /** Clipe de chute ja disparado neste lance. */
  private kickPlayed = false

  private resizeObserver: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas
    this.cb = callbacks
    this.layout = computeWorldLayout()
    this.ballStart = { x: 0, y: this.layout.ballRadius, z: this.layout.spotZ }
    this.ballPos = { ...this.ballStart }
    this.autoAimX = this.layout.goalCenterX
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

    // Brilho/particulas douradas sutis sobre o gramado da foto — torcida/
    // refletores/telao ja vem da imagem de fundo, so a fumaca atras do gol
    // continua sendo 3D de verdade (precisa ficar atras dos personagens).
    this.fieldAtmosphere = buildFieldAtmosphere(this.layout)
    this.scene.add(this.fieldAtmosphere.object3D)

    this.ambientSmoke = buildAmbientSmoke(this.layout)
    this.scene.add(this.ambientSmoke.object3D)

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
    // Estadio ficou mais rico visualmente e o goleiro em escala real
    // (1:1 com o mundo) parecia pequeno diante dele — origem dos dois
    // rigs (procedural e .glb) fica nos pes, entao escalar em torno da
    // propria origem cresce so pra cima, sem tirar o pe do chao.
    this.keeper.object3D.scale.setScalar(KEEPER_SCALE)
    this.scene.add(this.keeper.object3D)

    void this.loadDiveModelAsync()
    void this.loadKickerModelAsync()

    this.handleResize()
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)

    this.raf = requestAnimationFrame(this.frame)
    // Mira automatica ja comeca rodando — nao ha mais toque para inicia-la.
    this.setState('aiming')
  }

  private async loadDiveModelAsync() {
    this.keeperDiveModel = await loadKeeperDiveModel()
    if (!this.keeperDiveModel || this.destroyed) return
    // Modelo real assume o goleiro em todas as fases (idle em loop com o
    // clipe base do .glb); o procedural fica so como fallback de carga.
    this.scene.remove(this.keeper.object3D)
    this.keeperDiveModel.object3D.position.copy(this.keeper.object3D.position)
    this.keeperDiveModel.object3D.scale.setScalar(KEEPER_SCALE)
    this.scene.add(this.keeperDiveModel.object3D)
    this.keeperDiveModel.playIdle()
    this.diveModelActive = true
  }

  private async loadKickerModelAsync() {
    this.kickerModel = await loadKickerModel()
    if (!this.kickerModel || this.destroyed) return
    // Mesmo padrao do goleiro: modelo real assume o batedor em todas as
    // fases (idle/corrida/chute), procedural so como fallback de carga.
    this.scene.remove(this.kicker.object3D)
    this.kickerModel.object3D.position.copy(this.kicker.object3D.position)
    this.kickerModel.object3D.scale.setScalar(KICKER_SCALE)
    // O .glb bruto olha para +Z (camera/torcida); o gol fica em -Z a partir
    // da marca do penalti, entao precisa girar 180 graus para o batedor
    // olhar para o gol como o procedural ja fazia.
    this.kickerModel.object3D.rotation.y = Math.PI
    this.scene.add(this.kickerModel.object3D)
    this.kickerModel.playIdle()
    this.kickerModelActive = true
  }

  /** Object3D do batedor atualmente na cena — real (se carregado) ou procedural. */
  private kickerObject(): Object3D {
    return this.kickerModelActive ? this.kickerModel!.object3D : this.kicker.object3D
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.renderer.dispose()
  }

  reset() {
    this.resultSent = false
    this.ripples = []
    this.ballPos = { ...this.ballStart }
    this.kickerObject().position.set(this.kickerStartPos.x, 0, this.kickerStartPos.z)
    this.divePlayed = false
    this.kickPlayed = false
    // Modelo real fica na cena; so volta do mergulho/chute para o idle em loop.
    if (this.diveModelActive) this.keeperDiveModel!.playIdle()
    if (this.kickerModelActive) this.kickerModel!.playIdle()
    // Rearma a mira automatica (tambem reinicia o som ambiente, via
    // onStateChange('aiming') no componente Vue).
    this.setState('aiming')
  }

  // ------------------------------------------------------------------
  // Logica da cobranca
  // ------------------------------------------------------------------

  /**
   * Chamado pelo componente Vue depois que o resultado (ja decidido pela
   * API) e conhecido. Congela a posicao atual da mira automatica como o
   * alvo do chute; o goleiro mergulha exato (defende) ou para longe (vira
   * gol), conforme `computeDiveTarget`.
   */
  shoot(outcome: 'goal' | 'save') {
    if (this.state !== 'ready' && this.state !== 'aiming') return
    const aimX = this.autoAimX
    this.shotTarget = { x: aimX, y: this.layout.keeperHeight }
    this.outcome = outcome
    this.diveTarget = computeDiveTarget(outcome, aimX, this.layout)
    this.ballEnd = { x: this.shotTarget.x, y: this.shotTarget.y, z: this.layout.goalLineZ }
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
        this.updateKickerIdle(now, delta, 'runup', rt)
        this.kickerObject().position.set(
          this.kickerStartPos.x + (this.kickerKickPos.x - this.kickerStartPos.x) * rt,
          0,
          this.kickerStartPos.z + (this.kickerKickPos.z - this.kickerStartPos.z) * rt
        )
        this.updateKeeperIdle(now, delta)
        if (t >= TIMINGS.runup) this.setState('strike')
        break
      }
      case 'strike':
        if (this.kickerModelActive) {
          if (!this.kickPlayed) {
            this.kickPlayed = true
            // Janela mais generosa que TIMINGS.strike sozinho — o clipe de
            // chute continua tocando durante o inicio do voo da bola (ver
            // case 'flight' abaixo), senao ficaria comprimido demais.
            this.kickerModel!.playKick(TIMINGS.strike + TIMINGS.flight)
          }
          this.kickerModel!.update(delta)
        } else {
          this.kicker.update('kick', Math.min(1, t / TIMINGS.strike), delta)
        }
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
        // Deixa o clipe de chute terminar de tocar (ver case 'strike' acima).
        if (this.kickerModelActive) this.kickerModel!.update(delta)

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
        this.updateKickerIdle(now, delta, 'idle', now)
        this.updateKeeperIdle(now, delta)
    }

    const autoAiming = this.state === 'ready' || this.state === 'aiming'
    if (autoAiming) {
      const sweep = (Math.sin(now * AUTO_AIM_SPEED) + 1) / 2
      this.autoAimX = lerp(this.layout.aimBounds.minX, this.layout.aimBounds.maxX, sweep)
    }
    this.aimReticle.update(autoAiming ? { x: this.autoAimX, y: this.layout.keeperHeight } : null, true, now)

    this.fieldAtmosphere.update(now)
    this.ambientSmoke.update(now)
    this.netMesh.update(this.ripples, now)
    this.ballMesh.position.set(this.ballPos.x, this.ballPos.y, this.ballPos.z)

    // Sombras seguem bola (encolhendo com a altura) e batedor.
    this.ballShadow.position.x = this.ballPos.x
    this.ballShadow.position.z = this.ballPos.z
    const shadowScale = 1 / (1 + this.ballPos.y * 0.7)
    this.ballShadow.scale.setScalar(shadowScale)
    this.kickerShadow.position.x = this.kickerObject().position.x
    this.kickerShadow.position.z = this.kickerObject().position.z
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

  /**
   * Batedor parado ou correndo: modelo real toca o clipe de idle em loop
   * (nao ha clipe de corrida — o deslocamento e so de posicao, ver o
   * `position.set` no case 'runup'), ou o procedural com a pose certa.
   */
  private updateKickerIdle(now: number, delta: number, proceduralPhase: 'idle' | 'runup', proceduralT: number) {
    if (this.kickerModelActive) {
      this.kickerModel!.update(delta)
    } else {
      this.kicker.update(proceduralPhase, proceduralT, delta)
    }
  }

  private onBallArrive(now: number) {
    this.cb.onImpact?.(this.outcome)
    if (this.outcome === 'goal') {
      this.ripples.push({ x: this.ballEnd.x, y: this.ballEnd.y, start: now })
    }

    // Velocidade inicial do pos-impacto — antes disso a bola congelava no
    // ar em defesa (so o gol "parecia" certo por estar contra a rede).
    const sideways = Math.sign(this.ballEnd.x) || 1
    if (this.outcome === 'save') {
      // Rebatida do goleiro: volta para o campo, aberta para o lado do mergulho.
      this.ballVel = { x: sideways * 2.2, y: 1.6, z: 4.2 }
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
