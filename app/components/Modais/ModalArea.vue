<template>
  <div
    class="fixed inset-0 z-[999] flex items-center px-5 justify-center backdrop-blur-md modal-fade-in"
    :style="{ backgroundColor: corPrimaria + '80' }"
  >
    <div :style="{ background: cores.fundo }" class="p-5 rounded-2xl max-w-[370px] space-y-6">
      <div class="space-y-3">
        <header class="space-y-2">
          <slot name="header" />
        </header>
        <div>
          <slot name="conteudo" />
        </div>
      </div>
      <div class="space-y-2">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { modalCores } from '@/constants/coresRaspadinhas'
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { computed, ComputedRef, inject } from 'vue'

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')
if (!CONFIG_RASPADINHA) {
  throw new Error('CONFIG_RASPADINHA não foi fornecido.')
}

const tema = computed(() => CONFIG_RASPADINHA.value.tema)
const cores = computed(() => modalCores(tema))
const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.modal-fade-in {
  animation: fadeIn 0.3s ease forwards;
}
</style>
