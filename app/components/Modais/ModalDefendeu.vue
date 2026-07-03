<template>
  <ModalArea aria-label="Nao foi dessa vez" variant="lose">
    <div class="badge badge-lose">
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
        <path
          d="M12 3c3.5 0 6 2 6 5.5V13a6 6 0 0 1-12 0V8.5C6 5 8.5 3 12 3Z"
        />
        <path d="M9 7v4M12 6.5V11M15 7v4" />
      </svg>
    </div>
    <h2 class="card-title">Defendeu!</h2>
    <p class="card-sub">O goleiro voou no canto certo.</p>
    <p class="card-encourage">Respira, ajusta a mira e manda de novo.</p>

    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Tentar novamente'"
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
  animation:
    badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    lose-shake 0.5s ease 0.6s;
  animation-delay: 0.1s;
}

.badge-lose {
  color: #ffe2dc;
  background: radial-gradient(circle at 32% 28%, #4a5568, #2b3444 60%, #1a2230);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
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

@keyframes lose-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-6px);
  }
  50% {
    transform: translateX(5px);
  }
  75% {
    transform: translateX(-3px);
  }
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

.card-encourage {
  position: relative;
  margin: 14px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.36s;
}
</style>
