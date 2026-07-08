<template>
  <ModalArea aria-label="Sessao sem premio" variant="lose">
    <h2 class="card-title">Nao foi dessa vez</h2>
    <p class="card-sub">
      Voce chutou todas as suas chances sem premio dessa vez. Mais sorte na
      proxima.
    </p>

    <Botao titulo="Fechar" @click="$emit('fechar')" />
  </ModalArea>
</template>

<script setup lang="ts">
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineEmits<{ fechar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0;
  font-size: 30px;
  font-weight: 900;
  color: #fff;
}

.card-sub {
  margin: 10px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}
</style>
