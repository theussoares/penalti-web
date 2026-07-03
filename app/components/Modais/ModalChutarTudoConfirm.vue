<template>
  <ModalArea aria-label="Chutar tudo">
    <template v-if="fase === 'confirmar'">
      <h2 class="card-title">Chutar tudo?</h2>
      <p class="card-sub">
        Suas {{ quantidade }} chances restantes vao ser jogadas
        automaticamente e o resultado aparece no final.
      </p>

      <div class="botoes">
        <Botao titulo="Cancelar" variant="outline" @click="$emit('cancelar')" />
        <Botao titulo="Chutar tudo" @click="$emit('confirmar')" />
      </div>
    </template>

    <template v-else>
      <p class="card-sub progresso-texto">
        Chutando suas {{ quantidade }}
        {{ quantidade === 1 ? "chance" : "chances" }}...
      </p>
      <div class="barra-fundo">
        <div class="barra-progresso" />
      </div>
    </template>
  </ModalArea>
</template>

<script setup lang="ts">
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ fase: "confirmar" | "progresso"; quantidade: number }>();
defineEmits<{ confirmar: []; cancelar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0;
  font-size: 26px;
  font-weight: 900;
  color: #fff;
}

.card-sub {
  margin: 10px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}

.progresso-texto {
  margin: 6px 0 18px;
  text-align: center;
}

.botoes {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.botoes > * {
  margin-top: 0;
  flex: 1;
}

.barra-fundo {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.barra-progresso {
  height: 100%;
  width: 0;
  border-radius: 999px;
  background: #8dff5a;
  animation: progresso 1.4s ease-in-out forwards;
}

@keyframes progresso {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}
</style>
