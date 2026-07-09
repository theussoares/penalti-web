<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { ShotOutcome } from '~/game/types'
import type { PenaltyPlayResult } from '~/types/game'
import { filtrarPremiosGanhados } from '~/game/session'
import HistoricoBar from '~/components/HistoricoBar.vue'
import ModalGol from '~/components/Modais/ModalGol.vue'
import ModalDefendeu from '~/components/Modais/ModalDefendeu.vue'
import ModalChuteExtra from '~/components/Modais/ModalChuteExtra.vue'
import ModalChutarTudoConfirm from '~/components/Modais/ModalChutarTudoConfirm.vue'
import ModalResumoSessao from '~/components/Modais/ModalResumoSessao.vue'
import ModalSemPremio from '~/components/Modais/ModalSemPremio.vue'
import confetti from 'canvas-confetti'

import { useGameSession } from '~/composables/game/useGameSession'
import { useGameModals } from '~/composables/game/useGameModals'
import { useGameAudio } from '~/composables/game/useGameAudio'
import { useEngineIntegration } from '~/composables/game/useEngineIntegration'
import { useChutarTudo } from '~/composables/game/useChutarTudo'

const props = defineProps<{ resultados: PenaltyPlayResult[] }>()
const emit = defineEmits<{ fechar: [] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const DESKTOP_BREAKPOINT = 565
const isDesktopLayout = ref(false)
const bgImage = computed(() =>
  isDesktopLayout.value ? '/images/stadium-bg-landscape.webp' : '/images/stadium-bg-portrait.webp'
)

function updateLayoutMode() {
  isDesktopLayout.value = window.innerWidth > DESKTOP_BREAKPOINT
}

const {
  playQueue,
  history,
  currentPlayResult,
  chancesRestantesValue,
  sessaoEncerrada,
  consumeNextPlay,
  registerPlayedResult
} = useGameSession(props.resultados)

const {
  modal,
  closeModal,
  openGolModal,
  openDefendeuModal,
  openChuteExtraModal,
  openChutarTudoConfirm,
  openChutarTudoProgresso,
  openResumoSessao,
  openSemPremio
} = useGameModals()

const {
  sfx,
  muted,
  toggleMute,
  handleVisibilityChange,
  destroyAudio
} = useGameAudio()

const {
  engineState,
  mountEngine,
  shoot,
  resetEngine,
  destroyEngine
} = useEngineIntegration()

const {
  podeChutarTudo,
  processAllRemainingPlays
} = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)

const premiosSessao = computed(() => filtrarPremiosGanhados(history.value))

const jumboState = computed(() => {
  if (modal.value === 'none' || !currentPlayResult.value) return 'idle'
  return currentPlayResult.value.tipo_acao
})

function onShootClick() {
  if (modal.value !== 'none') return
  const result = consumeNextPlay()
  if (!result) return
  const engineOutcome: ShotOutcome = result.tipo_acao === 'ganhou' ? 'goal' : 'save'
  shoot(engineOutcome)
}

function abrirResumoFinal() {
  if (premiosSessao.value.length > 0) {
    openResumoSessao()
  } else {
    openSemPremio()
  }
}

function onResult(outcome: ShotOutcome) {
  const result = currentPlayResult.value
  if (!result) return
  registerPlayedResult()

  if (sessaoEncerrada.value) {
    abrirResumoFinal()
    return
  }

  if (result.tipo_acao === 'ganhou') {
    openGolModal()
    sfx.playWinModal()
    sfx.stopGoalCrowd()
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.65, x: 0.5 },
      colors: ['#ffd700', '#32ff64', '#ffffff'],
      zIndex: 2000,
      disableForReducedMotion: true
    })
  } else if (result.tipo_acao === 'replay') {
    openChuteExtraModal()
  } else {
    openDefendeuModal()
  }
}

function onModalContinuar() {
  closeModal()
  currentPlayResult.value = null
  resetEngine()
  sfx.whistle()
}

function onFecharJogo() {
  emit('fechar')
}

function abrirChutarTudoConfirm() {
  if (!podeChutarTudo.value) return
  openChutarTudoConfirm()
}

function confirmarChutarTudo() {
  openChutarTudoProgresso()
  setTimeout(() => {
    processAllRemainingPlays()
    abrirResumoFinal()
  }, 1500)
}

onMounted(async () => {
  updateLayoutMode()
  window.addEventListener('resize', updateLayoutMode)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Espera o proximo tick antes de checar a ref: no primeiro mount (cold
  // start / hidratacao do .client.vue) o canvasRef pode ainda nao estar
  // vinculado no exato instante em que onMounted dispara -- sem esse
  // respiro o motor 3D as vezes nunca monta (canvas fica no tamanho
  // padrao do navegador, sem erro nenhum). Remonts via troca de :key nao
  // sofrem disso pois o ciclo de patch ja esta "quente".
  await nextTick()

  if (!canvasRef.value) return
  mountEngine(canvasRef.value, {
    onResult,
    onStateChange: (s) => {
      if (s === 'aiming') sfx.startAmbient()
    },
    onKick: () => sfx.kick(),
    onImpact: (outcome) => {
      if (outcome === 'goal') {
        sfx.roar()
        sfx.playGoalCrowd()
      } else {
        sfx.groan()
      }
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateLayoutMode)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  destroyEngine()
  destroyAudio()
})
</script>

<template>
  <div class="stage-viewport">
    <div class="stage" :style="{ backgroundImage: `url(${bgImage})` }">
      <canvas ref="canvasRef" class="game-canvas" />

      <div class="logo-container" aria-hidden="true">
        <img
          class="jumbotron-logo"
          src="/images/penalti-premiado-logo.png"
          alt=""
        />
        <div class="chances-hud" aria-hidden="true">
          {{ chancesRestantesValue === 1 ? "Resta" : "Restam" }}:
          {{ chancesRestantesValue }}
          {{ chancesRestantesValue === 1 ? "Chance" : "Chances" }}
        </div>
        <HistoricoBar :history="history" />
      </div>

      <!-- Telão em CSS puro -->
      <!-- <div class="jumbotron-wrapper">
        <Jumbotron :state="jumboState">
          

          <div
            v-if="playHistory.length > 0"
            class="prize-history-list"
            aria-hidden="true"
          >
            <TransitionGroup name="list">
              <span
                v-for="(item, index) in playHistory"
                :key="item.id || index"
                class="prize-badge"
                :class="`prize-${item.tipo_acao}`"
              >
                {{ item.nome }}
              </span>
            </TransitionGroup>
          </div>
        </Jumbotron>
      </div> -->

      <!-- HUD -->
      <header class="hud">
        <button
          class="mute-btn"
          type="button"
          :aria-label="muted ? 'Ativar som' : 'Desativar som'"
          @click="toggleMute"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon
              points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
              fill="currentColor"
              stroke="none"
            />
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

        <!-- <button>Sair</button> -->
      </header>

      <!-- Botoes de chute -->
      <Transition name="fade">
        <div
          v-if="
            modal === 'none' &&
            (engineState === 'ready' || engineState === 'aiming')
          "
          class="hint"
        >
          <button class="hint-badge shoot-btn" type="button" @click="onShootClick">
            Chutar
          </button>

          <button
            class="chutar-tudo-btn"
            type="button"
            :disabled="!podeChutarTudo"
            @click="abrirChutarTudoConfirm"
          >
            Chutar tudo
          </button>
        </div>
      </Transition>

      <!-- Modal de vitoria -->
      <Transition name="modal">
        <ModalGol
          v-if="modal === 'gol'"
          :premio="currentPlayResult"
          @continuar="onModalContinuar"
        />
      </Transition>

      <!-- Modal de derrota -->
      <Transition name="modal">
        <ModalDefendeu v-if="modal === 'defendeu'" @continuar="onModalContinuar" />
      </Transition>

      <!-- Modal de chute extra (replay) -->
      <Transition name="modal">
        <ModalChuteExtra v-if="modal === 'chute-extra'" @continuar="onModalContinuar" />
      </Transition>

      <!-- Confirmacao + progresso do "Chutar tudo" -->
      <Transition name="modal">
        <ModalChutarTudoConfirm
          v-if="
            modal === 'chutar-tudo-confirmar' ||
            modal === 'chutar-tudo-progresso'
          "
          :fase="modal === 'chutar-tudo-progresso' ? 'progresso' : 'confirmar'"
          :quantidade="chancesRestantesValue"
          @confirmar="confirmarChutarTudo"
          @cancelar="modal = 'none'"
        />
      </Transition>

      <!-- Resumo final da sessao (ganhou algo) -->
      <Transition name="modal">
        <ModalResumoSessao
          v-if="modal === 'resumo-sessao'"
          :premios="premiosSessao"
          @fechar="onFecharJogo"
        />
      </Transition>

      <!-- Fim de sessao sem nenhum premio -->
      <Transition name="modal">
        <ModalSemPremio v-if="modal === 'sem-premio'" @fechar="onFecharJogo" />
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
  background: #010d32;
  overflow: hidden;
}

.stage {
  position: relative;
  /* Sempre 100% da viewport — sem trava de proporcao nem pillarbox. Abaixo
     de DESKTOP_BREAKPOINT usa a imagem retrato, acima a paisagem; em ambos
     os casos background-size:cover cropa o que sobrar. */
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #00061b;
  background-size: cover;
  background-position: center;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.game-canvas {
  position: absolute;
  inset: 0;
  top: 10px;
  /* inset nao estica elementos replaced (canvas fica no tamanho do buffer
     do renderer, 1.5x maior que a tela) — precisa do 100% explicito. */
  width: 100%;
  height: 100%;
  display: block;
}

/* ------------------------------ Telao ------------------------------ */

.logo-container {
  position: absolute;
  left: 50%;
  top: calc(25px + env(safe-area-inset-top));
  width: 100%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  z-index: 10;
}

.jumbotron-wrapper {
  position: absolute;
  left: 50%;
  top: 18%;
  transform: translateX(-50%);
  width: 65%;
  max-width: 400px;
  z-index: 5;
}

.jumbotron-logo {
  width: 40%;
  max-width: 78%;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(255, 210, 63, 0.35));
}

.chances-hud {
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(6, 18, 12, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
  margin-bottom: 8px;
}

.prize-history-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  width: 100%;
  pointer-events: none;
  z-index: 10;
}

.prize-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  color: #fff;
}

.prize-ganhou {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.4);
  color: #ffd700;
  text-shadow: 0 0 6px rgba(255, 215, 0, 0.5);
}

.prize-nao_ganhou {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
}

.prize-replay {
  background: rgba(0, 191, 255, 0.15);
  border-color: rgba(0, 191, 255, 0.4);
  color: #00bfff;
  text-shadow: 0 0 6px rgba(0, 191, 255, 0.5);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.85);
}
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.85);
}

/* ------------------------------ HUD ------------------------------ */

.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(2, 8, 16, 0.72), rgba(2, 8, 16, 0));
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
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.mute-btn:active {
  transform: scale(0.92);
}

/* ------------------------------ Botoes de chute ------------------------------ */

.hint {
  position: absolute;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.hint-badge {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #00061b;
  background: #8dff5a;
  padding: 10px 34px;
  border-radius: 999px;
  animation: hint-pulse 1.6s ease-in-out infinite;
}

.shoot-btn {
  pointer-events: auto;
  border: 0;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(141, 255, 90, 0.32);
  transition:
    transform 0.15s ease,
    filter 0.15s ease;
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
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.07);
  }
}

.chutar-tudo-btn {
  pointer-events: auto;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8dff5a;
  background: transparent;
  border: 1px solid rgba(141, 255, 90, 0.5);
  padding: 8px 22px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.chutar-tudo-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.chutar-tudo-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
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

@media (min-width: 900px) {
  .hud {
    padding: 16px 24px;
  }
}
</style>
