<template>
  <div v-if="mostrarModal && tipoModalAtual !== 'nada' && !mostrarResumo">
    <ModalGanhou
      v-if="tipoModalAtual === 'cota' || tipoModalAtual === 'valor'"
      :premio="computedPremioAtualValor"
      :proximaRaspadinha="proximaRaspadinha"
    />

    <ModalPerdeuTodos
      v-if="tipoModalAtual === 'perdeuTodos'"
      :setMostrarModal="setMostrarModal"
      :fecharRaspadinha="props.fecharRaspadinha"
      @comprarMaisChances="emits('comprarMaisChances')"
    />
    <ModalErro v-if="tipoModalAtual === 'erro'" :fecharRaspadinha="props.fecharRaspadinha" />
    <ModalReplay v-if="tipoModalAtual === 'replay'" :proximaRaspadinha="proximaRaspadinha" />
  </div>

  <ModalResumo
    v-if="mostrarModal && mostrarResumo"
    :premios="filtrarPremiosGanhados"
    :setMostrarModal="setMostrarModal"
    :fecharRaspadinha="props.fecharRaspadinha"
    @comprarMaisChances="emits('comprarMaisChances')"
  />

  <ModalRasparTodas
    v-if="mostrarModalRasparTodas"
    :quantidadeRaspadinhas="raspadinhasDisponiveis"
    @rasparTodas="emits('rasparTodas')"
    @fecharModalRasparTodas="emits('fecharModalRasparTodas')"
  />

  <ModalFecharRaspadinha
    v-if="mostrarModalFecharRaspadinha"
    :setMostrarModal="setMostrarModal"
    @fecharRaspadinha="emits('fecharRaspadinha')"
    @continuarRaspar="emits('continuarRaspar')"
    @fecharModal="emits('fecharModal')"
  />
</template>

<script setup lang="ts">
import { ConfigRaspadinhaProps, TipoModalRaspadinhaProps } from '@/types/Raspadinha'
import { PremiosRoletaProps } from '@/types/Roleta'
import confetti from 'canvas-confetti'
import { computed, ComputedRef, inject, ref, watch } from 'vue'
import ModalErro from './ModalErro.vue'
import ModalGanhou from './ModalGanhou.vue'
import ModalPerdeuTodos from './ModalPerdeuTodos.vue'
import ModalRasparTodas from './ModalRasparTodas.vue'
import ModalReplay from './ModalReplay.vue'
import ModalResumo from './ModalResumo.vue'
import ModalFecharRaspadinha from './ModalFecharRaspadinha.vue'

interface ModalBaseProps {
  premioAtual: PremiosRoletaProps | null
  raspadinhasDisponiveis: number
  mostrarModal: boolean
  setMostrarModal: (value: boolean) => void
  premiacoes: PremiosRoletaProps[]
  fecharRaspadinha?: () => void
  errorModal: boolean
  proximaRaspadinha: () => void
  historico: PremiosRoletaProps[]
  mostrarModalRasparTodas: boolean
  mostrarModalFecharRaspadinha: boolean
  modoRasparTodas: boolean
}

const props = defineProps<ModalBaseProps>()
const emits = defineEmits<{
  fecharRaspadinha: []
  continuarRaspar: []
  fecharModal: []
  rasparTodas: []
  fecharModalRasparTodas: []
  comprarMaisChances: []
}>()

const computedPremioAtualValor = computed(() => props.premioAtual)
const computedPremiacao = computed(() => props.premiacoes)
const computedRaspadinhasDisponiveis = computed(() => props.raspadinhasDisponiveis)
const computedHistorico = computed(() => props.historico)
const mostrarResumo = ref(false)
const computedErrorModal = computed(() => props.errorModal)

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')
if (!CONFIG_RASPADINHA) {
  throw new Error('CONFIG_RASPADINHA não foi fornecido.')
}

const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)

const nenhumPremioRecebido = computed(() => {
  return (
    computedRaspadinhasDisponiveis.value === 0 &&
    !computedHistorico.value.some((p) => p.tipo_premio === 'cota' || p.tipo_premio === 'valor')
  )
})

const tipoModalAtual = computed((): TipoModalRaspadinhaProps => {
  if (computedErrorModal.value) {
    return 'erro'
  }

  if (nenhumPremioRecebido.value) return 'perdeuTodos'

  const premio = computedPremioAtualValor.value

  if (!premio) return 'nada'
  if (premio?.tipo_premio === 'nao_ganhou') {
    return 'perdeu'
  }
  if (premio?.tipo_premio === 'replay') {
    return 'replay'
  }

  return premio.tipo_premio as TipoModalRaspadinhaProps
})

const modalGanhouVisivel = computed(() => {
  return (
    props.mostrarModal &&
    !mostrarResumo.value &&
    (tipoModalAtual.value === 'cota' || tipoModalAtual.value === 'valor')
  )
})

watch(modalGanhouVisivel, (novoValor, valorAnterior) => {
  if (novoValor && !valorAnterior) {
    ativarConfeti()
  }
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

const filtrarPremiosGanhados = computed(() => {
  return computedPremiacao.value
    .filter(
      (premio) => (premio.tipo_premio === 'valor' || premio.tipo_premio === 'cota') && premio.nome
    )
    .map((premio) => ({
      nome: premio.nome,
      tipo_premio: premio.tipo_premio,
      // Para prêmios de valor, extrai do nome (ex: "R$ 20,00")
      // Para cotas, usa o campo valor normalmente
      valor: premio.tipo_premio === 'valor' 
        ? extrairValorDoNome(premio.nome) || (typeof premio.valor === 'string' ? parseFloat(premio.valor) : premio.valor) || 0
        : (typeof premio.valor === 'string' ? parseFloat(premio.valor) : premio.valor || 0)
    }))
})

watch(computedRaspadinhasDisponiveis, (novoValor) => {
  if (novoValor === 0 && filtrarPremiosGanhados.value.length > 0) {
    mostrarResumo.value = true
    props.setMostrarModal(true)
  }
})

function ativarConfeti() {
  const duration = 500
  const end = Date.now() + duration

  ;(function frame() {
    confetti({
      particleCount: 1,
      spread: 100,
      zIndex: 99,
      gravity: 1.5,
      ticks: 80,
      origin: { y: 0.5 },
      colors: [corPrimaria.value]
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}
</script>
