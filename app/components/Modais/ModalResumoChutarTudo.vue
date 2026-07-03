<template>
  <ModalArea aria-label="Resumo do lote" variant="win">
    <h2 class="card-title">Resultado do lote</h2>

    <p v-if="premios.length === 0" class="card-sub">
      Nenhum premio dessa vez — respira e chuta de novo.
    </p>

    <ul v-else class="lista-premios">
      <li v-for="(premio, i) in premios" :key="i" class="item-premio">
        {{ premio.nome }}
      </li>
    </ul>

    <Botao titulo="Jogar novamente" @click="$emit('continuar')" />
  </ModalArea>
</template>

<script setup lang="ts">
import type { PremioGanho } from "~/game/session";
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ premios: PremioGanho[] }>();
defineEmits<{ continuar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
}

.card-sub {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}

.lista-premios {
  margin: 16px 0 4px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.item-premio {
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(
    170deg,
    rgba(255, 210, 63, 0.1),
    rgba(255, 255, 255, 0.04) 45%
  );
  border: 1px solid rgba(255, 210, 63, 0.35);
  color: #8dff5a;
  font-weight: 800;
  font-size: 15px;
}
</style>
