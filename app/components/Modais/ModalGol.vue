<template>
  <ModalArea aria-label="Voce ganhou" variant="win">
    <div class="rays" aria-hidden="true" />
    <div class="badge badge-win">
      <svg
        viewBox="0 0 24 24"
        width="44"
        height="44"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
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
      <strong class="prize-value">{{ premio?.nome }}</strong>
    </div>

    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Continuar jogando'"
      @click="$emit('continuar')"
    />
  </ModalArea>
</template>

<script setup lang="ts">
import type { PenaltyPlayResult } from "~/composables/useGameApi";
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ premio: PenaltyPlayResult | null; ultimaChance: boolean }>();
defineEmits<{ continuar: [] }>();
</script>

<style scoped>
.rays {
  position: absolute;
  inset: -60%;
  -webkit-mask-image: radial-gradient(
    circle 230px at 50% 41%,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.3) 55%,
    transparent 100%
  );
  mask-image: radial-gradient(
    circle 230px at 50% 41%,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.3) 55%,
    transparent 100%
  );
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
  to {
    transform: rotate(360deg);
  }
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
  color: #00061b;
  background: radial-gradient(circle at 32% 28%, #ffe789, #ffd23f 55%, #d99a12);
  box-shadow: 0 10px 30px rgba(255, 210, 63, 0.4);
}

.badge-win::after {
  content: "";
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 2px solid rgba(255, 210, 63, 0.6);
  animation: ring-pulse 1.8s ease-out infinite;
}

@keyframes ring-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.9;
  }
  70% {
    transform: scale(1.22);
    opacity: 0;
  }
  100% {
    transform: scale(1.22);
    opacity: 0;
  }
}

@keyframes badge-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.card-title {
  position: relative;
  margin: 0;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #fff;
  background: linear-gradient(
    100deg,
    #d99a12 0%,
    #ffd23f 28%,
    #fff3bd 50%,
    #ffd23f 72%,
    #d99a12 100%
  );
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(255, 210, 63, 0.4));
  animation:
    rise-in 0.5s ease both,
    title-shine 2.6s linear 0.7s infinite;
}

@keyframes title-shine {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

@keyframes rise-in {
  0% {
    transform: translateY(14px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.card-sub {
  position: relative;
  margin: 6px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.28s;
}

.prize {
  position: relative;
  margin: 20px 0 4px;
  padding: 16px 14px;
  border-radius: 16px;
  background: linear-gradient(
    170deg,
    rgba(255, 210, 63, 0.1),
    rgba(255, 255, 255, 0.04) 45%
  );
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
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 46%;
  background: linear-gradient(
    105deg,
    transparent,
    rgba(255, 255, 255, 0.14) 50%,
    transparent
  );
  animation: prize-shimmer 2.8s ease-in-out 1s infinite;
  pointer-events: none;
}

@keyframes prize-shimmer {
  0% {
    left: -60%;
  }
  55% {
    left: 115%;
  }
  100% {
    left: 115%;
  }
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
  animation:
    value-pop 0.5s cubic-bezier(0.34, 1.5, 0.64, 1) 0.55s both,
    value-glow 2.2s ease-in-out 1.1s infinite;
}

@keyframes value-pop {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes value-glow {
  0%,
  100% {
    text-shadow: 0 0 24px rgba(141, 255, 90, 0.35);
  }
  50% {
    text-shadow: 0 0 38px rgba(141, 255, 90, 0.65);
  }
}
</style>
