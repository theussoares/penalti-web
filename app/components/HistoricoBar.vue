<template>
  <div v-if="ultimos.length > 0" class="historico-bar" aria-hidden="true">
    <span
      v-for="(item, i) in ultimos"
      :key="`${item.chave_giro}-${i}`"
      class="historico-item"
      :class="`historico-${tipoIcone(item)}`"
    >
      <svg
        v-if="tipoIcone(item) === 'gol'"
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <svg
        v-else-if="tipoIcone(item) === 'replay'"
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PenaltyPlayResult } from "~/types/game";

const props = defineProps<{ history: PenaltyPlayResult[] }>();

const ultimos = computed(() => props.history.slice(-8));

function tipoIcone(item: PenaltyPlayResult): "gol" | "defendeu" | "replay" {
  if (item.tipo_acao === "ganhou") return "gol";
  if (item.tipo_acao === "replay") return "replay";
  return "defendeu";
}
</script>

<style scoped>
.historico-bar {
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(6, 18, 12, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
}

.historico-item {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
}

.historico-gol {
  color: #00061b;
  background: #8dff5a;
}

.historico-defendeu {
  color: #ffe2dc;
  background: #4a5568;
}

.historico-replay {
  color: #00061b;
  background: #6fb8ff;
}
</style>
