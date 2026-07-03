<template>
  <ModalArea v-if="step === 1" class="!bg-black/50 backdrop-blur-md">
    <template #header>
      <div class="flex flex-col space-y-3">
        <h3
          :style="{ color: cores.titulo }"
          class="flex justify-between text-xl font-semibold leading-5 relative text-start"
        >
          Deseja raspar tudo automaticamente?

          <svg
            @click="emit('fecharModalRasparTodas')"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="cursor-pointer"
          >
            <rect
              x="0.5"
              y="0.5"
              width="23"
              height="23"
              rx="11.5"
              fill="#F3F4F6"
              style="fill: #f3f4f6; fill: color(display-p3 0.9529 0.9569 0.9647); fill-opacity: 1"
            />
            <path
              d="M7 7L17 17"
              stroke="#6B7280"
              style="
                stroke: #6b7280;
                stroke: color(display-p3 0.4196 0.4471 0.502);
                stroke-opacity: 1;
              "
              stroke-width="2"
            />
            <path
              d="M7 17L17 7"
              stroke="#6B7280"
              style="
                stroke: #6b7280;
                stroke: color(display-p3 0.4196 0.4471 0.502);
                stroke-opacity: 1;
              "
              stroke-width="2"
            />
          </svg>
        </h3>
        <p :style="{ color: cores.descricao }" class="text-gray-700 text-sm text-start">
          Seus resultados vão ser entregues a seguir
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center gap-2">
        <Botao titulo="Não" variant="outline" @click="emit('fecharModalRasparTodas')" />
        <Botao @click="scratchAll()" titulo="Sim" />
      </div>
    </template>
  </ModalArea>

  <div
    v-if="step === 2"
    class="fixed inset-0 z-50 flex items-center flex-col gap-5 justify-center bg-black/50 backdrop-blur-md pointer-events-none"
  >
    <div>
      <p class="text-center text-2xl text-white leading-7">
        Estamos Raspando <br />
        {{ textoAtual.sua }} ({{ props.quantidadeRaspadinhas }}) {{ textoAtual.raspadinha }}...
      </p>
    </div>

    <div class="h-2 bg-[#E5E7EB] rounded-full w-[220px] overflow-hidden">
      <div class="w-0 barra-progresso h-2 rounded-full" :style="{ backgroundColor: corPrimaria }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { computed, ComputedRef, inject, ref } from 'vue'
import { modalCores } from '@/constants/coresRaspadinhas'
import Botao from './Botao.vue'
import ModalArea from './ModalArea.vue'

interface ModalRasparTodasProps {
  quantidadeRaspadinhas: number
}

const props = defineProps<ModalRasparTodasProps>()
const emit = defineEmits<{
  fecharModalRasparTodas: []
  rasparTodas: []
}>()

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')
if (!CONFIG_RASPADINHA) {
  throw new Error('CONFIG_RASPADINHA não foi fornecido.')
}

const tema = computed(() => CONFIG_RASPADINHA.value.tema)
const cores = computed(() => modalCores(tema))
const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)
const step = ref(1)

const textos = {
  plural: {
    sua: 'suas',
    raspadinha: 'raspadinhas'
  },
  singular: {
    sua: 'sua',
    raspadinha: 'raspadinha'
  }
}

const textoAtual = props.quantidadeRaspadinhas > 1 ? textos.plural : textos.singular

const scratchAll = () => {
  step.value = 2
  emit('rasparTodas')
}
</script>

<style scoped>
.barra-progresso {
  animation: progress 1.2s ease-in-out forwards;
}

@keyframes progress {
  from {
    width: 0%;
  }

  to {
    width: 100%;
  }
}
</style>
