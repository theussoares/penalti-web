<template>
  <button
    type="button"
    class="botao"
    :class="`botao-${variant}`"
    :disabled="disabled"
    @click="$emit('click')"
  >
    {{ titulo }}
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string;
    variant?: "primary" | "outline";
    disabled?: boolean;
  }>(),
  {
    variant: "primary",
    disabled: false,
  },
);
defineEmits<{ click: [] }>();
</script>

<style scoped>
.botao {
  position: relative;
  margin-top: 20px;
  width: 100%;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;
}

.botao:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.botao-primary {
  border: 0;
  color: #04120a;
  background: linear-gradient(160deg, #ffe066, #ffd23f 55%, #eab308);
  box-shadow: 0 10px 26px rgba(255, 210, 63, 0.32);
}

.botao-primary:hover:not(:disabled) {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.botao-primary:active:not(:disabled) {
  transform: translateY(1px) scale(0.99);
}

.botao-outline {
  background: transparent;
  border: 1px solid rgba(141, 255, 90, 0.5);
  color: #8dff5a;
}

.botao-outline:active:not(:disabled) {
  transform: scale(0.97);
}
</style>
