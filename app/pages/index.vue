<template>
  <PenaltyGame :key="sessionKey" :resultados="resultados" @fechar="onFechar" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MOCK_SESSION_SIZE, gerarSessaoMock } from '~/mocks/devHostSimulator'

function cenarioDaUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('cenario')
}

const sessionKey = ref(0)
const resultados = ref(gerarSessaoMock(MOCK_SESSION_SIZE, cenarioDaUrl()))

function onFechar() {
  sessionKey.value++
  resultados.value = gerarSessaoMock(MOCK_SESSION_SIZE, cenarioDaUrl())
}
</script>
