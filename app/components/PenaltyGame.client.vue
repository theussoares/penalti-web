<script setup lang="ts">
import { PenaltyEngine3D } from '~/game/engine3d/penaltyEngine3d'
import type { ShotOutcome, EngineState } from '~/game/types'
import { Sfx } from '~/game/sfx'
import type { GameInfo, PenaltyPlayResult } from '~/composables/useGameApi'

const { fetchGames, fetchPlaySequence } = useGameApi()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engineState = ref<EngineState>('ready')
// Fundo de estadio gerado por IA: retrato para celular, paisagem para
// desktop. A proporcao da cena fica travada na proporcao da imagem para o
// gol/goleiro 3D (renderizados por cima, canvas transparente) baterem
// certinho com o gramado da foto em qualquer tamanho de tela.
const PORTRAIT_ASPECT = 853 / 1844
const LANDSCAPE_ASPECT = 1536 / 1024
const isDesktopLayout = ref(false)
const stageSize = ref({ width: 0, height: 0 })
const bgImage = computed(() =>
  isDesktopLayout.value ? '/images/stadium-bg-landscape.webp' : '/images/stadium-bg-portrait.webp'
)

function updateLayoutMode() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  isDesktopLayout.value = vw / vh >= 1
  const ratio = isDesktopLayout.value ? LANDSCAPE_ASPECT : PORTRAIT_ASPECT
  // Encaixa a proporcao travada da imagem dentro da viewport: usa a
  // dimensao que "sobra" como barra (pillarbox/letterbox), sem esticar.
  stageSize.value =
    vw / vh > ratio
      ? { width: vh * ratio, height: vh }
      : { width: vw, height: vw / ratio }
}

// Confete decorativo continuo (telao + arquibancada da foto de fundo) —
// espalhamento deterministico via aritmetica modular, sem Math.random(),
// pra nao gerar layout diferente a cada re-render.
const CONFETTI_COLORS = ['#8dff5a', '#ffd23f', '#38bdf8', '#ffffff']
const confettiPieces = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: -((i * 1.3) % 7),
  duration: 5 + (i % 5) * 0.7,
  drift: `${(i % 2 === 0 ? 1 : -1) * (20 + (i % 4) * 10)}px`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]
}))

const game = ref<GameInfo | null>(null)
const modal = ref<'none' | 'win' | 'lose'>('none')
const prizeResult = ref<PenaltyPlayResult | null>(null)
const muted = ref(false)
const attempts = ref(0)
const goals = ref(0)
const awaitingSequence = ref(false)

let engine: PenaltyEngine3D | null = null
const sfx = new Sfx()

// Sequencia de resultados ja decididos pela API — consumida um item por
// chute. So ha espera visivel no primeiro chute da sessao; depois disso a
// fila e reabastecida em segundo plano (maybeRefill), sem o jogador notar.
const SEQUENCE_BATCH_SIZE = 10
const REFILL_THRESHOLD = 3
let playQueue: PenaltyPlayResult[] = []
let refillPromise: Promise<void> | null = null
let currentPlayResult: PenaltyPlayResult | null = null

function maybeRefill(gameId: string) {
  if (playQueue.length >= REFILL_THRESHOLD || refillPromise) return
  refillPromise = fetchPlaySequence(gameId, SEQUENCE_BATCH_SIZE).then((more) => {
    playQueue.push(...more)
    refillPromise = null
  })
}

async function nextPlayResult(gameId: string): Promise<PenaltyPlayResult> {
  if (playQueue.length === 0) {
    playQueue = await fetchPlaySequence(gameId, SEQUENCE_BATCH_SIZE)
  }
  const result = playQueue.shift()!
  maybeRefill(gameId)
  return result
}

async function onShootClick() {
  if (!engine || awaitingSequence.value) return
  const gameId = game.value?.id ?? 'penalty-premiado'
  if (playQueue.length === 0) awaitingSequence.value = true
  const result = await nextPlayResult(gameId)
  awaitingSequence.value = false
  currentPlayResult = result
  engine.shoot(result.tipo_acao === 'ganhou' ? 'goal' : 'save')
}

function onResult(outcome: ShotOutcome) {
  attempts.value++
  if (outcome === 'goal') {
    goals.value++
    prizeResult.value = currentPlayResult
    modal.value = 'win'
  } else {
    modal.value = 'lose'
  }
}

function retry() {
  modal.value = 'none'
  prizeResult.value = null
  engine?.reset()
  sfx.whistle()
}

function toggleMute() {
  muted.value = !muted.value
  sfx.setMuted(muted.value)
}

onMounted(async () => {
  updateLayoutMode()
  window.addEventListener('resize', updateLayoutMode)

  game.value = (await fetchGames()).find((g) => g.active) ?? null

  if (!canvasRef.value) return
  engine = new PenaltyEngine3D(canvasRef.value, {
    onResult,
    onStateChange: (s) => {
      engineState.value = s
      if (s === 'aiming') sfx.startAmbient()
    },
    onKick: () => sfx.kick(),
    onImpact: (outcome) => (outcome === 'goal' ? sfx.roar() : sfx.groan())
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateLayoutMode)
  engine?.destroy()
  sfx.destroy()
})
</script>

<template>
  <div class="stage-viewport">
  <div
    class="stage"
    :style="{ width: `${stageSize.width}px`, height: `${stageSize.height}px`, backgroundImage: `url(${bgImage})` }"
  >
    <canvas ref="canvasRef" class="game-canvas" />

    <!-- Confete continuo, sutil, por cima da foto de fundo -->
    <div class="confetti-layer" aria-hidden="true">
      <span
        v-for="(piece, i) in confettiPieces"
        :key="i"
        class="confetti-piece"
        :style="{
          left: `${piece.left}%`,
          animationDelay: `${piece.delay}s`,
          animationDuration: `${piece.duration}s`,
          '--drift': piece.drift,
          backgroundColor: piece.color
        }"
      />
    </div>

    <!-- Telao central: usa o quadro ja pintado na foto de fundo -->
    <div class="jumbotron" aria-hidden="true">
      <span class="jumbotron-label">{{ game?.name ?? 'Penalti Premiado' }}</span>
      <strong class="jumbotron-value">BOA SORTE!</strong>
      <span class="jumbotron-tag">★ ★ ★ ★ ★</span>
    </div>

    <!-- HUD -->
    <header class="hud">
      <div class="hud-title">
        <h1>{{ game?.name ?? 'Penalti Premiado' }}</h1>
        <p v-if="game">{{ game.headline }}</p>
      </div>
      <div class="hud-right">
        <div class="scoreboard" aria-label="Placar">
          <span class="score-goals">{{ goals }}</span>
          <span class="score-sep">gols</span>
          <span class="score-attempts">{{ attempts }} chutes</span>
        </div>
        <button class="mute-btn" type="button" :aria-label="muted ? 'Ativar som' : 'Desativar som'" @click="toggleMute">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
            <template v-if="!muted">
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </template>
            <template v-else>
              <line x1="15" y1="9" x2="21" y2="15" />
              <line x1="21" y1="9" x2="15" y2="15" />
            </template>
          </svg>
        </button>
      </div>
    </header>

    <!-- Botao de chute -->
    <Transition name="fade">
      <div v-if="modal === 'none' && (engineState === 'ready' || engineState === 'aiming')" class="hint">
        <button class="hint-badge shoot-btn" type="button" :disabled="awaitingSequence" @click="onShootClick">
          {{ awaitingSequence ? 'Carregando...' : 'Chutar' }}
        </button>
      </div>
    </Transition>

    <!-- Modal de vitoria -->
    <Transition name="modal">
      <div v-if="modal === 'win'" class="overlay" role="dialog" aria-modal="true" aria-label="Voce ganhou">
        <div class="card card-win">
          <div class="rays" aria-hidden="true" />
          <div class="badge badge-win">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
              <path d="M7 6H4a3 3 0 0 0 3 5" />
              <path d="M17 6h3a3 3 0 0 1-3 5" />
            </svg>
          </div>
          <h2 class="card-title">GOOOL!</h2>
          <p class="card-sub">Voce venceu o goleiro</p>

          <div class="prize">
            <span class="prize-label">Voce ganhou</span>
            <strong class="prize-value">{{ prizeResult?.nome }}</strong>
          </div>

          <button class="btn btn-primary" type="button" @click="retry">Jogar novamente</button>
        </div>
      </div>
    </Transition>

    <!-- Modal de derrota -->
    <Transition name="modal">
      <div v-if="modal === 'lose'" class="overlay" role="dialog" aria-modal="true" aria-label="Nao foi dessa vez">
        <div class="card card-lose">
          <div class="badge badge-lose">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3c3.5 0 6 2 6 5.5V13a6 6 0 0 1-12 0V8.5C6 5 8.5 3 12 3Z" />
              <path d="M9 7v4M12 6.5V11M15 7v4" />
            </svg>
          </div>
          <h2 class="card-title">Defendeu!</h2>
          <p class="card-sub">O goleiro voou no canto certo.</p>
          <p class="card-encourage">Respira, ajusta a mira e manda de novo.</p>
          <button class="btn btn-primary" type="button" @click="retry">Tentar novamente</button>
        </div>
      </div>
    </Transition>
  </div>
  </div>
</template>

<style scoped>
.stage-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #04120a;
  overflow: hidden;
}

.stage {
  position: relative;
  /* Largura/altura calculadas em JS (updateLayoutMode) para travar a
     proporcao da imagem de fundo dentro da viewport, com barra de
     pillarbox/letterbox em vez de esticar — o gol/goleiro 3D (canvas
     transparente por cima) so bate certo com o gramado da foto se essa
     caixa mantiver a proporcao exata da imagem. */
  overflow: hidden;
  background-color: #04120a;
  background-size: cover;
  background-position: center;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.game-canvas {
  position: absolute;
  inset: 0;
  /* inset nao estica elementos replaced (canvas fica no tamanho do buffer
     do renderer, 1.5x maior que a tela) — precisa do 100% explicito. */
  width: 100%;
  height: 100%;
  display: block;
}

/* ------------------------------ Confete ------------------------------ */

.confetti-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.confetti-piece {
  position: absolute;
  top: -8%;
  width: 6px;
  height: 12px;
  border-radius: 1px;
  opacity: 0;
  animation-name: confetti-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes confetti-fall {
  0% { top: -8%; opacity: 0; transform: translateX(0) rotate(0deg); }
  8% { opacity: 0.9; }
  92% { opacity: 0.9; }
  100% { top: 104%; opacity: 0; transform: translateX(var(--drift)) rotate(480deg); }
}

/* ------------------------------ Telao ------------------------------ */

.jumbotron {
  position: absolute;
  left: 50%;
  top: 27.6%;
  width: 34%;
  height: 8%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  text-align: center;
}

.jumbotron-label {
  font-size: clamp(6px, 1.4vw, 10px);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.jumbotron-value {
  font-size: clamp(12px, 3.4vw, 22px);
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #8dff5a;
  text-shadow: 0 0 10px rgba(141, 255, 90, 0.75), 0 0 24px rgba(141, 255, 90, 0.45);
  animation: value-glow 2.2s ease-in-out infinite;
}

.jumbotron-tag {
  font-size: clamp(6px, 1.3vw, 10px);
  letter-spacing: 0.2em;
  color: #ffd23f;
}

/* ------------------------------ HUD ------------------------------ */

.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(2, 8, 16, 0.72), rgba(2, 8, 16, 0));
}

.hud-title h1 {
  margin: 0;
  font-size: clamp(15px, 4.2vw, 22px);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #ffd23f;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.hud-title p {
  margin: 2px 0 0;
  font-size: clamp(11px, 3vw, 13px);
  color: rgba(255, 255, 255, 0.82);
}

.hud-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scoreboard {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(6, 18, 12, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
}

.score-goals {
  font-size: 18px;
  font-weight: 800;
  color: #8dff5a;
}

.score-sep {
  color: rgba(255, 255, 255, 0.7);
}

.score-attempts {
  color: rgba(255, 255, 255, 0.55);
}

.mute-btn {
  pointer-events: auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(6, 18, 12, 0.65);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: transform 0.15s ease, background 0.15s ease;
}

.mute-btn:active {
  transform: scale(0.92);
}

/* ------------------------------ Botao de chute ------------------------------ */

.hint {
  position: absolute;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  pointer-events: none;
}

.hint-badge {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #04120a;
  background: #8dff5a;
  padding: 12px 34px;
  border-radius: 999px;
  animation: hint-pulse 1.6s ease-in-out infinite;
}

.shoot-btn {
  pointer-events: auto;
  border: 0;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(141, 255, 90, 0.32);
  transition: transform 0.15s ease, filter 0.15s ease;
}

.shoot-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.shoot-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  animation: none;
}

@keyframes hint-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.07); }
}

/* ------------------------------ Modais ------------------------------ */

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(2, 8, 5, 0.62);
  backdrop-filter: blur(7px);
  z-index: 10;
}

.card {
  position: relative;
  width: min(92%, 400px);
  border-radius: 22px;
  padding: 30px 26px 26px;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(165deg, #0d2417, #071510 60%, #051009);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.card-win {
  border-color: rgba(255, 210, 63, 0.45);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    0 0 60px rgba(255, 210, 63, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.rays {
  position: absolute;
  inset: -60%;
  -webkit-mask-image: radial-gradient(circle 230px at 50% 41%, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.3) 55%, transparent 100%);
  mask-image: radial-gradient(circle 230px at 50% 41%, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.3) 55%, transparent 100%);
  background: conic-gradient(
    from 0deg,
    rgba(255, 210, 63, 0.13) 0deg 18deg,
    transparent 18deg 36deg,
    rgba(255, 210, 63, 0.13) 36deg 54deg,
    transparent 54deg 72deg,
    rgba(255, 210, 63, 0.13) 72deg 90deg,
    transparent 90deg 108deg,
    rgba(255, 210, 63, 0.13) 108deg 126deg,
    transparent 126deg 144deg,
    rgba(255, 210, 63, 0.13) 144deg 162deg,
    transparent 162deg 180deg,
    rgba(255, 210, 63, 0.13) 180deg 198deg,
    transparent 198deg 216deg,
    rgba(255, 210, 63, 0.13) 216deg 234deg,
    transparent 234deg 252deg,
    rgba(255, 210, 63, 0.13) 252deg 270deg,
    transparent 270deg 288deg,
    rgba(255, 210, 63, 0.13) 288deg 306deg,
    transparent 306deg 324deg,
    rgba(255, 210, 63, 0.13) 324deg 342deg,
    transparent 342deg 360deg
  );
  animation: rays-spin 14s linear infinite;
  pointer-events: none;
}

@keyframes rays-spin {
  to { transform: rotate(360deg); }
}

.badge {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 50%;
  animation: badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.1s;
}

.badge-win {
  color: #04120a;
  background: radial-gradient(circle at 32% 28%, #ffe789, #ffd23f 55%, #d99a12);
  box-shadow: 0 10px 30px rgba(255, 210, 63, 0.4);
}

.badge-win::after {
  content: '';
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 2px solid rgba(255, 210, 63, 0.6);
  animation: ring-pulse 1.8s ease-out infinite;
}

@keyframes ring-pulse {
  0% { transform: scale(0.92); opacity: 0.9; }
  70% { transform: scale(1.22); opacity: 0; }
  100% { transform: scale(1.22); opacity: 0; }
}

.badge-lose {
  color: #ffe2dc;
  background: radial-gradient(circle at 32% 28%, #4a5568, #2b3444 60%, #1a2230);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

@keyframes badge-pop {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.card-title {
  position: relative;
  margin: 0;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #fff;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.2s;
}

.card-win .card-title {
  background: linear-gradient(100deg, #d99a12 0%, #ffd23f 28%, #fff3bd 50%, #ffd23f 72%, #d99a12 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(255, 210, 63, 0.4));
  animation: rise-in 0.5s ease both, title-shine 2.6s linear 0.7s infinite;
}

@keyframes title-shine {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}

.card-sub {
  position: relative;
  margin: 6px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.28s;
}

.card-encourage {
  position: relative;
  margin: 14px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.36s;
}

.card-lose::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, rgba(255, 110, 90, 0.8), transparent);
}

.card-lose .badge-lose {
  animation: badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both, lose-shake 0.5s ease 0.6s;
}

@keyframes lose-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-3px); }
}

@keyframes rise-in {
  0% { transform: translateY(14px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.prize {
  position: relative;
  margin: 20px 0 4px;
  padding: 16px 14px;
  border-radius: 16px;
  background: linear-gradient(170deg, rgba(255, 210, 63, 0.1), rgba(255, 255, 255, 0.04) 45%);
  border: 1px solid rgba(255, 210, 63, 0.35);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.4s;
}

.prize::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 46%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.14) 50%, transparent);
  animation: prize-shimmer 2.8s ease-in-out 1s infinite;
  pointer-events: none;
}

@keyframes prize-shimmer {
  0% { left: -60%; }
  55% { left: 115%; }
  100% { left: 115%; }
}

.prize-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.prize-value {
  font-size: 32px;
  font-weight: 900;
  color: #8dff5a;
  text-shadow: 0 0 24px rgba(141, 255, 90, 0.35);
  animation: value-pop 0.5s cubic-bezier(0.34, 1.5, 0.64, 1) 0.55s both, value-glow 2.2s ease-in-out 1.1s infinite;
}

@keyframes value-pop {
  0% { transform: scale(0.6); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes value-glow {
  0%, 100% { text-shadow: 0 0 24px rgba(141, 255, 90, 0.35); }
  50% { text-shadow: 0 0 38px rgba(141, 255, 90, 0.65); }
}

.btn {
  position: relative;
  margin-top: 20px;
  width: 100%;
  padding: 14px 18px;
  border: 0;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.5s;
}

.btn-primary {
  color: #04120a;
  background: linear-gradient(160deg, #ffe066, #ffd23f 55%, #eab308);
  box-shadow: 0 10px 26px rgba(255, 210, 63, 0.32);
  overflow: hidden;
}

.btn-primary::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.45) 50%, transparent);
  animation: prize-shimmer 3.2s ease-in-out 1.6s infinite;
  pointer-events: none;
}

.btn-primary:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(1px) scale(0.99);
}

/* ------------------------------ Transicoes ------------------------------ */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-enter-active {
  transition: opacity 0.3s ease;
}

.modal-leave-active {
  transition: opacity 0.22s ease;
}

.modal-enter-active .card {
  animation: card-in 0.45s cubic-bezier(0.34, 1.35, 0.64, 1) both;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@keyframes card-in {
  0% { transform: translateY(30px) scale(0.92); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

@media (min-width: 900px) {
  .hud {
    padding: 16px 24px;
  }
}
</style>
