# Jogo profissionalizado: sessão de chances, histórico, chutar tudo, replay e modais da Roleta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o jogo de "infinito" (busca lotes de 10 resultados pra sempre) em uma sessão de chances finita vinda da API, com contador de chances visível, barra de histórico, botão "Chutar tudo" (resolução em lote sem re-animar cada chute), suporte a prêmio de replay ("Chute Extra"), e modais reais (não mais cards inline) estruturados como os da Roleta/Raspadinha da empresa.

**Architecture:** `useGameApi.ts` passa a fazer uma única busca por sessão (`fetchPlaySequence`), com uma nova opção de cenário fixo via `?cenario=` para QA (`app/mocks/penaltySequences.ts`). Lógica pura de sessão (chances restantes, fim de sessão, filtro de prêmios ganhos) vai para `app/game/session.ts`, testável via Vitest. Os modais viram componentes Vue de verdade em `app/components/Modais/` (wrapper `ModalArea.vue` + botão `Botao.vue` reutilizáveis, um componente por tipo de resultado), importados explicitamente (sem depender de auto-import com prefixo de diretório). `PenaltyGame.client.vue` orquestra tudo via uma única máquina de estados de modal (`ModalState`).

**Tech Stack:** Nuxt 4 / Vue 3 (`<script setup>`, Composition API, auto-imports para `ref`/`computed`/`onMounted`/etc.), TypeScript, Vitest (`environment: 'node'`, sem DOM — componentes Vue só são verificados manualmente no navegador).

## Global Constraints

- `ShotOutcome` (motor 3D) continua só `'goal' | 'save'` — não muda. O prêmio de replay usa `'save'` como animação física (arbitrário, aprovado com o usuário), nunca um terceiro valor na engine.
- `PenaltyPlayResult.tipo_acao`/`tipo_premio` ganham o valor `'replay'` (ver spec, seção "Contrato de dados").
- Nenhum `try/catch` novo em torno de chamadas de API real — fora de escopo (pendência já registrada em `docs/superpowers/STATUS.md`).
- Sem Pinia, sem lógica de PIX/checkout/mascote — não existem nesse projeto.
- Componentes novos são importados explicitamente com caminho relativo ou alias `~/...` no `<script setup>` — não depender de auto-import de componentes em subpastas (comportamento de prefixo não confirmado neste projeto).
- Convenção de commit: `git commit --no-gpg-sign` (sem ssh-agent configurado, já autorizado pelo usuário nesta sessão).
- Vitest só cobre lógica pura (`app/**/*.spec.ts`, `environment: 'node'`). Verificação de componentes Vue é sempre manual, via navegador (Claude Preview ou `npm run dev`).

---

## Task 1: Contrato de dados com replay, geração de mock e cenários fixos

**Files:**
- Modify: `app/composables/useGameApi.ts`
- Modify: `app/composables/useGameApi.spec.ts`
- Create: `app/mocks/penaltySequences.ts`
- Create: `app/mocks/penaltySequences.spec.ts`

**Interfaces:**
- Produces: `PenaltyPlayResult` (com `tipo_acao`/`tipo_premio` incluindo `'replay'`), `MOCK_SESSION_SIZE: number`, `pickScenario(cenarioKey: string | null, scenarios?: Record<string, PenaltyPlayResult[]>): PenaltyPlayResult[] | null`, `PENALTY_SCENARIOS: Record<string, PenaltyPlayResult[]>`.

- [ ] **Step 1: Criar os cenários fixos de teste**

Crie `app/mocks/penaltySequences.ts`:

```ts
import type { PenaltyPlayResult } from '../composables/useGameApi'

/**
 * Cenarios fixos para testar fluxos de UI sem depender do gerador aleatorio
 * de useGameApi.ts. Selecionaveis via query string `?cenario=<chave>`
 * (ver pickScenario em useGameApi.ts), so quando USE_MOCK esta ativo.
 */
export const PENALTY_SCENARIOS: Record<string, PenaltyPlayResult[]> = {
  todas_derrotas: [
    { id: 1, chave_giro: 'cenario_derrota_1', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Nao foi dessa vez', valor: null },
    { id: 2, chave_giro: 'cenario_derrota_2', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Tente amanha', valor: null },
    { id: 3, chave_giro: 'cenario_derrota_3', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Melhor sorte na proxima', valor: null },
    { id: 4, chave_giro: 'cenario_derrota_4', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Nao ganhou', valor: null },
    { id: 5, chave_giro: 'cenario_derrota_5', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Sem premio', valor: null }
  ],
  todos_ganhos_valor: [
    { id: 1, chave_giro: 'cenario_valor_1', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 5,00', valor: '5' },
    { id: 2, chave_giro: 'cenario_valor_2', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 10,00', valor: '10' },
    { id: 3, chave_giro: 'cenario_valor_3', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 25,00', valor: '25' },
    { id: 4, chave_giro: 'cenario_valor_4', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 50,00', valor: '50' },
    { id: 5, chave_giro: 'cenario_valor_5', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 100,00', valor: '100' }
  ],
  todos_ganhos_cota: [
    { id: 1, chave_giro: 'cenario_cota_1', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '1 Cota', valor: '1' },
    { id: 2, chave_giro: 'cenario_cota_2', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '3 Cotas', valor: '3' },
    { id: 3, chave_giro: 'cenario_cota_3', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '5 Cotas', valor: '5' },
    { id: 4, chave_giro: 'cenario_cota_4', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '10 Cotas', valor: '10' },
    { id: 5, chave_giro: 'cenario_cota_5', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '2 Cotas', valor: '2' }
  ],
  todos_replays: [
    { id: 1, chave_giro: 'cenario_replay_1', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Chute Extra!', valor: null },
    { id: 2, chave_giro: 'cenario_replay_2', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Mais uma cobranca!', valor: null },
    { id: 3, chave_giro: 'cenario_replay_3', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Continue chutando!', valor: null },
    { id: 4, chave_giro: 'cenario_replay_4', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Sorte sua!', valor: null },
    { id: 5, chave_giro: 'cenario_replay_5', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Ultimo chute extra', valor: null }
  ],
  alternado: [
    { id: 1, chave_giro: 'cenario_alt_1', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 50,00', valor: '50' },
    { id: 2, chave_giro: 'cenario_alt_2', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Nao foi dessa vez', valor: null },
    { id: 3, chave_giro: 'cenario_alt_3', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Chute Extra!', valor: null },
    { id: 4, chave_giro: 'cenario_alt_4', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '5 Cotas', valor: '5' },
    { id: 5, chave_giro: 'cenario_alt_5', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Tente amanha', valor: null }
  ],
  valores_altos: [
    { id: 1, chave_giro: 'cenario_alto_1', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 500,00', valor: '500' },
    { id: 2, chave_giro: 'cenario_alto_2', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 1.000,00', valor: '1000' },
    { id: 3, chave_giro: 'cenario_alto_3', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '50 Cotas Premium', valor: '50' },
    { id: 4, chave_giro: 'cenario_alto_4', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 2.500,00', valor: '2500' },
    { id: 5, chave_giro: 'cenario_alto_5', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '100 Cotas', valor: '100' }
  ],
  replay_depois_ganho: [
    { id: 1, chave_giro: 'cenario_rg_1', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Chute Extra!', valor: null },
    { id: 2, chave_giro: 'cenario_rg_2', tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 75,00', valor: '75' },
    { id: 3, chave_giro: 'cenario_rg_3', tipo_acao: 'replay', tipo_premio: 'replay', nome: 'Mais um chute!', valor: null },
    { id: 4, chave_giro: 'cenario_rg_4', tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '7 Cotas', valor: '7' },
    { id: 5, chave_giro: 'cenario_rg_5', tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou', nome: 'Fim das cobrancas', valor: null }
  ]
}
```

- [ ] **Step 2: Testar o formato dos cenários**

Crie `app/mocks/penaltySequences.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PENALTY_SCENARIOS } from './penaltySequences'

describe('PENALTY_SCENARIOS', () => {
  const chaves = Object.keys(PENALTY_SCENARIOS)

  it('tem os cenarios esperados', () => {
    expect(chaves).toEqual(
      expect.arrayContaining([
        'todas_derrotas',
        'todos_ganhos_valor',
        'todos_ganhos_cota',
        'todos_replays',
        'alternado',
        'valores_altos',
        'replay_depois_ganho'
      ])
    )
  })

  it('cada cenario tem itens no formato PenaltyPlayResult', () => {
    for (const chave of chaves) {
      const cenario = PENALTY_SCENARIOS[chave]!
      expect(cenario.length).toBeGreaterThan(0)
      for (const item of cenario) {
        expect(typeof item.id).toBe('number')
        expect(typeof item.chave_giro).toBe('string')
        expect(['ganhou', 'nao_ganhou', 'replay']).toContain(item.tipo_acao)
        expect(['valor', 'cota', 'nao_ganhou', 'replay']).toContain(item.tipo_premio)
        expect(typeof item.nome).toBe('string')
        expect(item.valor === null || typeof item.valor === 'string').toBe(true)
      }
    }
  })

  it('cada chave_giro e unica dentro do proprio cenario', () => {
    for (const chave of chaves) {
      const cenario = PENALTY_SCENARIOS[chave]!
      const chavesGiro = cenario.map((item) => item.chave_giro)
      expect(new Set(chavesGiro).size).toBe(chavesGiro.length)
    }
  })
})
```

- [ ] **Step 3: Rodar os testes novos e confirmar que passam**

Run: `npm run test:unit -- penaltySequences`
Expected: PASS (3 testes)

- [ ] **Step 4: Reescrever `useGameApi.ts` com replay, `MOCK_SESSION_SIZE` e `pickScenario`**

Substitua o conteúdo completo de `app/composables/useGameApi.ts`:

```ts
/**
 * Camada de dados do jogo.
 *
 * CONTRATO DA API (a implementar no backend):
 *
 *   GET {apiBase}/games
 *     -> { games: GameInfo[] }                        lista de jogos disponiveis
 *
 *   GET {apiBase}/games/{id}/play-sequence?count=N
 *     -> { results: PenaltyPlayResult[] }              sequencia inteira da sessao, ja decidida
 *
 * O resultado de cada chute (ganhou/nao_ganhou/replay + premio) vem pronto
 * do backend antes da jogada — o motor 3D so encena visualmente o que ja foi
 * decidido (ver docs/superpowers/specs/2026-07-03-mira-automatica-resultado-api-design.md
 * e docs/superpowers/specs/2026-07-03-jogo-profissionalizado-design.md).
 * Vocabulario (tipo_acao/tipo_premio/chave_giro) reaproveitado dos mocks de
 * Roleta (app/mocks/index.ts), incluindo o premio de replay ("Chute Extra"),
 * que nao decrementa as chances disponiveis (ver app/game/session.ts).
 *
 * `fetchPlaySequence` e chamado UMA UNICA VEZ por sessao (no primeiro
 * "Chutar" do jogador) e retorna a sequencia inteira ja decidida — nao ha
 * mais reabastecimento automatico (removido nesta rodada).
 *
 * Enquanto a API real nao existe, `USE_MOCK = true` gera sequencias
 * aleatorias localmente. Para plugar a API real basta definir
 * `USE_MOCK = false` e configurar `apiBase` via query string `?api=`.
 * Para testar fluxos especificos manualmente, use `?cenario=<chave>` (ver
 * `app/mocks/penaltySequences.ts` para as chaves disponiveis) — so tem
 * efeito quando USE_MOCK esta ativo.
 */

import { PENALTY_SCENARIOS } from '../mocks/penaltySequences'

export interface GameInfo {
  id: string
  name: string
  description: string
  /** Chamada exibida no topo do jogo, ex: "Valendo R$ 500" */
  headline: string
  active: boolean
}

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

const USE_MOCK = true

/** Tamanho da sequencia buscada no primeiro "Chutar" da sessao (mock). */
export const MOCK_SESSION_SIZE = 5

const MOCK_GAMES: GameInfo[] = [
  {
    id: 'penalty-premiado',
    name: 'Penalti Premiado',
    description: 'Venca o goleiro e ganhe na hora.',
    headline: 'Valendo premios em dinheiro e cotas',
    active: true
  }
]

const REPLAY_CHANCE = 0.1
const WIN_CHANCE = 0.35
const MONEY_PRIZES = ['R$ 5,00', 'R$ 10,00', 'R$ 25,00', 'R$ 50,00', 'R$ 100,00']
const COTA_PRIZES = ['1 Cota', '3 Cotas', '5 Cotas', '10 Cotas']

let mockIdCounter = 0

function mockPlayResult(): PenaltyPlayResult {
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
 * Resolve um cenario fixo de `PENALTY_SCENARIOS` a partir da chave lida da
 * query string `?cenario=`. Extraida como funcao pura (em vez de ler
 * `window.location` diretamente) para ser testavel via Vitest.
 */
export function pickScenario(
  cenarioKey: string | null,
  scenarios: Record<string, PenaltyPlayResult[]> = PENALTY_SCENARIOS
): PenaltyPlayResult[] | null {
  if (!cenarioKey) return null
  const cenario = scenarios[cenarioKey]
  return cenario ? [...cenario] : null
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useGameApi() {
  const apiBase = (() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('api') ?? ''
  })()

  async function fetchGames(): Promise<GameInfo[]> {
    if (USE_MOCK || !apiBase) {
      await delay(120)
      return MOCK_GAMES
    }
    const res = await fetch(`${apiBase}/games`)
    if (!res.ok) throw new Error(`Falha ao carregar jogos: ${res.status}`)
    const data = (await res.json()) as { games: GameInfo[] }
    return data.games
  }

  async function fetchPlaySequence(gameId: string, count: number): Promise<PenaltyPlayResult[]> {
    if (USE_MOCK || !apiBase) {
      await delay(250)
      const cenarioKey =
        typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('cenario')
      const cenario = pickScenario(cenarioKey)
      if (cenario) return cenario
      return Array.from({ length: count }, mockPlayResult)
    }
    const res = await fetch(`${apiBase}/games/${gameId}/play-sequence?count=${count}`)
    if (!res.ok) throw new Error(`Falha ao buscar sequencia de jogadas: ${res.status}`)
    const data = (await res.json()) as { results: PenaltyPlayResult[] }
    return data.results
  }

  return { fetchGames, fetchPlaySequence }
}
```

- [ ] **Step 5: Atualizar `useGameApi.spec.ts` para incluir replay e `pickScenario`**

Substitua o conteúdo completo de `app/composables/useGameApi.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pickScenario, useGameApi } from './useGameApi'
import { PENALTY_SCENARIOS } from '../mocks/penaltySequences'

describe('useGameApi', () => {
  it('fetchPlaySequence retorna exatamente `count` itens no formato PenaltyPlayResult', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 15)
    expect(results).toHaveLength(15)
    for (const r of results) {
      expect(typeof r.id).toBe('number')
      expect(typeof r.chave_giro).toBe('string')
      expect(['ganhou', 'nao_ganhou', 'replay']).toContain(r.tipo_acao)
      expect(['valor', 'cota', 'nao_ganhou', 'replay']).toContain(r.tipo_premio)
      expect(typeof r.nome).toBe('string')
      expect(r.valor === null || typeof r.valor === 'string').toBe(true)
    }
  })

  it('tipo_acao e tipo_premio sempre combinam ("nao_ganhou"/"replay" batem, "ganhou" nunca vem com eles)', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 60)
    for (const r of results) {
      if (r.tipo_acao === 'nao_ganhou') expect(r.tipo_premio).toBe('nao_ganhou')
      if (r.tipo_acao === 'replay') expect(r.tipo_premio).toBe('replay')
      if (r.tipo_acao === 'ganhou') {
        expect(r.tipo_premio).not.toBe('nao_ganhou')
        expect(r.tipo_premio).not.toBe('replay')
      }
    }
  })

  it('gera pelo menos uma vitoria, uma derrota e um replay numa amostra grande', async () => {
    const { fetchPlaySequence } = useGameApi()
    const results = await fetchPlaySequence('penalty-premiado', 120)
    expect(results.some((r) => r.tipo_acao === 'ganhou')).toBe(true)
    expect(results.some((r) => r.tipo_acao === 'nao_ganhou')).toBe(true)
    expect(results.some((r) => r.tipo_acao === 'replay')).toBe(true)
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
```

- [ ] **Step 6: Rodar todos os testes e confirmar que passam**

Run: `npm run test:unit`
Expected: PASS (todos os arquivos `.spec.ts`, incluindo os dois já existentes de `useGameApi` e `penaltySequences`)

- [ ] **Step 7: Commit**

```bash
git add app/composables/useGameApi.ts app/composables/useGameApi.spec.ts app/mocks/penaltySequences.ts app/mocks/penaltySequences.spec.ts
git commit --no-gpg-sign -m "feat: adiciona premio de replay, sessao unica e cenarios fixos de teste em useGameApi"
```

---

## Task 2: Módulo puro de sessão (`app/game/session.ts`)

**Files:**
- Create: `app/game/session.ts`
- Test: `app/game/session.spec.ts`

**Interfaces:**
- Consumes: `PenaltyPlayResult` de `../composables/useGameApi` (Task 1).
- Produces: `chancesRestantes(queue: PenaltyPlayResult[]): number`, `isSessionOver(queue: PenaltyPlayResult[]): boolean`, `PremioGanho` (`{ nome: string; tipo_premio: 'valor' | 'cota'; valor: string | null }`), `filtrarPremiosGanhados(results: PenaltyPlayResult[]): PremioGanho[]`.

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `app/game/session.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { chancesRestantes, filtrarPremiosGanhados, isSessionOver } from './session'
import type { PenaltyPlayResult } from '../composables/useGameApi'

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

describe('chancesRestantes', () => {
  it('conta ganhou e nao_ganhou, mas nao conta replay', () => {
    const fila = [
      item({ tipo_acao: 'ganhou', tipo_premio: 'valor' }),
      item({ tipo_acao: 'replay', tipo_premio: 'replay' }),
      item({ tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou' })
    ]
    expect(chancesRestantes(fila)).toBe(2)
  })

  it('retorna 0 para fila vazia', () => {
    expect(chancesRestantes([])).toBe(0)
  })

  it('retorna 0 quando a fila so tem replays', () => {
    const fila = [item({ tipo_acao: 'replay', tipo_premio: 'replay' })]
    expect(chancesRestantes(fila)).toBe(0)
  })
})

describe('isSessionOver', () => {
  it('true quando a fila esta vazia', () => {
    expect(isSessionOver([])).toBe(true)
  })

  it('false enquanto a fila tiver qualquer item, incluindo so replay', () => {
    expect(isSessionOver([item({ tipo_acao: 'replay', tipo_premio: 'replay' })])).toBe(false)
  })
})

describe('filtrarPremiosGanhados', () => {
  it('inclui apenas ganhou com tipo_premio valor ou cota', () => {
    const resultados = [
      item({ tipo_acao: 'ganhou', tipo_premio: 'valor', nome: 'R$ 50,00', valor: '50' }),
      item({ tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou' }),
      item({ tipo_acao: 'replay', tipo_premio: 'replay' }),
      item({ tipo_acao: 'ganhou', tipo_premio: 'cota', nome: '5 Cotas', valor: '5' })
    ]
    expect(filtrarPremiosGanhados(resultados)).toEqual([
      { nome: 'R$ 50,00', tipo_premio: 'valor', valor: '50' },
      { nome: '5 Cotas', tipo_premio: 'cota', valor: '5' }
    ])
  })

  it('retorna array vazio quando nao ha premios ganhos', () => {
    const resultados = [
      item({ tipo_acao: 'nao_ganhou', tipo_premio: 'nao_ganhou' }),
      item({ tipo_acao: 'replay', tipo_premio: 'replay' })
    ]
    expect(filtrarPremiosGanhados(resultados)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `npm run test:unit -- session`
Expected: FAIL com "Cannot find module './session'" (arquivo ainda não existe)

- [ ] **Step 3: Implementar `app/game/session.ts`**

```ts
import type { PenaltyPlayResult } from '../composables/useGameApi'

/**
 * Chances "reais" restantes na fila — replay nao conta (nao decrementa),
 * mesmo padrao de `girosDisponiveis` na Roleta
 * (play-components-web/src/components/Roleta/composables/useGirarRoleta.ts).
 */
export function chancesRestantes(queue: PenaltyPlayResult[]): number {
  return queue.filter((r) => r.tipo_acao !== 'replay').length
}

/**
 * A sessao so termina quando a fila inteira foi consumida — um replay
 * pendente no fim ainda precisa ser jogado, mesmo que `chancesRestantes`
 * ja mostre 0.
 */
export function isSessionOver(queue: PenaltyPlayResult[]): boolean {
  return queue.length === 0
}

export interface PremioGanho {
  nome: string
  tipo_premio: 'valor' | 'cota'
  valor: string | null
}

/**
 * Premios efetivamente ganhos (dinheiro ou cota) dentro de um conjunto de
 * resultados — usado no resumo final do "Chutar tudo". Replay e derrota nao
 * aparecem, igual ao filtro `filtrarPremiosGanhados`/`premiosGirarTudo` da
 * Roleta.
 */
export function filtrarPremiosGanhados(results: PenaltyPlayResult[]): PremioGanho[] {
  return results
    .filter(
      (r): r is PenaltyPlayResult & { tipo_premio: 'valor' | 'cota' } =>
        r.tipo_acao === 'ganhou' && (r.tipo_premio === 'valor' || r.tipo_premio === 'cota')
    )
    .map((r) => ({ nome: r.nome, tipo_premio: r.tipo_premio, valor: r.valor }))
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test:unit -- session`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add app/game/session.ts app/game/session.spec.ts
git commit --no-gpg-sign -m "feat: modulo puro de sessao (chances restantes, fim de sessao, filtro de premios ganhos)"
```

---

## Task 3: `ModalArea.vue` (wrapper) e `Botao.vue` (botão reutilizável)

**Files:**
- Create: `app/components/Modais/ModalArea.vue`
- Create: `app/components/Modais/Botao.vue`

**Interfaces:**
- Produces: `ModalArea` (props: `ariaLabel: string`, `variant?: 'win' | 'lose'`; slot default), `Botao` (props: `titulo: string`, `variant?: 'primary' | 'outline'`, `disabled?: boolean`; emit `click`).

**Nota de escopo:** diferente do `ModalArea.vue`/`Botao.vue` da Roleta (que usam `inject(CONFIG_RASPADINHA)` para tema dinâmico e Tailwind), aqui as cores ficam fixas no CSS (mesma paleta já usada nos cards inline atuais — verde `#8dff5a`, dourado `#ffd23f`) porque esse projeto não tem Pinia nem sistema de tema — não precisa.

- [ ] **Step 1: Criar `ModalArea.vue`**

```vue
<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="ariaLabel">
    <div class="card" :class="variant ? `card-${variant}` : ''">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ ariaLabel: string; variant?: 'win' | 'lose' }>(), {
  variant: undefined,
});
</script>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(2, 8, 5, 0.62);
  backdrop-filter: blur(7px);
  z-index: 10;
}

.card {
  position: relative;
  width: min(92%, 400px);
  border-radius: 22px;
  padding: 30px 26px 26px;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(165deg, #0d2417, #071510 60%, #051009);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.card-win {
  border-color: rgba(255, 210, 63, 0.45);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.55),
    0 0 60px rgba(255, 210, 63, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.card-lose::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 110, 90, 0.8),
    transparent
  );
}

.modal-enter-active {
  transition: opacity 0.3s ease;
}

.modal-leave-active {
  transition: opacity 0.22s ease;
}

.modal-enter-active .card {
  animation: card-in 0.45s cubic-bezier(0.34, 1.35, 0.64, 1) both;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@keyframes card-in {
  0% {
    transform: translateY(30px) scale(0.92);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
</style>
```

- [ ] **Step 2: Criar `Botao.vue`**

```vue
<template>
  <button
    type="button"
    class="botao"
    :class="`botao-${variant}`"
    :disabled="disabled"
    @click="$emit('click')"
  >
    {{ titulo }}
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string;
    variant?: "primary" | "outline";
    disabled?: boolean;
  }>(),
  {
    variant: "primary",
    disabled: false,
  },
);
defineEmits<{ click: [] }>();
</script>

<style scoped>
.botao {
  position: relative;
  margin-top: 20px;
  width: 100%;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;
}

.botao:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.botao-primary {
  border: 0;
  color: #04120a;
  background: linear-gradient(160deg, #ffe066, #ffd23f 55%, #eab308);
  box-shadow: 0 10px 26px rgba(255, 210, 63, 0.32);
}

.botao-primary:hover:not(:disabled) {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.botao-primary:active:not(:disabled) {
  transform: translateY(1px) scale(0.99);
}

.botao-outline {
  background: transparent;
  border: 1px solid rgba(141, 255, 90, 0.5);
  color: #8dff5a;
}

.botao-outline:active:not(:disabled) {
  transform: scale(0.97);
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Modais/ModalArea.vue app/components/Modais/Botao.vue
git commit --no-gpg-sign -m "feat: componentes base de modal (ModalArea, Botao) sem dependencia de Pinia/tema"
```

---

## Task 4: Modais de resultado — `ModalGol`, `ModalDefendeu`, `ModalChuteExtra`

**Files:**
- Create: `app/components/Modais/ModalGol.vue`
- Create: `app/components/Modais/ModalDefendeu.vue`
- Create: `app/components/Modais/ModalChuteExtra.vue`

**Interfaces:**
- Consumes: `ModalArea`, `Botao` (Task 3); `PenaltyPlayResult` de `~/composables/useGameApi` (Task 1).
- Produces: `ModalGol` (props: `premio: PenaltyPlayResult | null`, `ultimaChance: boolean`; emit `continuar`), `ModalDefendeu` (props: `ultimaChance: boolean`; emit `continuar`), `ModalChuteExtra` (props: `ultimaChance: boolean`; emit `continuar`).

**Nota:** cada modal duplica um pequeno conjunto de estilos visuais (badge circular, título, texto de apoio) em vez de compartilhar CSS global ou usar `:deep()` — decisão deliberada para manter cada componente entendível isoladamente (ver seção "Design for isolation" do processo de brainstorming). São ~15-20 linhas de CSS por componente, aceitável.

- [ ] **Step 1: Criar `ModalGol.vue`**

```vue
<template>
  <ModalArea aria-label="Voce ganhou" variant="win">
    <div class="rays" aria-hidden="true" />
    <div class="badge badge-win">
      <svg
        viewBox="0 0 24 24"
        width="44"
        height="44"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4a3 3 0 0 0 3 5" />
        <path d="M17 6h3a3 3 0 0 1-3 5" />
      </svg>
    </div>
    <h2 class="card-title">GOOOL!</h2>
    <p class="card-sub">Voce venceu o goleiro</p>

    <div class="prize">
      <span class="prize-label">Voce ganhou</span>
      <strong class="prize-value">{{ premio?.nome }}</strong>
    </div>

    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Continuar jogando'"
      @click="$emit('continuar')"
    />
  </ModalArea>
</template>

<script setup lang="ts">
import type { PenaltyPlayResult } from "~/composables/useGameApi";
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ premio: PenaltyPlayResult | null; ultimaChance: boolean }>();
defineEmits<{ continuar: [] }>();
</script>

<style scoped>
.rays {
  position: absolute;
  inset: -60%;
  -webkit-mask-image: radial-gradient(
    circle 230px at 50% 41%,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.3) 55%,
    transparent 100%
  );
  mask-image: radial-gradient(
    circle 230px at 50% 41%,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.3) 55%,
    transparent 100%
  );
  background: conic-gradient(
    from 0deg,
    rgba(255, 210, 63, 0.13) 0deg 18deg,
    transparent 18deg 36deg,
    rgba(255, 210, 63, 0.13) 36deg 54deg,
    transparent 54deg 72deg,
    rgba(255, 210, 63, 0.13) 72deg 90deg,
    transparent 90deg 108deg,
    rgba(255, 210, 63, 0.13) 108deg 126deg,
    transparent 126deg 144deg,
    rgba(255, 210, 63, 0.13) 144deg 162deg,
    transparent 162deg 180deg,
    rgba(255, 210, 63, 0.13) 180deg 198deg,
    transparent 198deg 216deg,
    rgba(255, 210, 63, 0.13) 216deg 234deg,
    transparent 234deg 252deg,
    rgba(255, 210, 63, 0.13) 252deg 270deg,
    transparent 270deg 288deg,
    rgba(255, 210, 63, 0.13) 288deg 306deg,
    transparent 306deg 324deg,
    rgba(255, 210, 63, 0.13) 324deg 342deg,
    transparent 342deg 360deg
  );
  animation: rays-spin 14s linear infinite;
  pointer-events: none;
}

@keyframes rays-spin {
  to {
    transform: rotate(360deg);
  }
}

.badge {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 50%;
  animation: badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.1s;
}

.badge-win {
  color: #04120a;
  background: radial-gradient(circle at 32% 28%, #ffe789, #ffd23f 55%, #d99a12);
  box-shadow: 0 10px 30px rgba(255, 210, 63, 0.4);
}

.badge-win::after {
  content: "";
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 2px solid rgba(255, 210, 63, 0.6);
  animation: ring-pulse 1.8s ease-out infinite;
}

@keyframes ring-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.9;
  }
  70% {
    transform: scale(1.22);
    opacity: 0;
  }
  100% {
    transform: scale(1.22);
    opacity: 0;
  }
}

@keyframes badge-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.card-title {
  position: relative;
  margin: 0;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #fff;
  background: linear-gradient(
    100deg,
    #d99a12 0%,
    #ffd23f 28%,
    #fff3bd 50%,
    #ffd23f 72%,
    #d99a12 100%
  );
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(255, 210, 63, 0.4));
  animation:
    rise-in 0.5s ease both,
    title-shine 2.6s linear 0.7s infinite;
}

@keyframes title-shine {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

@keyframes rise-in {
  0% {
    transform: translateY(14px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.card-sub {
  position: relative;
  margin: 6px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.28s;
}

.prize {
  position: relative;
  margin: 20px 0 4px;
  padding: 16px 14px;
  border-radius: 16px;
  background: linear-gradient(
    170deg,
    rgba(255, 210, 63, 0.1),
    rgba(255, 255, 255, 0.04) 45%
  );
  border: 1px solid rgba(255, 210, 63, 0.35);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.4s;
}

.prize::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 46%;
  background: linear-gradient(
    105deg,
    transparent,
    rgba(255, 255, 255, 0.14) 50%,
    transparent
  );
  animation: prize-shimmer 2.8s ease-in-out 1s infinite;
  pointer-events: none;
}

@keyframes prize-shimmer {
  0% {
    left: -60%;
  }
  55% {
    left: 115%;
  }
  100% {
    left: 115%;
  }
}

.prize-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.prize-value {
  font-size: 32px;
  font-weight: 900;
  color: #8dff5a;
  text-shadow: 0 0 24px rgba(141, 255, 90, 0.35);
  animation:
    value-pop 0.5s cubic-bezier(0.34, 1.5, 0.64, 1) 0.55s both,
    value-glow 2.2s ease-in-out 1.1s infinite;
}

@keyframes value-pop {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes value-glow {
  0%,
  100% {
    text-shadow: 0 0 24px rgba(141, 255, 90, 0.35);
  }
  50% {
    text-shadow: 0 0 38px rgba(141, 255, 90, 0.65);
  }
}
</style>
```

- [ ] **Step 2: Criar `ModalDefendeu.vue`**

```vue
<template>
  <ModalArea aria-label="Nao foi dessa vez" variant="lose">
    <div class="badge badge-lose">
      <svg
        viewBox="0 0 24 24"
        width="44"
        height="44"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M12 3c3.5 0 6 2 6 5.5V13a6 6 0 0 1-12 0V8.5C6 5 8.5 3 12 3Z"
        />
        <path d="M9 7v4M12 6.5V11M15 7v4" />
      </svg>
    </div>
    <h2 class="card-title">Defendeu!</h2>
    <p class="card-sub">O goleiro voou no canto certo.</p>
    <p class="card-encourage">Respira, ajusta a mira e manda de novo.</p>

    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Tentar novamente'"
      @click="$emit('continuar')"
    />
  </ModalArea>
</template>

<script setup lang="ts">
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ ultimaChance: boolean }>();
defineEmits<{ continuar: [] }>();
</script>

<style scoped>
.badge {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 50%;
  animation:
    badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    lose-shake 0.5s ease 0.6s;
  animation-delay: 0.1s;
}

.badge-lose {
  color: #ffe2dc;
  background: radial-gradient(circle at 32% 28%, #4a5568, #2b3444 60%, #1a2230);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

@keyframes badge-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes lose-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-6px);
  }
  50% {
    transform: translateX(5px);
  }
  75% {
    transform: translateX(-3px);
  }
}

.card-title {
  position: relative;
  margin: 0;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #fff;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.2s;
}

@keyframes rise-in {
  0% {
    transform: translateY(14px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.card-sub {
  position: relative;
  margin: 6px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.28s;
}

.card-encourage {
  position: relative;
  margin: 14px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.36s;
}
</style>
```

- [ ] **Step 3: Criar `ModalChuteExtra.vue`**

```vue
<template>
  <ModalArea aria-label="Chute extra">
    <div class="badge badge-replay">
      <svg
        viewBox="0 0 24 24"
        width="40"
        height="40"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    </div>
    <h2 class="card-title">Chute Extra!</h2>
    <p class="card-sub">Essa cobranca nao contou como chance.</p>

    <Botao
      :titulo="ultimaChance ? 'Jogar novamente' : 'Continuar jogando'"
      @click="$emit('continuar')"
    />
  </ModalArea>
</template>

<script setup lang="ts">
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ ultimaChance: boolean }>();
defineEmits<{ continuar: [] }>();
</script>

<style scoped>
.badge {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 50%;
  animation: badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.1s;
}

.badge-replay {
  color: #04120a;
  background: radial-gradient(circle at 32% 28%, #a9d8ff, #6fb8ff 55%, #2f7fd1);
  box-shadow: 0 10px 30px rgba(111, 184, 255, 0.4);
}

@keyframes badge-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.card-title {
  margin: 0;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 0.03em;
  color: #fff;
  animation: rise-in 0.5s ease both;
  animation-delay: 0.2s;
}

@keyframes rise-in {
  0% {
    transform: translateY(14px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.card-sub {
  margin: 6px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  animation: rise-in 0.5s ease both;
  animation-delay: 0.28s;
}
</style>
```

- [ ] **Step 4: Commit**

```bash
git add app/components/Modais/ModalGol.vue app/components/Modais/ModalDefendeu.vue app/components/Modais/ModalChuteExtra.vue
git commit --no-gpg-sign -m "feat: modais de resultado (Gol, Defendeu, Chute Extra) como componentes de verdade"
```

---

## Task 5: `ModalChutarTudoConfirm` e `ModalResumoChutarTudo`

**Files:**
- Create: `app/components/Modais/ModalChutarTudoConfirm.vue`
- Create: `app/components/Modais/ModalResumoChutarTudo.vue`

**Interfaces:**
- Consumes: `ModalArea`, `Botao` (Task 3); `PremioGanho` de `~/game/session` (Task 2).
- Produces: `ModalChutarTudoConfirm` (props: `fase: 'confirmar' | 'progresso'`, `quantidade: number`; emits `confirmar`, `cancelar`), `ModalResumoChutarTudo` (props: `premios: PremioGanho[]`; emit `continuar`).

**Nota:** ao contrário do que foi imaginado na primeira versão do desenho, o "Chutar tudo" **não** re-anima o motor 3D por item (isso levaria 2-3s × N chutes) — só mostra este modal com um loading falso enquanto os dados são resolvidos de uma vez (ver `confirmarChutarTudo` na Task 7 e a seção "Chutar tudo" da spec). Por isso este componente é 100% controlado pelo pai via a prop `fase` — ele não tem estado interno de step.

- [ ] **Step 1: Criar `ModalChutarTudoConfirm.vue`**

```vue
<template>
  <ModalArea aria-label="Chutar tudo">
    <template v-if="fase === 'confirmar'">
      <h2 class="card-title">Chutar tudo?</h2>
      <p class="card-sub">
        Suas {{ quantidade }} chances restantes vao ser jogadas
        automaticamente e o resultado aparece no final.
      </p>

      <div class="botoes">
        <Botao titulo="Cancelar" variant="outline" @click="$emit('cancelar')" />
        <Botao titulo="Chutar tudo" @click="$emit('confirmar')" />
      </div>
    </template>

    <template v-else>
      <p class="card-sub progresso-texto">
        Chutando suas {{ quantidade }}
        {{ quantidade === 1 ? "chance" : "chances" }}...
      </p>
      <div class="barra-fundo">
        <div class="barra-progresso" />
      </div>
    </template>
  </ModalArea>
</template>

<script setup lang="ts">
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ fase: "confirmar" | "progresso"; quantidade: number }>();
defineEmits<{ confirmar: []; cancelar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0;
  font-size: 26px;
  font-weight: 900;
  color: #fff;
}

.card-sub {
  margin: 10px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}

.progresso-texto {
  margin: 6px 0 18px;
  text-align: center;
}

.botoes {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.botoes > * {
  margin-top: 0;
  flex: 1;
}

.barra-fundo {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.barra-progresso {
  height: 100%;
  width: 0;
  border-radius: 999px;
  background: #8dff5a;
  animation: progresso 1.4s ease-in-out forwards;
}

@keyframes progresso {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}
</style>
```

- [ ] **Step 2: Criar `ModalResumoChutarTudo.vue`**

```vue
<template>
  <ModalArea aria-label="Resumo do lote" variant="win">
    <h2 class="card-title">Resultado do lote</h2>

    <p v-if="premios.length === 0" class="card-sub">
      Nenhum premio dessa vez — respira e chuta de novo.
    </p>

    <ul v-else class="lista-premios">
      <li v-for="(premio, i) in premios" :key="i" class="item-premio">
        {{ premio.nome }}
      </li>
    </ul>

    <Botao titulo="Jogar novamente" @click="$emit('continuar')" />
  </ModalArea>
</template>

<script setup lang="ts">
import type { PremioGanho } from "~/game/session";
import ModalArea from "./ModalArea.vue";
import Botao from "./Botao.vue";

defineProps<{ premios: PremioGanho[] }>();
defineEmits<{ continuar: [] }>();
</script>

<style scoped>
.card-title {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
}

.card-sub {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
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

- [ ] **Step 3: Commit**

```bash
git add app/components/Modais/ModalChutarTudoConfirm.vue app/components/Modais/ModalResumoChutarTudo.vue
git commit --no-gpg-sign -m "feat: modais de confirmacao e resumo do Chutar tudo"
```

---

## Task 6: Barra de histórico (`HistoricoBar.vue`)

**Files:**
- Create: `app/components/HistoricoBar.vue`

**Interfaces:**
- Consumes: `PenaltyPlayResult` de `~/composables/useGameApi` (Task 1).
- Produces: `HistoricoBar` (props: `history: PenaltyPlayResult[]`).

- [ ] **Step 1: Criar `HistoricoBar.vue`**

```vue
<template>
  <div v-if="ultimos.length > 0" class="historico-bar" aria-hidden="true">
    <span
      v-for="(item, i) in ultimos"
      :key="`${item.chave_giro}-${i}`"
      class="historico-item"
      :class="`historico-${tipoIcone(item)}`"
    >
      <svg
        v-if="tipoIcone(item) === 'gol'"
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <svg
        v-else-if="tipoIcone(item) === 'replay'"
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { PenaltyPlayResult } from "~/composables/useGameApi";

const props = defineProps<{ history: PenaltyPlayResult[] }>();

const ultimos = computed(() => props.history.slice(-8));

function tipoIcone(item: PenaltyPlayResult): "gol" | "defendeu" | "replay" {
  if (item.tipo_acao === "ganhou") return "gol";
  if (item.tipo_acao === "replay") return "replay";
  return "defendeu";
}
</script>

<style scoped>
.historico-bar {
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(6, 18, 12, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
}

.historico-item {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
}

.historico-gol {
  color: #04120a;
  background: #8dff5a;
}

.historico-defendeu {
  color: #ffe2dc;
  background: #4a5568;
}

.historico-replay {
  color: #04120a;
  background: #6fb8ff;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/HistoricoBar.vue
git commit --no-gpg-sign -m "feat: barra de historico com icones dos ultimos resultados"
```

---

## Task 7: Integração em `PenaltyGame.client.vue`

**Files:**
- Modify: `app/components/PenaltyGame.client.vue` (arquivo inteiro substituído — ver conteúdo completo abaixo)

**Interfaces:**
- Consumes: `MOCK_SESSION_SIZE`, `PenaltyPlayResult` (Task 1); `chancesRestantes`, `isSessionOver`, `filtrarPremiosGanhados`, `PremioGanho` (Task 2); `ModalGol`, `ModalDefendeu`, `ModalChuteExtra`, `ModalChutarTudoConfirm`, `ModalResumoChutarTudo` (Tasks 4-5); `HistoricoBar` (Task 6).

**O que muda em relação ao arquivo atual:**
- `fetchPlaySequence` é chamado **uma vez** por sessão (no primeiro "Chutar"), não mais em lotes com reabastecimento — remove `SEQUENCE_BATCH_SIZE`/`REFILL_THRESHOLD`/`maybeRefill`/`nextPlayResult`.
- `attempts`/`goals`/`lastOutcome` são removidos — eram estado morto (nunca renderizado no template atual).
- `onResult` passa a decidir o modal a partir de `currentPlayResult.tipo_acao` (que agora inclui `'replay'`), não mais a partir do `outcome` físico recebido da engine (que só tem `'goal'|'save'`) — isso é o que faz o replay (fisicamente animado como `'save'`) abrir o modal certo em vez de "Defendeu!".
- Os dois cards de modal inline (vitória/derrota) saem daqui e viram `<ModalGol>`/`<ModalDefendeu>`, mais os três modais novos.
- Contador de chances (`.chances-hud`) e barra de histórico (`<HistoricoBar>`) somam-se ao HUD existente.
- CSS morto removido: `.scoreboard`/`.score-goals`/`.score-sep`/`.score-attempts` (nunca eram renderizados), e todo o bloco de CSS de modal (`.overlay` até `.prize-value`/`@keyframes value-glow`, `.btn`/`.btn-primary`, `.modal-enter-active` etc.) — isso tudo já mora em `ModalArea.vue`/`Botao.vue`/nos modais individuais agora.

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

```vue
<script setup lang="ts">
import { PenaltyEngine3D } from "~/game/engine3d/penaltyEngine3d";
import type { ShotOutcome, EngineState } from "~/game/types";
import { Sfx } from "~/game/sfx";
import type { GameInfo, PenaltyPlayResult } from "~/composables/useGameApi";
import { MOCK_SESSION_SIZE } from "~/composables/useGameApi";
import {
  chancesRestantes,
  isSessionOver,
  filtrarPremiosGanhados,
  type PremioGanho,
} from "~/game/session";
import HistoricoBar from "~/components/HistoricoBar.vue";
import ModalGol from "~/components/Modais/ModalGol.vue";
import ModalDefendeu from "~/components/Modais/ModalDefendeu.vue";
import ModalChuteExtra from "~/components/Modais/ModalChuteExtra.vue";
import ModalChutarTudoConfirm from "~/components/Modais/ModalChutarTudoConfirm.vue";
import ModalResumoChutarTudo from "~/components/Modais/ModalResumoChutarTudo.vue";

const { fetchGames, fetchPlaySequence } = useGameApi();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const engineState = ref<EngineState>("ready");
// Fundo de estadio gerado por IA: retrato para celular (ate 565px de
// largura), paisagem para desktop (acima disso). Ambos sempre ocupam 100%
// da viewport (background-size: cover cropa o que sobrar) — sem travar
// proporcao nem pillarbox/letterbox.
const DESKTOP_BREAKPOINT = 565;
const isDesktopLayout = ref(false);
const bgImage = computed(() =>
  isDesktopLayout.value
    ? "/images/stadium-bg-landscape.webp"
    : "/images/stadium-bg-portrait.webp",
);

function updateLayoutMode() {
  isDesktopLayout.value = window.innerWidth > DESKTOP_BREAKPOINT;
}

const game = ref<GameInfo | null>(null);
const muted = ref(false);

type ModalState =
  | "none"
  | "gol"
  | "defendeu"
  | "chute-extra"
  | "chutar-tudo-confirmar"
  | "chutar-tudo-progresso"
  | "resumo-tudo";

const modal = ref<ModalState>("none");
const currentPlayResult = ref<PenaltyPlayResult | null>(null);
const awaitingSequence = ref(false);
const sessionStarted = ref(false);

// Fila de resultados ja decididos pela API para a sessao inteira (buscada
// uma unica vez, no primeiro "Chutar") e historico dos ja consumidos. Ambos
// precisam ser reativos (ref) porque o contador de chances e a barra de
// historico dependem deles.
const playQueue = ref<PenaltyPlayResult[]>([]);
const history = ref<PenaltyPlayResult[]>([]);
const premiosChutarTudo = ref<PremioGanho[]>([]);

let engine: PenaltyEngine3D | null = null;
const sfx = new Sfx();

const chancesRestantesValue = computed(() =>
  chancesRestantes(playQueue.value),
);
const sessaoEncerrada = computed(
  () => sessionStarted.value && isSessionOver(playQueue.value),
);
const podeChutarTudo = computed(
  () =>
    chancesRestantesValue.value > 1 &&
    !awaitingSequence.value &&
    (engineState.value === "ready" || engineState.value === "aiming"),
);

async function onShootClick() {
  if (!engine || awaitingSequence.value || modal.value !== "none") return;
  const gameId = game.value?.id ?? "penalty-premiado";
  if (!sessionStarted.value) {
    awaitingSequence.value = true;
    playQueue.value = await fetchPlaySequence(gameId, MOCK_SESSION_SIZE);
    sessionStarted.value = true;
    awaitingSequence.value = false;
  }
  if (playQueue.value.length === 0) return;
  const result = playQueue.value.shift()!;
  currentPlayResult.value = result;
  // O goleiro so encena visualmente — replay usa 'save' arbitrariamente,
  // ja que nao ha um terceiro valor fisico na engine (ShotOutcome continua
  // 'goal' | 'save'). Quem decide o modal certo e onResult(), lendo
  // currentPlayResult.tipo_acao, nao esse valor fisico.
  const engineOutcome: ShotOutcome =
    result.tipo_acao === "ganhou" ? "goal" : "save";
  engine.shoot(engineOutcome);
}

function onResult(outcome: ShotOutcome) {
  const result = currentPlayResult.value;
  if (!result) return;
  history.value.push(result);
  if (result.tipo_acao === "ganhou") {
    modal.value = "gol";
  } else if (result.tipo_acao === "replay") {
    modal.value = "chute-extra";
  } else {
    modal.value = "defendeu";
  }
}

function onModalContinuar() {
  if (sessaoEncerrada.value) {
    jogarNovamente();
    return;
  }
  modal.value = "none";
  currentPlayResult.value = null;
  engine?.reset();
  sfx.whistle();
}

function jogarNovamente() {
  modal.value = "none";
  currentPlayResult.value = null;
  history.value = [];
  sessionStarted.value = false;
  playQueue.value = [];
  engine?.reset();
  sfx.whistle();
}

function abrirChutarTudoConfirm() {
  if (!podeChutarTudo.value) return;
  modal.value = "chutar-tudo-confirmar";
}

function confirmarChutarTudo() {
  modal.value = "chutar-tudo-progresso";
  // Nao re-anima a engine por item (levaria 2-3s x N chutes) — resolve
  // todos os itens restantes da fila de uma vez so nos dados, com um
  // loading falso, igual ao confirmarGirarTodas() da Roleta
  // (play-components-web/src/components/Roleta/composables/useGirarRoleta.ts).
  setTimeout(() => {
    const consumidos = playQueue.value.splice(0);
    history.value.push(...consumidos);
    premiosChutarTudo.value = filtrarPremiosGanhados(consumidos);
    modal.value = "resumo-tudo";
  }, 1500);
}

function toggleMute() {
  muted.value = !muted.value;
  sfx.setMuted(muted.value);
}

onMounted(async () => {
  updateLayoutMode();
  window.addEventListener("resize", updateLayoutMode);

  game.value = (await fetchGames()).find((g) => g.active) ?? null;

  if (!canvasRef.value) return;
  engine = new PenaltyEngine3D(canvasRef.value, {
    onResult,
    onStateChange: (s) => {
      engineState.value = s;
      if (s === "aiming") sfx.startAmbient();
    },
    onKick: () => sfx.kick(),
    onImpact: (outcome) => (outcome === "goal" ? sfx.roar() : sfx.groan()),
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateLayoutMode);
  engine?.destroy();
  sfx.destroy();
});
</script>

<template>
  <div class="stage-viewport">
    <div class="stage" :style="{ backgroundImage: `url(${bgImage})` }">
      <canvas ref="canvasRef" class="game-canvas" />

      <!-- Telao central: usa o quadro ja pintado na foto de fundo -->
      <div class="jumbotron" aria-hidden="true">
        <img
          class="jumbotron-logo"
          src="/images/penalti-premiado-logo.png"
          alt=""
        />
      </div>

      <div class="chances-hud" aria-hidden="true">
        {{ chancesRestantesValue }}
        {{
          chancesRestantesValue === 1 ? "chance restante" : "chances restantes"
        }}
      </div>

      <!-- HUD -->
      <header class="hud">
        <button
          class="mute-btn"
          type="button"
          :aria-label="muted ? 'Ativar som' : 'Desativar som'"
          @click="toggleMute"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon
              points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
              fill="currentColor"
              stroke="none"
            />
            <template v-if="!muted">
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </template>
            <template v-else>
              <line x1="15" y1="9" x2="21" y2="15" />
              <line x1="21" y1="9" x2="15" y2="15" />
            </template>
          </svg>
        </button>

        <button>Sair</button>
      </header>

      <!-- Botoes de chute -->
      <Transition name="fade">
        <div
          v-if="
            modal === 'none' &&
            (engineState === 'ready' || engineState === 'aiming')
          "
          class="hint"
        >
          <HistoricoBar :history="history" />

          <button
            class="hint-badge shoot-btn"
            type="button"
            :disabled="awaitingSequence"
            @click="onShootClick"
          >
            {{ awaitingSequence ? "Carregando..." : "Chutar" }}
          </button>

          <button
            class="chutar-tudo-btn"
            type="button"
            :disabled="!podeChutarTudo"
            @click="abrirChutarTudoConfirm"
          >
            Chutar tudo
          </button>
        </div>
      </Transition>

      <!-- Modal de vitoria -->
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

      <!-- Confirmacao + progresso do "Chutar tudo" -->
      <Transition name="modal">
        <ModalChutarTudoConfirm
          v-if="
            modal === 'chutar-tudo-confirmar' ||
            modal === 'chutar-tudo-progresso'
          "
          :fase="modal === 'chutar-tudo-progresso' ? 'progresso' : 'confirmar'"
          :quantidade="chancesRestantesValue"
          @confirmar="confirmarChutarTudo"
          @cancelar="modal = 'none'"
        />
      </Transition>

      <!-- Resumo do lote do "Chutar tudo" -->
      <Transition name="modal">
        <ModalResumoChutarTudo
          v-if="modal === 'resumo-tudo'"
          :premios="premiosChutarTudo"
          @continuar="jogarNovamente"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.stage-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #04120a;
  overflow: hidden;
}

.stage {
  position: relative;
  /* Sempre 100% da viewport — sem trava de proporcao nem pillarbox. Abaixo
     de DESKTOP_BREAKPOINT usa a imagem retrato, acima a paisagem; em ambos
     os casos background-size:cover cropa o que sobrar. */
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #04120a;
  background-size: cover;
  background-position: center;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.game-canvas {
  position: absolute;
  inset: 0;
  top: 10px;
  /* inset nao estica elementos replaced (canvas fica no tamanho do buffer
     do renderer, 1.5x maior que a tela) — precisa do 100% explicito. */
  width: 100%;
  height: 100%;
  display: block;
}

/* ------------------------------ Telao ------------------------------ */

.jumbotron {
  position: absolute;
  left: 50%;
  top: 20%;
  width: 100%;
  height: 8%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.jumbotron-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(255, 210, 63, 0.35));
}

.chances-hud {
  position: absolute;
  left: 50%;
  top: 29%;
  transform: translateX(-50%);
  padding: 4px 14px;
  border-radius: 999px;
  background: rgba(6, 18, 12, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* ------------------------------ HUD ------------------------------ */

.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(2, 8, 16, 0.72), rgba(2, 8, 16, 0));
}

.mute-btn {
  pointer-events: auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(6, 18, 12, 0.65);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.mute-btn:active {
  transform: scale(0.92);
}

/* ------------------------------ Botoes de chute ------------------------------ */

.hint {
  position: absolute;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.hint-badge {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #04120a;
  background: #8dff5a;
  padding: 12px 34px;
  border-radius: 999px;
  animation: hint-pulse 1.6s ease-in-out infinite;
}

.shoot-btn {
  pointer-events: auto;
  border: 0;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(141, 255, 90, 0.32);
  transition:
    transform 0.15s ease,
    filter 0.15s ease;
}

.shoot-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.shoot-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  animation: none;
}

@keyframes hint-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.07);
  }
}

.chutar-tudo-btn {
  pointer-events: auto;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8dff5a;
  background: transparent;
  border: 1px solid rgba(141, 255, 90, 0.5);
  padding: 8px 22px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.chutar-tudo-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.chutar-tudo-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* ------------------------------ Transicoes ------------------------------ */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (min-width: 900px) {
  .hud {
    padding: 16px 24px;
  }
}
</style>
```

- [ ] **Step 2: Rodar a suíte de testes completa (nada deve ter quebrado)**

Run: `npm run test:unit`
Expected: PASS (todos os specs, incluindo os de Task 1 e Task 2)

- [ ] **Step 3: Commit**

```bash
git add app/components/PenaltyGame.client.vue
git commit --no-gpg-sign -m "feat: integra sessao de chances, historico, chutar tudo e modais novos no jogo"
```

---

## Task 8: Verificação manual completa

**Files:** nenhum (só verificação via navegador)

- [ ] **Step 1: Subir o servidor de dev**

Use a ferramenta de preview do Claude Code (`preview_start`) com o servidor `dev` já configurado em `.claude/launch.json`, ou rode manualmente:

Run: `npm run dev`

- [ ] **Step 2: Fluxo normal (sem cenário fixo)**

Abra a página sem query string. Clique em "Chutar" algumas vezes seguidas.

Verificar:
- Contador "X chances restantes" aparece sobre o telão e diminui a cada chute real (ganhou/nao_ganhou), mas **não** diminui quando o resultado é "Chute Extra".
- Barra de histórico aparece acima do botão "Chutar" depois do primeiro chute, com o ícone certo por tipo (✓ verde = gol, ✗ cinza = defendeu, ↻ azul = chute extra), mostrando no máximo os últimos 8.
- Botão "Chutar tudo" começa desabilitado (fila vazia antes do 1º chute) e habilita depois do 1º chute, contanto que reste mais de 1 chance real.

- [ ] **Step 3: Cenário `todas_derrotas`**

Abra `?cenario=todas_derrotas`. Clique em "Chutar" 5 vezes.

Verificar:
- Todos os 5 chutes abrem `ModalDefendeu` ("Defendeu!").
- No 5º chute, o botão do modal mostra "Jogar novamente" (não "Tentar novamente").
- Clicar em "Jogar novamente" reinicia: contador de chances volta a subir no próximo "Chutar" (busca nova sequência), histórico visualmente reseta.

- [ ] **Step 4: Cenário `todos_replays`**

Abra `?cenario=todos_replays`. Clique em "Chutar" 5 vezes.

Verificar:
- Cada chute abre `ModalChuteExtra` ("Chute Extra!").
- O contador de chances **nunca** diminui (fica em 5 o tempo todo, já que nenhum item é ganhou/nao_ganhou).
- No 5º chute (fila fica vazia), o modal mostra "Jogar novamente".
- Goleiro anima normalmente (pula) antes de cada modal de chute extra aparecer.

- [ ] **Step 5: Cenário `alternado` + Chutar tudo**

Abra `?cenario=alternado` (5 itens: ganhou/nao_ganhou/replay/ganhou/nao_ganhou). Clique em "Chutar" uma vez para revelar a sessão (contador mostra "3 chances restantes" — 2 ganhou/nao_ganhou já não, faltam os outros 3 reais... confirme o número exato bate com `chancesRestantes` do item consumido em diante).

Clique em "Chutar tudo".

Verificar:
- Abre modal de confirmação ("Chutar tudo?").
- Ao confirmar, mostra o modal de progresso (barra animada) por ~1.5s, **sem** o goleiro pular de novo na tela.
- Ao terminar, mostra o resumo com os prêmios ganhos dos itens restantes (não deve listar o item já consumido manualmente no passo anterior, nem replay, nem derrota).
- Histórico e contador de chances refletem o estado final (0 chances restantes).
- Botão do resumo diz "Jogar novamente" e reinicia a sessão ao clicar.

- [ ] **Step 6: Botão "Chutar tudo" desabilitado com poucas chances**

Abra `?cenario=todas_derrotas`. Clique em "Chutar" 4 vezes (resta 1 chance).

Verificar: botão "Chutar tudo" está desabilitado (chancesRestantes <= 1).

- [ ] **Step 7: Checar erros no console**

Use `preview_console_logs` (ou o DevTools do navegador) com filtro de erros durante todos os passos acima.

Expected: nenhum erro no console.

- [ ] **Step 8: Atualizar `docs/superpowers/STATUS.md`**

Adicione uma nova seção "Feito nesta rodada" (movendo a anterior para o histórico, seguindo o padrão já usado no arquivo) descrevendo: sessão de chances vinda da API, replay/Chute Extra, barra de histórico, Chutar tudo (sem re-animação por item), modais reais adaptados da Roleta, cenários fixos via `?cenario=`. Referencie a spec `2026-07-03-jogo-profissionalizado-design.md` e este plano.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/STATUS.md
git commit --no-gpg-sign -m "docs: atualiza status apos concluir sessao de chances, historico, chutar tudo e modais"
```
