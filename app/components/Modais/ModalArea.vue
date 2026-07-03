<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="ariaLabel">
    <div class="card" :class="variant ? `card-${variant}` : ''">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ ariaLabel: string; variant?: 'win' | 'lose' }>(), {
  variant: undefined,
});
</script>

<style scoped>
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
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.card-win {
  border-color: rgba(255, 210, 63, 0.45);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    0 0 60px rgba(255, 210, 63, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.card-lose::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 110, 90, 0.8),
    transparent
  );
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
  0% {
    transform: translateY(30px) scale(0.92);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
</style>
