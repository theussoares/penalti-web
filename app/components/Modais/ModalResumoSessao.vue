<template>
  <ModalArea aria-label="Resumo da sessao" variant="win">
    <h2 class="card-title">Resumo da sessao</h2>

    <ul class="lista-premios">
      <li v-for="(premio, i) in premios" :key="i" class="item-premio">
        {{ premio.nome }}
      </li>
    </ul>

    <Botao titulo="Fechar" @click="$emit('fechar')" />
  </ModalArea>
</template>

<script setup lang="ts">
import type { PremioGanho } from "~/game/session";
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ premios: PremioGanho[] }>();
defineEmits<{ fechar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
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
