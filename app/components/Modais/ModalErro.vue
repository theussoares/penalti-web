<template>
  <ModalArea>
    <template #header>
      <div class="flex justify-between">
        <!-- Título -->
        <h2
          :style="{ color: cores.titulo }"
          class="text-lg font-semibold text-start flex items-center gap-1"
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

          Tivemos um problema ao carregar seu jogo.
        </h2>
      </div>
      <p v-if="projetoCheckout" :style="{ color: cores.descricao }" class="text-sm">
        Mas não se preocupe, seu jogo continua salvo e você pode acessá-lo em
        <a :href="urlProdAdquiridos" :style="{ color: corPrimaria }" class="font-semibold underline">Meus Números</a> mais tarde
      </p>
      <p v-else :style="{ color: cores.descricao }" class="text-sm">
        Mas não se preocupe, seu jogo continua salvo e você pode acessá-lo novamente mais tarde
      </p>
    </template>

    <template #footer>
      <Botao @click="() => props.fecharRaspadinha?.()" titulo="Retornar" variant="outline" />
    </template>
  </ModalArea>
</template>

<script setup lang="ts">
import { modalCores } from '@/constants/coresRaspadinhas'
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { computed, ComputedRef, inject } from 'vue'
import Botao from './Botao.vue'
import ModalArea from './ModalArea.vue'

interface ModalErroProps {
  fecharRaspadinha?: () => void
}

const props = defineProps<ModalErroProps>()

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')
if (!CONFIG_RASPADINHA) {
  throw new Error('CONFIG_RASPADINHA não foi fornecido.')
}

const tema = computed(() => CONFIG_RASPADINHA.value.tema)
const cores = computed(() => modalCores(tema))
const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)
const urlProdAdquiridos = computed(() => CONFIG_RASPADINHA.value.urlProdAdquiridos)
const projetoCheckout = computed(() => CONFIG_RASPADINHA.value.projeto === 'checkout')
</script>
