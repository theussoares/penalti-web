<template>
  <ModalArea>
    <template #header>
      <div class="flex justify-center relative">
        <h3
          :style="{ color: cores.titulo }"
          class="text-xl font-semibold leading-5 text-center flex gap-1"
        >
          Você ganhou
          <span :style="{ color: corPrimaria }">{{ props.premio?.nome || '' }}</span>
        </h3>
        <button
          @click="proximaRaspadinha"
          @touchend.prevent="proximaRaspadinha"
          class="w-6 h-6 flex items-center absolute top-0 right-0 justify-center text-gray-500 hover:text-gray-600 transition-colors z-20"
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
        <img
          v-if="isClienteBau"
          class="absolute -top-[156px] left-1/2 -translate-x-1/2 w-20"
          src="../../../../assets/riso-ganhou.webp"
        />
        <img
          class="absolute -top-[140px] left-1/2 -translate-x-1/2 w-72"
          src="https://fpp-assets.playservicos.com.br/bpp/BAUDOMILHAO/imagem/jogos/ganhou-2.webp"
        />
      </div>
      <p :style="{ color: cores.descricao }" class="text-gray-700 text-sm text-center">
        Seu prêmio já foi adicionado à compra. Confira ao final do jogo em “Meus números”.
      </p>
    </template>

    <template #footer>
      <Botao
        @click="proximaRaspadinha"
        @touchend.prevent="proximaRaspadinha"
        titulo="Continuar jogando"
      />
    </template>
  </ModalArea>
</template>

<script setup lang="ts">
import { modalCores } from '@/constants/coresRaspadinhas'
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { PremiosRoletaProps } from '@/types/Roleta'
import { computed, ComputedRef, inject } from 'vue'
import Botao from './Botao.vue'
import ModalArea from './ModalArea.vue'

interface ModalGanhouProps {
  premio: PremiosRoletaProps | null
  proximaRaspadinha: () => void
}

const props = defineProps<ModalGanhouProps>()

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')
if (!CONFIG_RASPADINHA) {
  throw new Error('CONFIG_RASPADINHA não foi fornecido.')
}

const tema = computed(() => CONFIG_RASPADINHA.value.tema)
const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)
const cores = computed(() => modalCores(tema))
const isClienteBau = computed(() => CONFIG_RASPADINHA.value?.isClienteBau)
</script>
