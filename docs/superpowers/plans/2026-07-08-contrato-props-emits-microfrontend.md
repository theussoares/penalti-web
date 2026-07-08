# Contrato de props/emits do PenaltyGame — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `PenaltyGame.client.vue` num componente puro de apresentação — sem fetch próprio — que recebe a sequência inteira de resultados via prop `resultados` e emite `fechar` quando a sessão termina, preparando o terreno pro próximo spec (empacotamento Module Federation).

**Architecture:** O jogo deixa de ter qualquer noção de API/mock/query-string. Toda a lógica de sessão (`useGameSession`) passa a ser inicializada diretamente do array recebido via prop, sem estados de "carregando" ou "reiniciar". Fim de sessão (último chute individual ou "chutar tudo" — os dois únicos jeitos de a fila esvaziar) vira um fluxo único: modal de resumo (se ganhou algo) ou modal "sem prêmio" (se não ganhou nada), cujo botão dispara o emit `fechar`. `pages/index.vue` passa a simular o papel do Host: gera os dados mock e re-monta o componente a cada `fechar`.

**Tech Stack:** Nuxt 4 / Vue 3 (`<script setup>`), Vitest (`vitest run`, ambiente `node`, specs em `app/**/*.spec.ts`), TypeScript.

## Global Constraints

- Sem streaming/paginação de resultados no meio da sessão — o Host sempre entrega o array completo antes da montagem (spec, seção "Contrato de dados").
- `chancesRestantes()`/`isSessionOver()`/`filtrarPremiosGanhados()` em `app/game/session.ts` não mudam de assinatura (spec, seção "Contrato de dados").
- Único prop de entrada: `resultados: PenaltyPlayResult[]`. Único emit de saída: `fechar: []`. Nenhum dado de prêmio volta pro Host no emit (spec, seção "Contrato de dados").
- Nenhuma lógica de "jogar novamente"/reset dentro do componente — uma instância serve exatamente uma sessão (spec, seção "Fim de sessão e modais").
- Arquivos de mock/dev (`USE_MOCK`, `pickScenario`, query string `?cenario=`/`?api=`) só podem viver em `pages/index.vue`/`app/mocks/`, nunca em `PenaltyGame.client.vue` ou nos composables de sessão (spec, seção "Harness de dev").

---

## Task A: Corrigir imports quebrados e remover arquivos órfãos

O refactor em andamento já deletou `app/composables/useGameApi.ts`, mas 4 arquivos ainda importam tipos dele — isso quebra a build agora mesmo. Esta tarefa só corrige essas referências e remove lixo órfão; não muda nenhum comportamento.

**Files:**
- Modify: `app/mocks/penaltySequences.ts:1`
- Modify: `app/game/session.spec.ts:3`
- Modify: `app/components/Modais/ModalGol.vue:38`
- Modify: `app/components/HistoricoBar.vue:55`
- Modify: `app/game/engine3d/goalkeeperAI.ts:16-17` (comentário)
- Delete: `app/composables/useGameApi.spec.ts`
- Delete: `app/components/Modais/ModalGanhou.vue`
- Delete: `app/components/Modais/ModalPerdeuTodos.vue`
- Delete: `app/components/Modais/ModalResumo.vue`
- Delete: `app/components/Modais/ModalFecharRaspadinha.vue`
- Delete: `app/components/Modais/ModalRasparTodas.vue`

**Interfaces:**
- Consumes: `PenaltyPlayResult` já existe em `app/types/game.ts` (nenhuma mudança de forma nesta tarefa).
- Produces: nenhuma interface nova — só aponta os imports existentes para o lugar certo.

- [ ] **Step 1: Corrigir o import em `app/mocks/penaltySequences.ts`**

Trocar a linha 1 de:
```ts
import type { PenaltyPlayResult } from '../composables/useGameApi'
```
para:
```ts
import type { PenaltyPlayResult } from '../types/game'
```

- [ ] **Step 2: Corrigir o import em `app/game/session.spec.ts`**

Trocar a linha 3 de:
```ts
import type { PenaltyPlayResult } from '../composables/useGameApi'
```
para:
```ts
import type { PenaltyPlayResult } from '../types/game'
```

- [ ] **Step 3: Corrigir o import em `app/components/Modais/ModalGol.vue`**

Trocar a linha 38 de:
```ts
import type { PenaltyPlayResult } from "~/composables/useGameApi";
```
para:
```ts
import type { PenaltyPlayResult } from "~/types/game";
```

- [ ] **Step 4: Corrigir o import em `app/components/HistoricoBar.vue`**

Trocar a linha 55 de:
```ts
import type { PenaltyPlayResult } from "~/composables/useGameApi";
```
para:
```ts
import type { PenaltyPlayResult } from "~/types/game";
```

- [ ] **Step 5: Corrigir o comentário em `app/game/engine3d/goalkeeperAI.ts`**

Trocar as linhas 16-17 de:
```ts
 * O goleiro nao decide mais o resultado (isso vem pronto da API, ver
 * `PenaltyPlayResult` em `useGameApi.ts`) — so calcula PARA ONDE ele
```
para:
```ts
 * O goleiro nao decide mais o resultado (isso vem pronto da API, ver
 * `PenaltyPlayResult` em `~/types/game.ts`) — so calcula PARA ONDE ele
```

- [ ] **Step 6: Deletar o spec órfão e os 5 modais mortos do Raspadinha**

```bash
git rm app/composables/useGameApi.spec.ts
git rm app/components/Modais/ModalGanhou.vue
git rm app/components/Modais/ModalPerdeuTodos.vue
git rm app/components/Modais/ModalResumo.vue
git rm app/components/Modais/ModalFecharRaspadinha.vue
git rm app/components/Modais/ModalRasparTodas.vue
```

- [ ] **Step 7: Rodar os testes pra confirmar que nada quebrou**

Run: `npm run test:unit`
Expected: todos os testes passam (nenhum arquivo deletado tinha teste próprio que sobreviva; `session.spec.ts` e `penaltySequences.spec.ts` continuam verdes).

- [ ] **Step 8: Commit**

```bash
git add app/mocks/penaltySequences.ts app/game/session.spec.ts app/components/Modais/ModalGol.vue app/components/HistoricoBar.vue app/game/engine3d/goalkeeperAI.ts
git commit -m "fix: corrige imports quebrados apos remocao de useGameApi.ts e remove modais orfaos do Raspadinha"
```

---

## Task B: Criar o harness de mock (`app/mocks/devHostSimulator.ts`)

Extrai a geração de dados mock (hoje espalhada em `app/utils/api-helpers.ts`) para um módulo novo, puro e testável, que `pages/index.vue` vai consumir na Task D. Esta tarefa é só aditiva — não toca em nenhum arquivo existente ainda.

**Files:**
- Create: `app/mocks/devHostSimulator.ts`
- Test: `app/mocks/devHostSimulator.spec.ts`

**Interfaces:**
- Consumes: `PENALTY_SCENARIOS` de `app/mocks/penaltySequences.ts` (`Record<string, PenaltyPlayResult[]>`), `PenaltyPlayResult` de `app/types/game.ts`.
- Produces:
  - `export const MOCK_SESSION_SIZE: number` (valor `5`)
  - `export function mockPlayResult(): PenaltyPlayResult`
  - `export function pickScenario(cenarioKey: string | null, scenarios?: Record<string, PenaltyPlayResult[]>): PenaltyPlayResult[] | null`
  - `export function gerarSessaoMock(count: number, cenarioKey?: string | null): PenaltyPlayResult[]`
  — usados pela Task D (`pages/index.vue`).

- [ ] **Step 1: Escrever o spec (falhando, o módulo ainda não existe)**

Criar `app/mocks/devHostSimulator.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { gerarSessaoMock, mockPlayResult, pickScenario } from './devHostSimulator'
import { PENALTY_SCENARIOS } from './penaltySequences'

describe('mockPlayResult', () => {
  it('gera itens no formato PenaltyPlayResult', () => {
    for (let i = 0; i < 50; i++) {
      const r = mockPlayResult()
      expect(typeof r.id).toBe('number')
      expect(typeof r.chave_giro).toBe('string')
      expect(['ganhou', 'nao_ganhou', 'replay']).toContain(r.tipo_acao)
      expect(['valor', 'cota', 'nao_ganhou', 'replay']).toContain(r.tipo_premio)
      expect(typeof r.nome).toBe('string')
      expect(r.valor === null || typeof r.valor === 'string').toBe(true)
    }
  })

  it('tipo_acao e tipo_premio sempre combinam ("nao_ganhou"/"replay" batem, "ganhou" nunca vem com eles)', () => {
    for (let i = 0; i < 100; i++) {
      const r = mockPlayResult()
      if (r.tipo_acao === 'nao_ganhou') expect(r.tipo_premio).toBe('nao_ganhou')
      if (r.tipo_acao === 'replay') expect(r.tipo_premio).toBe('replay')
      if (r.tipo_acao === 'ganhou') {
        expect(r.tipo_premio).not.toBe('nao_ganhou')
        expect(r.tipo_premio).not.toBe('replay')
      }
    }
  })
})

describe('pickScenario', () => {
  it('retorna null quando a chave e null', () => {
    expect(pickScenario(null)).toBeNull()
  })

  it('retorna null quando a chave nao existe em nenhum cenario', () => {
    expect(pickScenario('chave-inexistente')).toBeNull()
  })

  it('retorna uma copia do cenario quando a chave existe', () => {
    const resultado = pickScenario('todas_derrotas')
    expect(resultado).toEqual(PENALTY_SCENARIOS.todas_derrotas)
    expect(resultado).not.toBe(PENALTY_SCENARIOS.todas_derrotas)
  })
})

describe('gerarSessaoMock', () => {
  it('retorna o cenario fixo quando a chave existe', () => {
    const resultado = gerarSessaoMock(5, 'todos_replays')
    expect(resultado).toEqual(PENALTY_SCENARIOS.todos_replays)
  })

  it('gera exatamente `count` itens aleatorios quando nao ha cenario', () => {
    const resultado = gerarSessaoMock(15, null)
    expect(resultado).toHaveLength(15)
  })

  it('gera exatamente `count` itens quando cenarioKey nao e passado', () => {
    const resultado = gerarSessaoMock(8)
    expect(resultado).toHaveLength(8)
  })
})
```

- [ ] **Step 2: Rodar o spec e confirmar que falha (módulo não existe)**

Run: `npx vitest run app/mocks/devHostSimulator.spec.ts`
Expected: FAIL com erro de módulo/arquivo `./devHostSimulator` não encontrado.

- [ ] **Step 3: Implementar `app/mocks/devHostSimulator.ts`**

```ts
import { PENALTY_SCENARIOS } from './penaltySequences'
import type { PenaltyPlayResult } from '~/types/game'

/** Tamanho da sessao mock gerada pelo harness de dev (`pages/index.vue`). */
export const MOCK_SESSION_SIZE = 5

const REPLAY_CHANCE = 0.1
const WIN_CHANCE = 0.35
const MONEY_PRIZES = ['R$ 5,00', 'R$ 10,00', 'R$ 25,00', 'R$ 50,00', 'R$ 100,00']
const COTA_PRIZES = ['1 Cota', '3 Cotas', '5 Cotas', '10 Cotas']

let mockIdCounter = 0

export function mockPlayResult(): PenaltyPlayResult {
  const id = ++mockIdCounter
  const chave_giro = `penalti_${id}`
  if (Math.random() < REPLAY_CHANCE) {
    return { id, chave_giro, tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Chute Extra!', valor: null }
  }
  if (Math.random() >= WIN_CHANCE) {
    return { id, chave_giro, tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Nao foi dessa vez', valor: null }
  }
  if (Math.random() < 0.4) {
    const nome = COTA_PRIZES[Math.floor(Math.random() * COTA_PRIZES.length)]!
    return { id, chave_giro, tipo_acao: 'ganhou', tipo_premio: 'cota', nome, valor: nome.split(' ')[0]! }
  }
  const nome = MONEY_PRIZES[Math.floor(Math.random() * MONEY_PRIZES.length)]!
  return { id, chave_giro, tipo_acao: 'ganhou', tipo_premio: 'valor', nome, valor: nome.replace(/[^\d,]/g, '') }
}

/**
 * Resolve um cenario fixo a partir da chave lida da query string.
 */
export function pickScenario(
  cenarioKey: string | null,
  scenarios: Record<string, PenaltyPlayResult[]> = PENALTY_SCENARIOS
): PenaltyPlayResult[] | null {
  if (!cenarioKey) return null
  const cenario = scenarios[cenarioKey]
  return cenario ? [...cenario] : null
}

/**
 * Gera a sessao mock inteira que o harness de dev passa como prop `resultados`
 * pro PenaltyGame — cenario fixo se `cenarioKey` bater com PENALTY_SCENARIOS,
 * senao `count` itens aleatorios.
 */
export function gerarSessaoMock(count: number, cenarioKey: string | null = null): PenaltyPlayResult[] {
  const cenario = pickScenario(cenarioKey)
  if (cenario) return cenario
  return Array.from({ length: count }, mockPlayResult)
}
```

- [ ] **Step 4: Rodar o spec e confirmar que passa**

Run: `npx vitest run app/mocks/devHostSimulator.spec.ts`
Expected: PASS (todos os `it` verdes).

- [ ] **Step 5: Commit**

```bash
git add app/mocks/devHostSimulator.ts app/mocks/devHostSimulator.spec.ts
git commit -m "feat: adiciona devHostSimulator.ts, harness de mock puro pro pages/index.vue"
```

---

## Task C: Contrato props/emits — composables, modais e `PenaltyGame.client.vue`

Este é o núcleo do spec: `useGameSession`/`useChutarTudo`/`useGameModals` param de receber o array pronto (sem fetch), o fim de sessão vira um fluxo único (resumo ou sem-prêmio), e `PenaltyGame.client.vue` ganha o prop `resultados` e o emit `fechar`.

**Files:**
- Modify: `app/types/game.ts` (remove `GameInfo`)
- Modify: `app/composables/game/useGameSession.ts`
- Create: `app/composables/game/useGameSession.spec.ts`
- Modify: `app/composables/game/useChutarTudo.ts`
- Modify: `app/composables/game/useChutarTudo.spec.ts` (criar — não existia)
- Modify: `app/composables/game/useGameModals.ts`
- Modify: `app/components/Modais/ModalGol.vue`
- Modify: `app/components/Modais/ModalDefendeu.vue`
- Modify: `app/components/Modais/ModalChuteExtra.vue`
- Rename+Modify: `app/components/Modais/ModalResumoChutarTudo.vue` → `app/components/Modais/ModalResumoSessao.vue`
- Create: `app/components/Modais/ModalSemPremio.vue`
- Modify: `app/components/PenaltyGame.client.vue`

**Interfaces:**
- Consumes: `PenaltyPlayResult` de `~/types/game` (id, chave_giro, tipo_acao, tipo_premio, nome, valor); `chancesRestantes`, `isSessionOver`, `filtrarPremiosGanhados`, `PremioGanho` de `~/game/session` (assinaturas inalteradas).
- Produces:
  - `useGameSession(resultados: PenaltyPlayResult[]): { playQueue: Ref<PenaltyPlayResult[]>, history: Ref<PenaltyPlayResult[]>, currentPlayResult: Ref<PenaltyPlayResult | null>, chancesRestantesValue: ComputedRef<number>, sessaoEncerrada: ComputedRef<boolean>, consumeNextPlay(): PenaltyPlayResult | null, registerPlayedResult(): void }`
  - `useChutarTudo(playQueue: Ref<PenaltyPlayResult[]>, history: Ref<PenaltyPlayResult[]>, chancesRestantesValue: Ref<number>, engineState: Ref<string>): { podeChutarTudo: ComputedRef<boolean>, processAllRemainingPlays(): void }`
  - `ModalState` ganha `'resumo-sessao' | 'sem-premio'` no lugar de `'resumo-tudo'`; `useGameModals()` ganha `openResumoSessao()`/`openSemPremio()` no lugar de `openResumoTudo()`.
  - `<PenaltyGame :resultados="PenaltyPlayResult[]" @fechar="..." />` — usado pela Task D.

- [ ] **Step 1: Remover `GameInfo` de `app/types/game.ts`**

Arquivo final (`app/types/game.ts`):
```ts
export interface PenaltyPlayResult {
  id: number
  /** Identificador unico da jogada, mesmo padrao dos mocks de Roleta. */
  chave_giro: string
  tipo_acao: 'ganhou' | 'nao_ganhou' | 'replay'
  tipo_premio: 'valor' | 'cota' | 'nao_ganhou' | 'replay'
  /** Texto de exibicao, ex: "R$ 50,00" ou "5 Cotas". */
  nome: string
  valor: string | null
}
```

- [ ] **Step 2: Escrever o spec de `useGameSession` (falhando — a assinatura ainda e a antiga)**

Criar `app/composables/game/useGameSession.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { useGameSession } from './useGameSession'
import type { PenaltyPlayResult } from '../../types/game'

function item(overrides: Partial<PenaltyPlayResult>): PenaltyPlayResult {
  return {
    id: 1,
    chave_giro: 'x',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    nome: 'Nao foi dessa vez',
    valor: null,
    ...overrides
  }
}

describe('useGameSession', () => {
  it('inicializa a fila a partir de `resultados`, sem fetch', () => {
    const resultados = [item({ id: 1 }), item({ id: 2, tipo_acao: 'ganhou', tipo_premio: 'valor' })]
    const { chancesRestantesValue, sessaoEncerrada } = useGameSession(resultados)
    expect(chancesRestantesValue.value).toBe(2)
    expect(sessaoEncerrada.value).toBe(false)
  })

  it('consumeNextPlay tira o proximo item da fila e vira currentPlayResult', () => {
    const resultados = [item({ id: 1 }), item({ id: 2 })]
    const { consumeNextPlay, currentPlayResult, chancesRestantesValue } = useGameSession(resultados)
    const resultado = consumeNextPlay()
    expect(resultado?.id).toBe(1)
    expect(currentPlayResult.value?.id).toBe(1)
    expect(chancesRestantesValue.value).toBe(1)
  })

  it('consumeNextPlay retorna null quando a fila ja esta vazia', () => {
    const { consumeNextPlay } = useGameSession([])
    expect(consumeNextPlay()).toBeNull()
  })

  it('registerPlayedResult acumula o item atual no history', () => {
    const resultados = [item({ id: 1 })]
    const { consumeNextPlay, registerPlayedResult, history } = useGameSession(resultados)
    consumeNextPlay()
    registerPlayedResult()
    expect(history.value).toHaveLength(1)
    expect(history.value[0]?.id).toBe(1)
  })

  it('sessaoEncerrada fica true quando a fila esvazia', () => {
    const resultados = [item({ id: 1 })]
    const { consumeNextPlay, registerPlayedResult, sessaoEncerrada } = useGameSession(resultados)
    expect(sessaoEncerrada.value).toBe(false)
    consumeNextPlay()
    registerPlayedResult()
    expect(sessaoEncerrada.value).toBe(true)
  })

  it('nao muta o array original recebido por prop', () => {
    const resultados = [item({ id: 1 }), item({ id: 2 })]
    const { consumeNextPlay } = useGameSession(resultados)
    consumeNextPlay()
    expect(resultados).toHaveLength(2)
  })
})
```

- [ ] **Step 3: Rodar o spec e confirmar que falha**

Run: `npx vitest run app/composables/game/useGameSession.spec.ts`
Expected: FAIL (chamar `useGameSession(resultados)` com a assinatura antiga `useGameSession()` sem argumento não inicializa a fila a partir do array).

- [ ] **Step 4: Reescrever `app/composables/game/useGameSession.ts`**

```ts
import { ref, computed } from 'vue'
import type { PenaltyPlayResult } from '~/types/game'
import { chancesRestantes, isSessionOver } from '~/game/session'

export function useGameSession(resultados: PenaltyPlayResult[]) {
  const playQueue = ref<PenaltyPlayResult[]>([...resultados])
  const history = ref<PenaltyPlayResult[]>([])
  const currentPlayResult = ref<PenaltyPlayResult | null>(null)

  const chancesRestantesValue = computed(() => chancesRestantes(playQueue.value))
  const sessaoEncerrada = computed(() => isSessionOver(playQueue.value))

  function consumeNextPlay(): PenaltyPlayResult | null {
    if (playQueue.value.length === 0) return null
    const result = playQueue.value.shift()!
    currentPlayResult.value = result
    return result
  }

  function registerPlayedResult() {
    if (currentPlayResult.value) {
      history.value.push(currentPlayResult.value)
    }
  }

  return {
    playQueue,
    history,
    currentPlayResult,
    chancesRestantesValue,
    sessaoEncerrada,
    consumeNextPlay,
    registerPlayedResult
  }
}
```

- [ ] **Step 5: Rodar o spec e confirmar que passa**

Run: `npx vitest run app/composables/game/useGameSession.spec.ts`
Expected: PASS.

- [ ] **Step 6: Escrever o spec de `useChutarTudo` (falhando — arquivo ainda espera `awaitingSequence` e expõe `premiosChutarTudo`)**

Criar `app/composables/game/useChutarTudo.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useChutarTudo } from './useChutarTudo'
import type { PenaltyPlayResult } from '../../types/game'

function item(overrides: Partial<PenaltyPlayResult>): PenaltyPlayResult {
  return {
    id: 1,
    chave_giro: 'x',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    nome: 'x',
    valor: null,
    ...overrides
  }
}

describe('useChutarTudo', () => {
  it('podeChutarTudo e falso com 1 ou 0 chances restantes', () => {
    const playQueue = ref<PenaltyPlayResult[]>([item({})])
    const history = ref<PenaltyPlayResult[]>([])
    const chancesRestantesValue = ref(1)
    const engineState = ref('ready')
    const { podeChutarTudo } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    expect(podeChutarTudo.value).toBe(false)
  })

  it('podeChutarTudo e verdadeiro com mais de 1 chance e motor pronto', () => {
    const playQueue = ref<PenaltyPlayResult[]>([item({}), item({})])
    const history = ref<PenaltyPlayResult[]>([])
    const chancesRestantesValue = ref(2)
    const engineState = ref('ready')
    const { podeChutarTudo } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    expect(podeChutarTudo.value).toBe(true)
  })

  it('podeChutarTudo e falso enquanto o motor esta animando', () => {
    const playQueue = ref<PenaltyPlayResult[]>([item({}), item({})])
    const history = ref<PenaltyPlayResult[]>([])
    const chancesRestantesValue = ref(2)
    const engineState = ref('strike')
    const { podeChutarTudo } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    expect(podeChutarTudo.value).toBe(false)
  })

  it('processAllRemainingPlays move tudo da fila pro history, preservando o que ja tinha', () => {
    const jaJogado = item({ id: 1, tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 10,00' })
    const restante1 = item({ id: 2, tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 20,00' })
    const restante2 = item({ id: 3 })
    const playQueue = ref<PenaltyPlayResult[]>([restante1, restante2])
    const history = ref<PenaltyPlayResult[]>([jaJogado])
    const chancesRestantesValue = ref(2)
    const engineState = ref('ready')
    const { processAllRemainingPlays } = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)
    processAllRemainingPlays()
    expect(playQueue.value).toHaveLength(0)
    expect(history.value).toEqual([jaJogado, restante1, restante2])
  })
})
```

- [ ] **Step 7: Rodar o spec e confirmar que falha**

Run: `npx vitest run app/composables/game/useChutarTudo.spec.ts`
Expected: FAIL (assinatura atual de `useChutarTudo` exige 5 argumentos incluindo `awaitingSequence`, o teste passa só 4).

- [ ] **Step 8: Reescrever `app/composables/game/useChutarTudo.ts`**

```ts
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { PenaltyPlayResult } from '~/types/game'

export function useChutarTudo(
  playQueue: Ref<PenaltyPlayResult[]>,
  history: Ref<PenaltyPlayResult[]>,
  chancesRestantesValue: Ref<number>,
  engineState: Ref<string>
) {
  const podeChutarTudo = computed(
    () =>
      chancesRestantesValue.value > 1 &&
      (engineState.value === 'ready' || engineState.value === 'aiming')
  )

  function processAllRemainingPlays() {
    const consumidos = playQueue.value.splice(0)
    history.value.push(...consumidos)
  }

  return {
    podeChutarTudo,
    processAllRemainingPlays
  }
}
```

- [ ] **Step 9: Rodar o spec e confirmar que passa**

Run: `npx vitest run app/composables/game/useChutarTudo.spec.ts`
Expected: PASS.

- [ ] **Step 10: Reescrever `app/composables/game/useGameModals.ts`**

```ts
import { ref } from 'vue'

export type ModalState =
  | 'none'
  | 'gol'
  | 'defendeu'
  | 'chute-extra'
  | 'chutar-tudo-confirmar'
  | 'chutar-tudo-progresso'
  | 'resumo-sessao'
  | 'sem-premio'

export function useGameModals() {
  const modal = ref<ModalState>('none')

  function closeModal() {
    modal.value = 'none'
  }

  function openGolModal() {
    modal.value = 'gol'
  }

  function openDefendeuModal() {
    modal.value = 'defendeu'
  }

  function openChuteExtraModal() {
    modal.value = 'chute-extra'
  }

  function openChutarTudoConfirm() {
    modal.value = 'chutar-tudo-confirmar'
  }

  function openChutarTudoProgresso() {
    modal.value = 'chutar-tudo-progresso'
  }

  function openResumoSessao() {
    modal.value = 'resumo-sessao'
  }

  function openSemPremio() {
    modal.value = 'sem-premio'
  }

  return {
    modal,
    closeModal,
    openGolModal,
    openDefendeuModal,
    openChuteExtraModal,
    openChutarTudoConfirm,
    openChutarTudoProgresso,
    openResumoSessao,
    openSemPremio
  }
}
```

- [ ] **Step 11: Simplificar `app/components/Modais/ModalGol.vue` (remover `ultimaChance`, corrigido na Task A)**

No `<template>`, trocar:
```html
    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Continuar jogando'"
      @click="$emit('continuar')"
    />
```
por:
```html
    <Botao titulo="Continuar jogando" @click="$emit('continuar')" />
```

No `<script setup>`, trocar:
```ts
defineProps<{ premio: PenaltyPlayResult | null; ultimaChance: boolean }>();
```
por:
```ts
defineProps<{ premio: PenaltyPlayResult | null }>();
```

- [ ] **Step 12: Simplificar `app/components/Modais/ModalDefendeu.vue` (remover `ultimaChance`)**

No `<template>`, trocar:
```html
    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Tentar novamente'"
      @click="$emit('continuar')"
    />
```
por:
```html
    <Botao titulo="Tentar novamente" @click="$emit('continuar')" />
```

No `<script setup>`, trocar:
```ts
defineProps<{ ultimaChance: boolean }>();
```
por (o componente não recebe mais nenhuma prop):
```ts
defineEmits<{ continuar: [] }>();
```
(remove a linha `defineProps<...>()` inteira, mantendo só o `defineEmits`.)

- [ ] **Step 13: Simplificar `app/components/Modais/ModalChuteExtra.vue` (remover `ultimaChance`)**

No `<template>`, trocar:
```html
    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Continuar jogando'"
      @click="$emit('continuar')"
    />
```
por:
```html
    <Botao titulo="Continuar jogando" @click="$emit('continuar')" />
```

No `<script setup>`, trocar:
```ts
defineProps<{ ultimaChance: boolean }>();
defineEmits<{ continuar: [] }>();
```
por:
```ts
defineEmits<{ continuar: [] }>();
```

- [ ] **Step 14: Renomear `ModalResumoChutarTudo.vue` para `ModalResumoSessao.vue`**

```bash
git mv app/components/Modais/ModalResumoChutarTudo.vue app/components/Modais/ModalResumoSessao.vue
```

Substituir o conteúdo inteiro de `app/components/Modais/ModalResumoSessao.vue` por:
```vue
<template>
  <ModalArea aria-label="Resumo da sessao" variant="win">
    <h2 class="card-title">Resumo da sessao</h2>

    <ul class="lista-premios">
      <li v-for="(premio, i) in premios" :key="i" class="item-premio">
        {{ premio.nome }}
      </li>
    </ul>

    <Botao titulo="Fechar" @click="$emit('fechar')" />
  </ModalArea>
</template>

<script setup lang="ts">
import type { PremioGanho } from "~/game/session";
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ premios: PremioGanho[] }>();
defineEmits<{ fechar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
}

.lista-premios {
  margin: 16px 0 4px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.item-premio {
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(
    170deg,
    rgba(255, 210, 63, 0.1),
    rgba(255, 255, 255, 0.04) 45%
  );
  border: 1px solid rgba(255, 210, 63, 0.35);
  color: #8dff5a;
  font-weight: 800;
  font-size: 15px;
}
</style>
```

(Nota: a mensagem de lista vazia "Nenhum premio dessa vez" saiu — esse caminho agora é sempre tratado pelo `ModalSemPremio.vue`, criado no próximo step; este modal só abre quando `premios.length > 0`.)

- [ ] **Step 15: Criar `app/components/Modais/ModalSemPremio.vue`**

```vue
<template>
  <ModalArea aria-label="Sessao sem premio" variant="lose">
    <h2 class="card-title">Nao foi dessa vez</h2>
    <p class="card-sub">
      Voce chutou todas as suas chances sem premio dessa vez. Mais sorte na
      proxima.
    </p>

    <Botao titulo="Fechar" @click="$emit('fechar')" />
  </ModalArea>
</template>

<script setup lang="ts">
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineEmits<{ fechar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0;
  font-size: 30px;
  font-weight: 900;
  color: #fff;
}

.card-sub {
  margin: 10px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}
</style>
```

- [ ] **Step 16: Reescrever `app/components/PenaltyGame.client.vue` (script)**

Substituir todo o bloco `<script setup>` (linhas 1-183 do arquivo atual) por:
```vue
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { ShotOutcome } from '~/game/types'
import type { PenaltyPlayResult } from '~/types/game'
import { filtrarPremiosGanhados } from '~/game/session'
import HistoricoBar from '~/components/HistoricoBar.vue'
import ModalGol from '~/components/Modais/ModalGol.vue'
import ModalDefendeu from '~/components/Modais/ModalDefendeu.vue'
import ModalChuteExtra from '~/components/Modais/ModalChuteExtra.vue'
import ModalChutarTudoConfirm from '~/components/Modais/ModalChutarTudoConfirm.vue'
import ModalResumoSessao from '~/components/Modais/ModalResumoSessao.vue'
import ModalSemPremio from '~/components/Modais/ModalSemPremio.vue'
import confetti from 'canvas-confetti'

import { useGameSession } from '~/composables/game/useGameSession'
import { useGameModals } from '~/composables/game/useGameModals'
import { useGameAudio } from '~/composables/game/useGameAudio'
import { useEngineIntegration } from '~/composables/game/useEngineIntegration'
import { useChutarTudo } from '~/composables/game/useChutarTudo'

const props = defineProps<{ resultados: PenaltyPlayResult[] }>()
const emit = defineEmits<{ fechar: [] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const DESKTOP_BREAKPOINT = 565
const isDesktopLayout = ref(false)
const bgImage = computed(() =>
  isDesktopLayout.value ? '/images/stadium-bg-landscape.webp' : '/images/stadium-bg-portrait.webp'
)

function updateLayoutMode() {
  isDesktopLayout.value = window.innerWidth > DESKTOP_BREAKPOINT
}

const {
  playQueue,
  history,
  currentPlayResult,
  chancesRestantesValue,
  sessaoEncerrada,
  consumeNextPlay,
  registerPlayedResult
} = useGameSession(props.resultados)

const {
  modal,
  closeModal,
  openGolModal,
  openDefendeuModal,
  openChuteExtraModal,
  openChutarTudoConfirm,
  openChutarTudoProgresso,
  openResumoSessao,
  openSemPremio
} = useGameModals()

const {
  sfx,
  muted,
  toggleMute,
  handleVisibilityChange,
  destroyAudio
} = useGameAudio()

const {
  engineState,
  mountEngine,
  shoot,
  resetEngine,
  destroyEngine
} = useEngineIntegration()

const {
  podeChutarTudo,
  processAllRemainingPlays
} = useChutarTudo(playQueue, history, chancesRestantesValue, engineState)

const premiosSessao = computed(() => filtrarPremiosGanhados(history.value))

const jumboState = computed(() => {
  if (modal.value === 'none' || !currentPlayResult.value) return 'idle'
  return currentPlayResult.value.tipo_acao
})

function onShootClick() {
  if (modal.value !== 'none') return
  const result = consumeNextPlay()
  if (!result) return
  const engineOutcome: ShotOutcome = result.tipo_acao === 'ganhou' ? 'goal' : 'save'
  shoot(engineOutcome)
}

function abrirResumoFinal() {
  if (premiosSessao.value.length > 0) {
    openResumoSessao()
  } else {
    openSemPremio()
  }
}

function onResult(outcome: ShotOutcome) {
  const result = currentPlayResult.value
  if (!result) return
  registerPlayedResult()

  if (sessaoEncerrada.value) {
    abrirResumoFinal()
    return
  }

  if (result.tipo_acao === 'ganhou') {
    openGolModal()
    sfx.playWinModal()
    sfx.stopGoalCrowd()
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.65, x: 0.5 },
      colors: ['#ffd700', '#32ff64', '#ffffff'],
      zIndex: 2000,
      disableForReducedMotion: true
    })
  } else if (result.tipo_acao === 'replay') {
    openChuteExtraModal()
  } else {
    openDefendeuModal()
  }
}

function onModalContinuar() {
  closeModal()
  currentPlayResult.value = null
  resetEngine()
  sfx.whistle()
}

function onFecharJogo() {
  emit('fechar')
}

function abrirChutarTudoConfirm() {
  if (!podeChutarTudo.value) return
  openChutarTudoConfirm()
}

function confirmarChutarTudo() {
  openChutarTudoProgresso()
  setTimeout(() => {
    processAllRemainingPlays()
    abrirResumoFinal()
  }, 1500)
}

onMounted(() => {
  updateLayoutMode()
  window.addEventListener('resize', updateLayoutMode)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  if (!canvasRef.value) return
  mountEngine(canvasRef.value, {
    onResult,
    onStateChange: (s) => {
      if (s === 'aiming') sfx.startAmbient()
    },
    onKick: () => sfx.kick(),
    onImpact: (outcome) => {
      if (outcome === 'goal') {
        sfx.roar()
        sfx.playGoalCrowd()
      } else {
        sfx.groan()
      }
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateLayoutMode)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  destroyEngine()
  destroyAudio()
})
</script>
```

- [ ] **Step 17: Atualizar o `<template>` de `PenaltyGame.client.vue`**

Remover `:ultima-chance="sessaoEncerrada"` das 3 ocorrências (`ModalGol`, `ModalDefendeu`, `ModalChuteExtra`) — trocar:
```html
      <Transition name="modal">
        <ModalGol
          v-if="modal === 'gol'"
          :premio="currentPlayResult"
          :ultima-chance="sessaoEncerrada"
          @continuar="onModalContinuar"
        />
      </Transition>

      <!-- Modal de derrota -->
      <Transition name="modal">
        <ModalDefendeu
          v-if="modal === 'defendeu'"
          :ultima-chance="sessaoEncerrada"
          @continuar="onModalContinuar"
        />
      </Transition>

      <!-- Modal de chute extra (replay) -->
      <Transition name="modal">
        <ModalChuteExtra
          v-if="modal === 'chute-extra'"
          :ultima-chance="sessaoEncerrada"
          @continuar="onModalContinuar"
        />
      </Transition>
```
por:
```html
      <Transition name="modal">
        <ModalGol
          v-if="modal === 'gol'"
          :premio="currentPlayResult"
          @continuar="onModalContinuar"
        />
      </Transition>

      <!-- Modal de derrota -->
      <Transition name="modal">
        <ModalDefendeu v-if="modal === 'defendeu'" @continuar="onModalContinuar" />
      </Transition>

      <!-- Modal de chute extra (replay) -->
      <Transition name="modal">
        <ModalChuteExtra v-if="modal === 'chute-extra'" @continuar="onModalContinuar" />
      </Transition>
```

Trocar o bloco do resumo do "chutar tudo":
```html
      <!-- Resumo do lote do "Chutar tudo" -->
      <Transition name="modal">
        <ModalResumoChutarTudo
          v-if="modal === 'resumo-tudo'"
          :premios="premiosChutarTudo"
          @continuar="jogarNovamente"
        />
      </Transition>
```
por:
```html
      <!-- Resumo final da sessao (ganhou algo) -->
      <Transition name="modal">
        <ModalResumoSessao
          v-if="modal === 'resumo-sessao'"
          :premios="premiosSessao"
          @fechar="onFecharJogo"
        />
      </Transition>

      <!-- Fim de sessao sem nenhum premio -->
      <Transition name="modal">
        <ModalSemPremio v-if="modal === 'sem-premio'" @fechar="onFecharJogo" />
      </Transition>
```

Trocar o botão "Chutar" (remove o estado de carregamento, que não existe mais):
```html
          <button
            class="hint-badge shoot-btn"
            type="button"
            :disabled="awaitingSequence"
            @click="onShootClick"
          >
            {{ awaitingSequence ? "Carregando..." : "Chutar" }}
          </button>
```
por:
```html
          <button class="hint-badge shoot-btn" type="button" @click="onShootClick">
            Chutar
          </button>
```

- [ ] **Step 18: Rodar a suíte inteira**

Run: `npm run test:unit`
Expected: todos os testes passam, incluindo `useGameSession.spec.ts` e `useChutarTudo.spec.ts` novos.

- [ ] **Step 19: Commit**

```bash
git add app/types/game.ts app/composables/game/useGameSession.ts app/composables/game/useGameSession.spec.ts app/composables/game/useChutarTudo.ts app/composables/game/useChutarTudo.spec.ts app/composables/game/useGameModals.ts app/components/Modais/ModalGol.vue app/components/Modais/ModalDefendeu.vue app/components/Modais/ModalChuteExtra.vue app/components/Modais/ModalResumoSessao.vue app/components/Modais/ModalSemPremio.vue app/components/PenaltyGame.client.vue
git commit -m "feat: PenaltyGame vira componente puro (prop resultados, emit fechar), fim de sessao unificado"
```

---

## Task D: Harness de dev (`pages/index.vue`) e remoção de `app/utils/api-helpers.ts`

Agora que `PenaltyGame` não faz mais fetch/mock sozinho, `pages/index.vue` assume o papel do Host: gera a sessão mock (via `devHostSimulator.ts`, criado na Task B) e re-monta o jogo a cada `fechar`. Com isso, `app/utils/api-helpers.ts` fica sem nenhum consumidor e pode ser removido.

**Files:**
- Modify: `app/pages/index.vue`
- Delete: `app/utils/api-helpers.ts`

**Interfaces:**
- Consumes: `MOCK_SESSION_SIZE`, `gerarSessaoMock` de `~/mocks/devHostSimulator` (Task B); `<PenaltyGame :resultados @fechar>` (Task C).
- Produces: nada consumido por outras tasks — é a ponta final do harness.

- [ ] **Step 1: Confirmar que nada mais importa de `app/utils/api-helpers.ts`**

Run: `grep -rn "utils/api-helpers" app/ --include="*.ts" --include="*.vue"`
Expected: nenhum resultado (o único import restante era `PenaltyGame.client.vue`, já reescrito na Task C).

- [ ] **Step 2: Reescrever `app/pages/index.vue`**

```vue
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
```

- [ ] **Step 3: Remover `app/utils/api-helpers.ts`**

```bash
git rm app/utils/api-helpers.ts
```

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npm run test:unit`
Expected: todos os testes passam (nenhum spec cobre `pages/index.vue` diretamente — Nuxt pages não têm teste unitário nesta suíte).

- [ ] **Step 5: Commit**

```bash
git add app/pages/index.vue
git rm app/utils/api-helpers.ts
git commit -m "feat: pages/index.vue vira harness de dev que simula o Host (mock + remount no fechar)"
```

---

## Task E: Verificação manual no navegador

Nenhum dos specs cobre `.vue` (não há `@vue/test-utils` no projeto) — esta tarefa confirma visualmente que os três caminhos de fim de sessão (resumo com prêmios, sem prêmio, "chutar tudo") funcionam e que não sobrou nenhum resquício da lógica antiga de fetch/reset.

**Files:** nenhum (só verificação).

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Subir o servidor de dev**

Run: `npm run dev`
Expected: servidor sobe sem erro de build (nenhum import quebrado, nenhum tipo faltando).

- [ ] **Step 2: Cenário "sem prêmio" — `?cenario=todas_derrotas`**

Abrir a URL local com `?cenario=todas_derrotas`. Chutar as 5 vezes (uma por uma, sem usar "Chutar tudo"). Esperado: cada chute mostra "Defendeu!"; no 5º chute, em vez do modal "Defendeu!" de novo, abre direto o modal **"Não foi dessa vez"** (`ModalSemPremio`), sem lista de prêmios. Clicar "Fechar" — o jogo remonta sozinho (nova sessão mock, contador de chances volta a mostrar 5).

- [ ] **Step 3: Cenário "resumo com prêmios" — `?cenario=alternado`**

Abrir a URL local com `?cenario=alternado` (ganha valor, perde, replay, ganha cota, perde — 5 itens, sendo o 5º uma derrota). Chutar até o fim. Esperado: no chute que esvazia a fila, abre direto o modal **"Resumo da sessao"** (`ModalResumoSessao`) listando exatamente os 2 prêmios ganhos (`R$ 50,00` e `5 Cotas`), sem incluir o item de derrota nem o de replay.

- [ ] **Step 4: "Chutar tudo" no meio da sessão**

Abrir a URL local sem `?cenario=` (sessão aleatória de 5). Chutar uma vez manualmente, depois clicar em "Chutar tudo" (deve estar habilitado só quando restarem mais de 1 chance real). Esperado: modal de confirmação → barra de progresso → modal final (resumo ou sem-prêmio, dependendo do resultado) considerando **o chute manual de antes + o lote do chutar-tudo**, não só o lote.

- [ ] **Step 5: Console do navegador limpo**

Verificar o console de DevTools durante os passos 2-4.
Expected: nenhum erro (em especial nenhum erro de import não resolvido, nenhum "Cannot read property of undefined" relacionado a `ultimaChance`/`awaitingSequence`/`game`/`GameInfo`).

- [ ] **Step 6: Parar o servidor de dev**

Encerrar o processo do `npm run dev` (Ctrl+C ou matar o processo).

---

## Self-Review (spec coverage)

- Contrato de dados (prop `resultados`, emit `fechar`) → Task C, steps 16-17.
- `chancesRestantes` continua filtrando replay → sem mudança de assinatura em `app/game/session.ts`; coberto pelos specs existentes de `session.spec.ts` (Task A só corrige o import) e pelo novo `useGameSession.spec.ts` (Task C, step 2).
- Fim de sessão unificado (resumo com prêmios / sem prêmio, alimentado por `history` inteiro) → Task C, steps 8 (bug do lote corrigido), 14-15, 16 (`abrirResumoFinal`).
- Remoção de `jogarNovamente`/`resetSession`/`resetEngine` como fluxo de produto → Task C, steps 4 e 16 (não existe mais `resetSession`; `resetEngine` só roda entre chutes intermediários, não no fim de sessão).
- Harness de dev em `pages/index.vue` simulando o Host → Task D.
- Limpeza de imports quebrados e arquivos órfãos → Task A.
- Fora de escopo (Module Federation, emit de progresso por chute, streaming) → não tocado em nenhuma task, como esperado.
