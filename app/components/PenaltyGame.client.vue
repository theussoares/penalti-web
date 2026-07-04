<script setup lang="ts">
import { PenaltyEngine3D } from "~/game/engine3d/penaltyEngine3d";
import type { ShotOutcome, EngineState } from "~/game/types";
import { Sfx } from "~/game/sfx";
import type { GameInfo, PenaltyPlayResult } from "~/composables/useGameApi";
import { MOCK_SESSION_SIZE } from "~/composables/useGameApi";
import {
  chancesRestantes,
  isSessionOver,
  filtrarPremiosGanhados,
  type PremioGanho,
} from "~/game/session";
import HistoricoBar from "~/components/HistoricoBar.vue";
import ModalGol from "~/components/Modais/ModalGol.vue";
import ModalDefendeu from "~/components/Modais/ModalDefendeu.vue";
import ModalChuteExtra from "~/components/Modais/ModalChuteExtra.vue";
import ModalChutarTudoConfirm from "~/components/Modais/ModalChutarTudoConfirm.vue";
import ModalResumoChutarTudo from "~/components/Modais/ModalResumoChutarTudo.vue";
import confetti from "canvas-confetti";

const { fetchGames, fetchPlaySequence } = useGameApi();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const engineState = ref<EngineState>("ready");
// Fundo de estadio gerado por IA: retrato para celular (ate 565px de
// largura), paisagem para desktop (acima disso). Ambos sempre ocupam 100%
// da viewport (background-size: cover cropa o que sobrar) — sem travar
// proporcao nem pillarbox/letterbox.
const DESKTOP_BREAKPOINT = 565;
const isDesktopLayout = ref(false);
const bgImage = computed(() =>
  isDesktopLayout.value
    ? "/images/stadium-bg-landscape.webp"
    : "/images/stadium-bg-portrait.webp",
);

function updateLayoutMode() {
  isDesktopLayout.value = window.innerWidth > DESKTOP_BREAKPOINT;
}

const game = ref<GameInfo | null>(null);
const muted = ref(false);

type ModalState =
  | "none"
  | "gol"
  | "defendeu"
  | "chute-extra"
  | "chutar-tudo-confirmar"
  | "chutar-tudo-progresso"
  | "resumo-tudo";

const modal = ref<ModalState>("none");
const currentPlayResult = ref<PenaltyPlayResult | null>(null);
const awaitingSequence = ref(false);
const sessionStarted = ref(false);

// Fila de resultados ja decididos pela API para a sessao inteira (buscada
// uma unica vez, no primeiro "Chutar") e historico dos ja consumidos. Ambos
// precisam ser reativos (ref) porque o contador de chances e a barra de
// historico dependem deles.
const playQueue = ref<PenaltyPlayResult[]>([]);
const history = ref<PenaltyPlayResult[]>([]);
const premiosChutarTudo = ref<PremioGanho[]>([]);

let engine: PenaltyEngine3D | null = null;
const sfx = new Sfx();

const chancesRestantesValue = computed(() => chancesRestantes(playQueue.value));
const sessaoEncerrada = computed(
  () => sessionStarted.value && isSessionOver(playQueue.value),
);
const podeChutarTudo = computed(
  () =>
    chancesRestantesValue.value > 1 &&
    !awaitingSequence.value &&
    (engineState.value === "ready" || engineState.value === "aiming"),
);

const playHistory = computed(() => history.value);

const jumboState = computed(() => {
  if (modal.value === "none" || !currentPlayResult.value) return "idle";
  return currentPlayResult.value.tipo_acao;
});

async function onShootClick() {
  if (!engine || awaitingSequence.value || modal.value !== "none") return;
  const gameId = game.value?.id ?? "penalty-premiado";
  if (!sessionStarted.value) {
    awaitingSequence.value = true;
    playQueue.value = await fetchPlaySequence(gameId, MOCK_SESSION_SIZE);
    sessionStarted.value = true;
    awaitingSequence.value = false;
  }
  if (playQueue.value.length === 0) return;
  const result = playQueue.value.shift()!;
  currentPlayResult.value = result;
  // O goleiro so encena visualmente — replay usa 'save' arbitrariamente,
  // ja que nao ha um terceiro valor fisico na engine (ShotOutcome continua
  // 'goal' | 'save'). Quem decide o modal certo e onResult(), lendo
  // currentPlayResult.tipo_acao, nao esse valor fisico.
  const engineOutcome: ShotOutcome =
    result.tipo_acao === "ganhou" ? "goal" : "save";
  engine.shoot(engineOutcome);
}

function onResult(outcome: ShotOutcome) {
  const result = currentPlayResult.value;
  if (!result) return;
  history.value.push(result);
  if (result.tipo_acao === "ganhou") {
    modal.value = "gol";
    sfx.playWinModal();
    sfx.stopGoalCrowd();
    
    // Dispara confetes vindo de tras do gol (centro-baixo da tela)
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.65, x: 0.5 },
      colors: ["#ffd700", "#32ff64", "#ffffff"],
      zIndex: 2000,
      disableForReducedMotion: true
    });
  } else if (result.tipo_acao === "replay") {
    modal.value = "chute-extra";
  } else {
    modal.value = "defendeu";
  }
}

function onModalContinuar() {
  if (sessaoEncerrada.value) {
    jogarNovamente();
    return;
  }
  modal.value = "none";
  currentPlayResult.value = null;
  engine?.reset();
  sfx.whistle();
}

function jogarNovamente() {
  modal.value = "none";
  currentPlayResult.value = null;
  history.value = [];
  sessionStarted.value = false;
  playQueue.value = [];
  engine?.reset();
  sfx.whistle();
}

function abrirChutarTudoConfirm() {
  if (!podeChutarTudo.value) return;
  modal.value = "chutar-tudo-confirmar";
}

function confirmarChutarTudo() {
  modal.value = "chutar-tudo-progresso";
  // Nao re-anima a engine por item (levaria 2-3s x N chutes) — resolve
  // todos os itens restantes da fila de uma vez so nos dados, com um
  // loading falso, igual ao confirmarGirarTodas() da Roleta
  // (play-components-web/src/components/Roleta/composables/useGirarRoleta.ts).
  setTimeout(() => {
    const consumidos = playQueue.value.splice(0);
    history.value.push(...consumidos);
    premiosChutarTudo.value = filtrarPremiosGanhados(consumidos);
    modal.value = "resumo-tudo";
  }, 1500);
}

function toggleMute() {
  muted.value = !muted.value;
  sfx.setMuted(muted.value);
}

function handleVisibilityChange() {
  sfx.handleVisibility(document.hidden);
}

onMounted(async () => {
  updateLayoutMode();
  window.addEventListener("resize", updateLayoutMode);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  game.value = (await fetchGames()).find((g) => g.active) ?? null;

  if (!canvasRef.value) return;
  engine = new PenaltyEngine3D(canvasRef.value, {
    onResult,
    onStateChange: (s) => {
      engineState.value = s;
      if (s === "aiming") sfx.startAmbient();
    },
    onKick: () => sfx.kick(),
    onImpact: (outcome) => {
      if (outcome === "goal") {
        sfx.roar();
        sfx.playGoalCrowd();
      } else {
        sfx.groan();
      }
    },
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateLayoutMode);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  engine?.destroy();
  sfx.destroy();
});
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
          <button
            class="hint-badge shoot-btn"
            type="button"
            :disabled="awaitingSequence"
            @click="onShootClick"
          >
            {{ awaitingSequence ? "Carregando..." : "Chutar" }}
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
          :ultima-chance="sessaoEncerrada"
          @continuar="onModalContinuar"
        />
      </Transition>

      <!-- Modal de derrota -->
      <Transition name="modal">
        <ModalDefendeu
          v-if="modal === 'defendeu'"
          :ultima-chance="sessaoEncerrada"
          @continuar="onModalContinuar"
        />
      </Transition>

      <!-- Modal de chute extra (replay) -->
      <Transition name="modal">
        <ModalChuteExtra
          v-if="modal === 'chute-extra'"
          :ultima-chance="sessaoEncerrada"
          @continuar="onModalContinuar"
        />
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

      <!-- Resumo do lote do "Chutar tudo" -->
      <Transition name="modal">
        <ModalResumoChutarTudo
          v-if="modal === 'resumo-tudo'"
          :premios="premiosChutarTudo"
          @continuar="jogarNovamente"
        />
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
