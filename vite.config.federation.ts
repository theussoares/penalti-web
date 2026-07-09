import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { federation } from '@module-federation/vite'

/**
 * Build standalone do jogo como remote de Module Federation — nao passa
 * pelo pipeline Nuxt/Nitro de proposito, pra nao arriscar incompatibilidade
 * entre o plugin de federation e o build SSR/auto-import do Nuxt. So expoe
 * PenaltyGame.client.vue, que ja usa imports explicitos e o mesmo alias `~`
 * do vitest.config.ts.
 */
export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'penalti',
      filename: 'remoteEntry.js',
      exposes: {
        './PenaltyGame': './app/components/PenaltyGame.client.vue'
      },
      shared: ['vue']
    })
  ],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    modulePreload: false,
    // Escreve direto em public/mf/ pra o `nuxt generate` copiar
    // automaticamente pro output final (Nuxt copia tudo que esta em
    // public/ verbatim) -- sem precisar de nenhum passo extra de copia.
    outDir: 'public/mf',
    emptyOutDir: true,
    // Desativa a copia automatica do publicDir pra evitar duplicar assets
    // estaticos (ambient.mp3, crowd.mp3, goal.mp3, images/, models/) em public/mf/
    copyPublicDir: false,
    // Sem isso o Vite tenta default pra ./index.html como entry (nao existe
    // nesse projeto Nuxt); o federation() plugin nao fornece um entry
    // sozinho, entao apontamos pro proprio componente exposto.
    rollupOptions: {
      input: fileURLToPath(new URL('./app/components/PenaltyGame.client.vue', import.meta.url)),
      output: {
        // Nome estavel (sem hash) pro CSS -- o Host precisa referenciar esse
        // arquivo por um caminho previsivel pra injetar o <link> manualmente
        // (Module Federation nao injeta CSS de remotes automaticamente).
        // O nome aqui (`penalti-remote.css`) precisa bater com CSS_DO_REMOTE
        // em app/pages/mf-demo.vue -- os dois nao estao ligados por uma
        // constante compartilhada.
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'assets/penalti-remote.css' : 'assets/[name]-[hash][extname]'
      }
    }
  }
})
