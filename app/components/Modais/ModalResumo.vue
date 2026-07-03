<template>
  <ModalArea>
    <!-- HERO -->
    <template #header>
      <div class="relative flex flex-col items-center text-center">
        <!-- Banner -->
        <img
          src="../../../../assets/resgate-premios.webp"
          alt=""
          class="absolute -top-32 w-72 pointer-events-none left-[47%] -translate-x-1/2"
        />
      </div>
    </template>

    <!-- CONTEÚDO -->
    <template #conteudo>
      <div class="space-y-4">
        <!-- Resgatado (Futura implementação) -->
        <!-- <div class="rounded-xl bg-white p-4 shadow-sm">
          <h4 class="font-semibold text-gray-700 mb-2">
            Resgatado
          </h4>

          <ul class="space-y-1 text-sm text-gray-600">
            <li
              v-for="(premio, index) in premiosSeparados.valores"
              :key="index"
            >
              • {{ premio.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}
            </li>
          </ul>
        </div> -->

        <!-- Para resgatar -->
        <CardPremiosConfete
          :premios="premiosParaResgatar"
          :nao-tem-premio-valor="naoTemPremioValor"
        />

        <!-- Texto de apoio -->
        <p v-if="projetoCheckout" class="text-sm text-gray-600">
          Resgate seus prêmios agora ou acompanhe sua compra em
          <a
            :href="urlProdAdquiridos"
            class="font-semibold cursor-pointer underline"
            :style="{ color: corPrimaria }"
          >
            Meus Números </a
          >.
        </p>
      </div>
    </template>

    <!-- FOOTER -->
    <template #footer>
      <div class="space-y-2.5">
        <a v-if="projetoCheckout" class="w-full" :href="urlProdAdquiridos">
          <Botao :titulo="naoTemPremioValor ? 'Meus números' : 'Resgatar prêmios'" />
        </a>

        <Botao
          v-if="
            !projetoCheckout &&
            premiosParaResgatar &&
            premiosParaResgatar.length > 0 &&
            !naoTemPremioValor
          "
          titulo="Resgatar prêmios"
          @click="props.fecharRaspadinha?.()"
        />

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
import { computed, ComputedRef, inject } from 'vue'
import CardPremiosConfete from '@/components/Raspadinha/components/resumoPremios/index.vue'
import Botao from './Botao.vue'
import ModalArea from './ModalArea.vue'
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { TipoPremioProps } from '@/types/Roleta'

interface ModalResumoProps {
  premios: { nome: string; tipo_premio: TipoPremioProps; valor: number }[]
  fecharRaspadinha?: () => void
}

const props = defineProps<ModalResumoProps>()
const emits = defineEmits<{
  (e: 'comprarMaisChances'): void
}>()

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')!
const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)
const urlProdAdquiridos = computed(() => CONFIG_RASPADINHA.value.urlProdAdquiridos)
const projetoCheckout = computed(() => CONFIG_RASPADINHA.value.projeto === 'checkout')

const premiosSeparados = computed(() => {
  const cotas = []
  const valores = []
  for (const premio of props.premios) {
    if (premio.tipo_premio === 'valor') valores.push(premio)
    if (premio.tipo_premio === 'cota') cotas.push(premio)
  }
  return { cotas, valores }
})

const extrairValorDoNome = (nome: string): number => {
  // Extrai valor no formato "R$ XX,XX" ou "R$ XX.XXX,XX"
  const match = nome.match(/R\$\s*([\d.,]+)/)
  if (match && match[1]) {
    // Remove pontos (separadores de milhar) e substitui vírgula por ponto
    const valorLimpo = match[1].replace(/\./g, '').replace(',', '.')
    return parseFloat(valorLimpo) || 0
  }
  return 0
}

const naoTemPremioValor = computed(() => premiosSeparados.value.valores.length === 0)

const premiosParaResgatar = computed(() => [
  ...premiosSeparados.value.valores.map((p) => {
    // Extrai valor do nome (ex: "R$ 20,00" -> 20)
    // Se não conseguir, usa o campo valor como fallback
    const numValue =
      extrairValorDoNome(p.nome) ||
      (typeof p.valor === 'string' ? parseFloat(p.valor) : p.valor) ||
      0
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }),
  ...premiosSeparados.value.cotas.map((p) => {
    return `${p.nome}`
  })
])
</script>
