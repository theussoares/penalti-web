<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/80 px-4"
  >
    <div
      :style="{ background: coresTextos.corFundo }"
      class="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-2 relative"
    >
      <!-- Botão fechar -->
      <div class="flex justify-between">
        <!-- Título -->
        <h2
          :style="{ color: coresTextos.corTitulo }"
          class="text-xl font-semibold text-start flex items-center gap-1"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11.9958 3H3V21H12" stroke="#6B7280" stroke-width="2" />
            <path d="M16.5 16.5L21 12L16.5 7.5" stroke="#6B7280" stroke-width="2" />
            <path d="M8 11.9958H21" stroke="#6B7280" stroke-width="2" />
          </svg>

          Vai sair agora?
        </h2>

        <button
          @click="fecharModalX"
          @touchend.prevent="fecharModalX"
          class="w-8 h-8 flex items-center justify-center text-gray-500 transition-colors"
          aria-label="Fechar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Mensagem -->
      <p :style="{ color: cores.descricao }" class="text-start font-normal text-base">
        Sem stress: suas raspadinhas ficam salvas e você pode continuar de onde parou mais tarde.
      </p>

      <p :style="{ color: cores.descricao2 }" class="text-start font-normal text-base">
        Se quiser, dá uma olhada nos resultados até agora em “Meus Números”.
      </p>

      <!-- Botões -->
      <div class="flex flex-col gap-2 pt-4">
        <button
          @click="fecharModal"
          @touchend.prevent="fecharModal"
          class="flex-1 py-3 px-6 rounded-lg font-semibold text-base border-2 transition-all duration-150 active:scale-95 active:opacity-80"
          :style="{
            backgroundColor: corPrimaria,
            color: coresTextos.corFundo
          }"
        >
          Bora continuar jogando
        </button>

        <button
          @click="confirmar"
          class="flex-1 border py-3 px-6 rounded-lg font-semibold text-base transition-all duration-150 active:scale-95 active:opacity-80"
          :style="{
            color: corPrimaria,
            backgroundColor: coresTextos.corFundo,
            borderColor: corPrimaria
          }"
        >
          Sair e voltar depois
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { modalCores } from '@/constants/coresRaspadinhas'
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { ComputedRef, computed, inject } from 'vue'

const emit = defineEmits<{
  fecharRaspadinha: []
  continuarRaspar: []
  fecharModal: []
}>()

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')
if (!CONFIG_RASPADINHA) {
  throw new Error('CONFIG_RASPADINHA não foi fornecido.')
}

const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)
const tema = computed(() => CONFIG_RASPADINHA.value.tema)
const cores = computed(() => modalCores(tema))
const coresTextos = computed(() => CONFIG_RASPADINHA.value.modal)

const confirmar = () => {
  emit('fecharRaspadinha')
}

const fecharModal = () => {
  emit('continuarRaspar')
}

const fecharModalX = () => {
  emit('fecharModal')
}
</script>
