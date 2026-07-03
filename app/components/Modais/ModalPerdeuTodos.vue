<template>
  <ModalArea>
    <!-- HEADER -->
    <template #header>
      <div class="text-left space-y-3">
        <h3 class="text-xl font-bold leading-snug" :style="{ color: cores.titulo }">
          Não foi dessa vez! Mas você ainda tem chance de ganhar.
        </h3>
      </div>
    </template>

    <!-- CONTEÚDO -->
    <template #conteudo>
      <p class="text-sm leading-relaxed" :style="{ color: cores.descricao }">
        Consulte seus números, a data e hora do sorteio que você está concorrendo em
        <a
          class="font-semibold ml-1 underline"
          :style="{ color: CONFIG_RASPADINHA.corPrimaria }"
          :href="urlProdAdquiridos"
        >
          Meus números </a
        >.
      </p>
    </template>

    <!-- FOOTER -->
    <template #footer>
      <div class="space-y-2.5">
        <Botao
          v-if="projetoCheckout"
          titulo="Quero mais chances"
          variant="outline"
          @click="emits('comprarMaisChances')"
        />

        <Botao :titulo="CONFIG_RASPADINHA.labelSairJogo" variant="red" @click="props.fecharRaspadinha?.()" />
      </div>
    </template>
  </ModalArea>
</template>

<script setup lang="ts">
import { modalCores } from '@/constants/coresRaspadinhas'
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { computed, ComputedRef, inject } from 'vue'
import Botao from './Botao.vue'
import ModalArea from './ModalArea.vue'

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')!
interface ModalPerdeuTodosProps {
  fecharRaspadinha?: () => void
}

const props = defineProps<ModalPerdeuTodosProps>()
const emits = defineEmits<{
  (e: 'comprarMaisChances'): void
}>()

const tema = computed(() => CONFIG_RASPADINHA.value.tema)
const cores = computed(() => modalCores(tema))
const urlProdAdquiridos = computed(() => CONFIG_RASPADINHA.value.urlProdAdquiridos)
const projetoCheckout = computed(() => CONFIG_RASPADINHA.value.projeto === 'checkout')
</script>
