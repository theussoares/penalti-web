<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  state?: "idle" | "ganhou" | "nao_ganhou" | "replay";
}>();

const rootClass = computed(() => `state-${props.state || "idle"}`);

const horizontalLights = 18;
const verticalLights = 10;
</script>

<template>
  <div class="jumbotron-container" :class="rootClass">
    <div class="jumbo-frame">
      <!-- Top Lights -->
      <div class="lights-row top-lights" aria-hidden="true">
        <div
          v-for="i in horizontalLights"
          :key="`t-${i}`"
          class="light-bulb"
          :style="{ '--i': i }"
        ></div>
      </div>
      <!-- Bottom Lights -->
      <div class="lights-row bottom-lights" aria-hidden="true">
        <div
          v-for="i in horizontalLights"
          :key="`b-${i}`"
          class="light-bulb"
          :style="{ '--i': i }"
        ></div>
      </div>
      <!-- Left Lights -->
      <div class="lights-col left-lights" aria-hidden="true">
        <div
          v-for="i in verticalLights"
          :key="`l-${i}`"
          class="light-bulb"
          :style="{ '--i': i }"
        ></div>
      </div>
      <!-- Right Lights -->
      <div class="lights-col right-lights" aria-hidden="true">
        <div
          v-for="i in verticalLights"
          :key="`r-${i}`"
          class="light-bulb"
          :style="{ '--i': i }"
        ></div>
      </div>

      <!-- Screen Content -->
      <div class="jumbo-screen">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.jumbotron-container {
  width: 100%;
  max-width: 800px;
  /* Proporcao parecida com o da imagem */
  aspect-ratio: 16 / 9;
  margin: 0 auto;
  pointer-events: none; /* Deixa clicks passarem se necessario */
}

/* O quadro exterior metalico */
.jumbo-frame {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #0c0c0c;
  /* Pattern de trelica metalica */
  background-image:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 15px,
      rgba(255, 255, 255, 0.04) 15px,
      rgba(255, 255, 255, 0.04) 16px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 15px,
      rgba(255, 255, 255, 0.04) 15px,
      rgba(90, 32, 32, 0.04) 16px
    );
  border: 3px solid #1a1a1a;
  border-radius: 6px;
  box-shadow:
    0 15px 50px rgba(0, 0, 0, 0.9),
    inset 0 0 20px rgba(0, 0, 0, 0.8);
  pointer-events: auto;
}

/* Tela preta central */
.jumbo-screen {
  width: 100%;
  height: 100%;
  background: #040806;
  border: 2px solid var(--border-glow);
  box-shadow:
    0 0 15px var(--glow-color),
    inset 0 0 40px rgba(0, 0, 0, 0.9);
  border-radius: 4px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  padding-top: 15px;
  transition:
    border-color 0.4s ease,
    box-shadow 0.4s ease;
}

/* Containers de luzes */
.lights-row {
  position: absolute;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-evenly;
}
.top-lights {
  top: 9px;
}
.bottom-lights {
  bottom: 9px;
}

.lights-col {
  position: absolute;
  top: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
}
.left-lights {
  left: 9px;
}
.right-lights {
  right: 9px;
}

/* Bulbo da luz */
.light-bulb {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--light-core);
  box-shadow:
    0 0 6px var(--glow-color),
    0 0 12px var(--glow-color);
  animation: var(--light-animation);
  transition:
    background 0.4s ease,
    box-shadow 0.4s ease;
}

/* -------------------------------------
   Estados e Cores das Luzes
   ------------------------------------- */

/* IDLE: Dourado, pulso suave */
.state-idle {
  --border-glow: rgba(255, 215, 0, 0.8);
  --glow-color: rgba(255, 215, 0, 0.4);
  --light-core: #fff8cc;
  --light-animation: pulse-idle 2s ease-in-out infinite alternate;
}

/* GANHOU: Verde Neon, pisca rapido (festa) */
.state-ganhou {
  --border-glow: rgba(50, 255, 100, 1);
  --glow-color: rgba(50, 255, 100, 0.7);
  --light-core: #e0ffe6;
  --light-animation: blink-party 0.4s steps(2, start) infinite;
}

/* NAO GANHOU: Vermelho, apagando (triste) */
.state-nao_ganhou {
  --border-glow: rgba(255, 50, 50, 0.3);
  --glow-color: rgba(255, 50, 50, 0.2);
  --light-core: #ffcccc;
  --light-animation: fade-down 2s forwards;
}

/* REPLAY (CHUTE EXTRA): Azul e amarelo, efeito chase */
.state-replay {
  --border-glow: rgba(0, 191, 255, 1);
  --glow-color: rgba(0, 191, 255, 0.6);
  --light-core: #e0f7ff;
  --light-animation: chase 1s linear infinite;
}
.state-replay .light-bulb {
  animation-delay: calc(var(--i) * 0.1s);
}

/* -------------------------------------
   Keyframes
   ------------------------------------- */

@keyframes pulse-idle {
  0% {
    opacity: 0.4;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@keyframes blink-party {
  0% {
    opacity: 1;
    transform: scale(1.2);
  }
  50% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes fade-down {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0.15;
    box-shadow: none;
  }
}

@keyframes chase {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.3);
    box-shadow:
      0 0 10px var(--glow-color),
      0 0 20px var(--glow-color);
  }
}

/* Media query para ajustar tamanho das luzes em telas grandes */
@media (min-width: 768px) {
  .light-bulb {
    width: 8px;
    height: 8px;
  }
}
</style>
