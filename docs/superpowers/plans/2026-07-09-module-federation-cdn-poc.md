# Module Federation CDN POC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Module Federation microfrontend flow end-to-end using the
existing Vercel deployment as a stand-in "CDN" — the game builds as a
standalone remote (`remoteEntry.js`), and a demo Host page in this same
project loads it dynamically at runtime and mounts it via the existing
props/emits contract (`resultados`/`fechar`).

**Architecture:** A second, standalone Vite build (`vite.config.federation.ts`)
exposes `PenaltyGame.client.vue` as a Module Federation remote, writing its
output directly into `public/mf/` so Nuxt's normal `generate` step picks it up
automatically (Nuxt copies everything under `public/` verbatim into the
final site). A new page (`pages/mf-demo.vue`) uses `@module-federation/runtime`
to fetch and mount that remote purely at runtime — no build-time coupling
between the Nuxt app and the remote build.

**Tech Stack:** Vite 8, `@module-federation/vite` (remote build), `@module-federation/runtime` (runtime loading), Vue 3, Nuxt 4 (unaffected by the remote build — it only consumes the runtime API).

## Global Constraints

- No real CDN, no Host repository access, no CSP/CORS hardening in this
  plan — those are documented as future phases in
  `docs/superpowers/specs/2026-07-09-module-federation-cdn-poc-design.md`
  and explicitly out of scope here.
- The existing Vercel standalone deployment (`pages/index.vue` harness) must
  keep working unchanged — this plan is additive.
- The remote build must not go through Nuxt's own Vite/Nitro pipeline — it is
  a separate, plain Vite config, to avoid Nuxt+Module-Federation compatibility
  risk.
- `vue` is declared `shared` on the remote side (so a future real Host that
  also shares `vue` can dedupe it) — this plan does **not** attempt to also
  configure sharing on the demo-host side; the demo page will simply use its
  own bundled Vue in addition to the remote's, which is a known, safe
  simplification for a POC (costs a little extra bundle size, no functional
  risk). Note this explicitly in Task 2's report as a known follow-up.

---

### Task 1: Instalar dependências e configurar o build do remote (Module Federation)

**Files:**
- Modify: `package.json`
- Create: `vite.config.federation.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a `build:mf` npm script that writes `remoteEntry.js` + its chunks
  into `public/mf/`, exposing the module key `./PenaltyGame` (mapped to
  `./app/components/PenaltyGame.client.vue`), remote name `penalti`.
- Consumes: `~`/`@` alias resolving to `./app` (same convention as
  `vitest.config.ts`, already in this repo).

- [ ] **Step 1: Add the new dependencies to `package.json`**

Current `package.json`:
```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nuxt build",
    "dev": "nuxt dev",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "test:unit": "vitest run"
  },
  "dependencies": {
    "@types/canvas-confetti": "^1.9.0",
    "canvas-confetti": "^1.9.4",
    "nuxt": "^4.0.0",
    "three": "^0.185.1",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@gltf-transform/cli": "^4.4.1",
    "@types/three": "^0.185.0",
    "vitest": "^4.1.9"
  }
}
```

Replace it with:
```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nuxt build",
    "dev": "nuxt dev",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "test:unit": "vitest run",
    "build:mf": "vite build --config vite.config.federation.ts"
  },
  "dependencies": {
    "@types/canvas-confetti": "^1.9.0",
    "canvas-confetti": "^1.9.4",
    "nuxt": "^4.0.0",
    "three": "^0.185.1",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@gltf-transform/cli": "^4.4.1",
    "@module-federation/runtime": "^2.7.0",
    "@module-federation/vite": "^1.16.14",
    "@types/three": "^0.185.0",
    "@vitejs/plugin-vue": "^6.0.7",
    "vite": "^8.1.4",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Run `npm install`**

Run: `npm install`
Expected: completes with no errors; `node_modules/@module-federation/vite`,
`node_modules/@module-federation/runtime`, and `node_modules/@vitejs/plugin-vue`
exist afterwards.

- [ ] **Step 3: Create the standalone Vite config for the remote build**

Create `vite.config.federation.ts` at the project root (sibling to
`nuxt.config.ts`):

```ts
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
    emptyOutDir: true
  }
})
```

- [ ] **Step 4: Add `public/mf/` to `.gitignore`**

Current `.gitignore`:
```
node_modules
.nuxt
.output
dist
.env
.DS_Store
*.log
.superpowers
raw-assets
```

Add `public/mf` (this is generated build output, not source):
```
node_modules
.nuxt
.output
dist
.env
.DS_Store
*.log
.superpowers
raw-assets
public/mf
```

- [ ] **Step 5: Run the remote build and verify the output**

Run: `npm run build:mf`
Expected: command exits 0, and `public/mf/remoteEntry.js` exists.

Run: `ls public/mf/`
Expected: `remoteEntry.js` present, plus at least one additional chunk file
(the built `PenaltyGame.client.vue` and its dependencies — engine3d, session
composables, etc).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.federation.ts .gitignore
git commit -m "feat: configura build do jogo como remote de Module Federation (public/mf/)"
```

---

### Task 2: Criar a página de demo do Host (`pages/mf-demo.vue`) e verificar o fluxo no navegador

**Files:**
- Create: `app/pages/mf-demo.vue`

**Interfaces:**
- Consumes: `public/mf/remoteEntry.js` (Task 1's output, served at
  `/mf/remoteEntry.js` by Nuxt's dev server / static output), exposing
  `penalti/PenaltyGame` whose default export is the `PenaltyGame` component
  with prop `resultados: PenaltyPlayResult[]` and emit `fechar: []`.
- Consumes: `gerarSessaoMock(count, cenarioKey)` and `MOCK_SESSION_SIZE` from
  `~/mocks/devHostSimulator` (already exists, used identically by
  `pages/index.vue`).

- [ ] **Step 1: Create the demo host page**

Create `app/pages/mf-demo.vue`:

```vue
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
import { onMounted, ref, shallowRef } from 'vue'
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

onMounted(async () => {
  await init({
    name: 'mf-demo-host',
    remotes: [{ name: 'penalti', entry: '/mf/remoteEntry.js' }]
  })
  const mod = (await loadRemote('penalti/PenaltyGame')) as { default: unknown }
  PenaltyGameRemote.value = mod.default
  resultados.value = gerarSessaoMock(MOCK_SESSION_SIZE, cenarioDaUrl())
})
</script>
```

- [ ] **Step 2: Build the remote (if not already built from Task 1) and start the dev server**

Run: `npm run build:mf`
Expected: `public/mf/remoteEntry.js` exists (same check as Task 1 Step 5).

Run: `npm run dev`
Expected: Nuxt dev server starts on `http://localhost:3000` with no errors.

- [ ] **Step 3: Verify in the browser that the remote loads and the game works end-to-end**

Using the project's preview tooling (`preview_start`/`preview_eval`/
`preview_screenshot`/`preview_console_logs`/`preview_network`, same pattern
used for the props/emits contract's manual verification):

1. Navigate to `http://localhost:3000/mf-demo`.
2. Confirm no console errors (`preview_console_logs` level `error`).
3. Confirm the network tab (`preview_network`) shows a request for
   `/mf/remoteEntry.js` firing from this page specifically (proving the
   remote is fetched at runtime, not bundled upfront).
4. Confirm the game renders and plays through a full session (shoot a few
   times, or use `?cenario=alternado` in the URL, confirm the aggregate
   summary modal appears and `fechar` triggers a fresh session — same
   behavior already verified for `pages/index.vue`).
5. As a sanity check that the remote is genuinely separate from this page's
   own bundle: confirm `http://localhost:3000/` (the existing standalone
   harness) still works unchanged, and that visiting `/mf-demo` is the only
   place that triggers the `/mf/remoteEntry.js` fetch.
6. Confirm Three.js is **not** part of `/mf-demo`'s initial bundle (this is
   an explicit success criterion in the design doc): in `preview_network`,
   list the JS files loaded **before** the `/mf/remoteEntry.js` fetch
   resolves, and confirm none of them reference `three` in the chunk name —
   only after the remote loads should any Three.js-related chunk appear
   (it comes bundled inside the remote's own output, not the host page's).

- [ ] **Step 4: Write up findings**

Document in the task's report:
- Whether the remote loaded successfully and the full session flow worked.
- The known simplification from this plan's Global Constraints (Vue not
  deduped between host page and remote — both bundle their own copy for
  this POC) — confirm this didn't cause any visible issue (e.g., duplicate
  reactivity warnings in console), and note it as a follow-up for the real
  production integration.
- Any deviation from the expected `@module-federation/runtime` API shape
  encountered while implementing (this is a first-time integration in this
  codebase — if `init`/`loadRemote`'s actual signature differs from what's
  written above, record what worked instead).

- [ ] **Step 5: Commit**

```bash
git add app/pages/mf-demo.vue
git commit -m "feat: pagina de demo (Host) que carrega o jogo via Module Federation em tempo de execucao"
```

---

### Task 3: Ligar o build do remote ao pipeline de deploy da Vercel

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `build:mf` script (Task 1), `public/mf/` output.

- [ ] **Step 1: Update the Vercel build command**

Current `vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run generate",
  "outputDirectory": ".output/public"
}
```

Replace with (order matters: `build:mf` must populate `public/mf/` **before**
`generate` runs, since `generate` is what copies `public/` into the final
output):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build:mf && npm run generate",
  "outputDirectory": ".output/public"
}
```

- [ ] **Step 2: Verify the combined build locally**

Run: `npm run build:mf && npm run generate`
Expected: both commands exit 0, and `.output/public/mf/remoteEntry.js`
exists (proving Nuxt's `generate` step copied the remote's output through).

- [ ] **Step 3: Run the full test suite one more time (no regressions)**

Run: `npm run test:unit`
Expected: all existing tests still pass (this plan adds no new unit tests —
it's pure build/deploy tooling — so the count should match the pre-existing
baseline).

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat: liga o build do remote (Module Federation) ao pipeline de deploy da Vercel"
```

- [ ] **Step 5: Push and manually confirm on the deployed Vercel preview**

```bash
git push -u origin feature/module-federation-cdn-poc
```

Then, once Vercel's preview deployment for this branch finishes building,
open `<preview-url>/mf-demo` in a real browser and confirm the same flow
verified locally in Task 2 Step 3 works on the actual deployment (this is
the final proof the "Vercel as test CDN" POC works, matching the design
doc's stated success criteria).
