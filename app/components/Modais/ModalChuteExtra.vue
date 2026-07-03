<template>
  <ModalArea aria-label="Chute extra">
    <div class="badge badge-replay">
      <svg
        viewBox="0 0 24 24"
        width="40"
        height="40"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    </div>
    <h2 class="card-title">Chute Extra!</h2>
    <p class="card-sub">Essa cobranca nao contou como chance.</p>

    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Continuar jogando'"
      @click="$emit('continuar')"
    />
  </ModalArea>
</template>

<script setup lang="ts">
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ ultimaChance: boolean }>();
defineEmits<{ continuar: [] }>();
</script>

<style scoped>
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

.badge-replay {
  color: #04120a;
  background: radial-gradient(circle at 32% 28%, #a9d8ff, #6fb8ff 55%, #2f7fd1);
  box-shadow: 0 10px 30px rgba(111, 184, 255, 0.4);
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
  margin: 0;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #fff;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.2s;
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
  margin: 6px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.28s;
}
</style>
