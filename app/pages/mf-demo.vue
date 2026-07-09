<template>
  <p v-if="!PenaltyGameRemote">Carregando jogo remoto...</p>
  <component
    :is="PenaltyGameRemote"
    v-else
    :key="sessionKey"
    :resultados="resultados"
    @fechar="onFechar"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import * as Vue from 'vue'
import { init, loadRemote } from '@module-federation/runtime'
import { MOCK_SESSION_SIZE, gerarSessaoMock } from '~/mocks/devHostSimulator'
import type { PenaltyPlayResult } from '~/types/game'

/**
 * Pagina de demo que simula um Host real: carrega o jogo em tempo de
 * execucao via Module Federation (nao esta no bundle desta pagina), como
 * prova de conceito do fluxo Remote -> CDN -> Host descrito no spec
 * `docs/superpowers/specs/2026-07-09-module-federation-cdn-poc-design.md`.
 * O `remoteEntry.js` vem de `/mf/remoteEntry.js` -- mesma origem deste
 * deployment, sem precisar de CORS/CSP configurados (isso e' o POC; a
 * versao de producao usaria uma CDN de verdade e um Host em outro dominio).
 */

const PenaltyGameRemote = shallowRef<unknown>(null)
const resultados = ref<PenaltyPlayResult[]>([])
const sessionKey = ref(0)

function cenarioDaUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('cenario')
}

function onFechar() {
  sessionKey.value++
  resultados.value = gerarSessaoMock(MOCK_SESSION_SIZE, cenarioDaUrl())
}

/**
 * Module Federation nao injeta o CSS do remote automaticamente -- o Host
 * precisa carregar isso manualmente. Espera o <link> terminar de carregar
 * (evento `load`) antes de montar o remote: sem esse aguardo, o componente
 * pode renderizar um instante antes do CSS aplicar, o que quebra o
 * `position:absolute` do canvas e causa um loop de resize no motor 3D.
 *
 * O caminho abaixo precisa bater com `assetFileNames` em
 * `vite.config.federation.ts` (nome fixo `penalti-remote.css`) -- os dois
 * nao estao ligados por uma constante compartilhada, entao uma mudanca num
 * dos dois lados exige atualizar o outro.
 */
const CSS_DO_REMOTE = '/mf/assets/penalti-remote.css'
let linkCssRemote: HTMLLinkElement | null = null

function carregarCssDoRemote(): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = CSS_DO_REMOTE
    link.onload = () => resolve()
    link.onerror = () => reject(new Error('Falha ao carregar CSS do remote'))
    document.head.appendChild(link)
    linkCssRemote = link
  })
}

onUnmounted(() => {
  linkCssRemote?.remove()
  linkCssRemote = null
})

onMounted(async () => {
  try {
    await carregarCssDoRemote()
    await init({
      name: 'mf-demo-host',
      // `type: 'module'` -- o remoteEntry.js gerado pelo `@module-federation/vite`
      // (vite.config.federation.ts) e' um ES module de verdade (usa import/export
      // no topo do arquivo), entao o runtime precisa saber pra carrega-lo via
      // `<script type="module">` em vez do `<script>` classico (global var/UMD)
      // que e' o default do runtime pra remotes sem essa flag -- sem isso o
      // browser lanca "Cannot use import statement outside a module".
      remotes: [{ name: 'penalti', entry: '/mf/remoteEntry.js', type: 'module' }],
      shared: {
        vue: { version: '3.5.39', shareConfig: { singleton: true, requiredVersion: '^3.5.0' }, lib: () => Vue }
      }
    })
    const mod = (await loadRemote('penalti/PenaltyGame')) as { default: unknown }
    PenaltyGameRemote.value = mod.default
    resultados.value = gerarSessaoMock(MOCK_SESSION_SIZE, cenarioDaUrl())
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[mf-demo] Falha ao carregar o remote "penalti/PenaltyGame"', e)
  }
})
</script>
