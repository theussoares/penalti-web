# Plano: Segunda rodada de ambientação — clima de "prêmio"

Contexto: o motor 3D (Three.js) já tem chão, gol, arquibancada, refletores e
sombras falsas (ver `2026-07-03-motor-3d-threejs.md`). O usuário pediu mais
uma rodada, comparando com estética de jogos de prêmio (Pragmatic Play,
Evolution, PG Soft): iluminação dourada, partículas, brilho, neon, elementos
em movimento — sem pesar a cena (Android de entrada é o alvo de performance).

Cada task abaixo é um módulo independente em `app/game/engine3d/` — sem
overlap de arquivos entre tasks, exceto a Task 5 (integração), que é a única
que toca `penaltyEngine3d.ts`.

**Convenções do projeto** (já estabelecidas, seguir sem inventar estilo
novo):
- Sem luzes dinâmicas nem sombras reais — tudo `MeshBasicMaterial` com
  sprites/canvas ou `BufferAttribute` perturbado por vértice.
- Texto/gradiente vira `CanvasTexture` pré-renderizada uma vez; nunca
  redesenhar canvas a cada frame.
- Perturbação de vértice por frame: `BufferAttribute.setXYZ()` +
  `needsUpdate = true` (padrão em `netMesh.ts`).
- Glow radial: `createRadialGradient` num canvas pequeno (padrão em
  `stadiumLights.ts::buildGlowTexture()`).
- Comentários só quando o "porquê" não é óbvio.

`WorldLayout` (`worldGeometry.ts`): `goalWidth=7.32`, `goalHeight=2.44`,
`goalDepth=1.1`, `goalCenterX=0`, `goalLineZ=0`, `spotZ=11`,
`ballRadius=0.11`. Eixo Z: menor = mais perto do gol; câmera em z≈18 olhando
para z=0. Gramado vai de `farZ=-2.1` a `nearZ=17`, largura
`goalWidth*4.5≈32.94`.

---

## Task 1: Atmosfera do campo — `fieldAtmosphere.ts`

**Status: em execução (agente Sonnet disparado).**

**Files:** Create `app/game/engine3d/fieldAtmosphere.ts`

```ts
export interface FieldAtmosphere {
  object3D: Object3D
  update(now: number): void
}
export function buildFieldAtmosphere(layout: WorldLayout): FieldAtmosphere
```

1. **Sheen de reflexo**: plano grande na pegada do gramado, y≈0.02 (acima das
   sombras em y=0.01), textura com faixa diagonal branco→transparente,
   animada via `texture.offset.x` (RepeatWrapping) — nunca redesenhar canvas.
   Opacidade baixa (~0.12–0.2).
2. **Partículas flutuantes**: `THREE.Points`, ~50–70 partículas, sprite
   circular glow (dourado/branco quente, ~`0xfff2c9`), tamanho 0.06–0.14,
   `sizeAttenuation`. Área: x∈[-9.5,9.5], y∈[0.15,2.8], z∈[-2,13]. Em
   `update()`: drift vertical lento + balanço senoidal horizontal por
   partícula (fases variadas), wrap ao passar de y=2.8.

Restrições: sem luzes/sombras reais, sem redesenho de canvas por frame, não
editar outros arquivos.

---

## Task 2: LED giratório — `adBoardMesh.ts`

**Status: em execução (agente Sonnet disparado).**

**Files:** Modify `app/game/engine3d/adBoardMesh.ts`

Assinatura muda de `Mesh` para:
```ts
export interface AdBoards {
  mesh: Mesh
  update(now: number): void
}
export function buildAdBoards(width: number, height: number): AdBoards
```

Mensagens em rotação (sem valor de prêmio hardcoded — dado real que este
módulo não tem):
```
★ PREMIADO ★
GANHE AGORA
NÚMEROS DA SORTE
```

Uma `CanvasTexture` pré-renderizada por mensagem (mesmo estilo atual: fundo
`#0c1220`, texto repetido com `AD_COLORS` alternando, + glow neon via
`shadowColor`/`shadowBlur` como em `crowdBillboard.ts`). Crossfade entre
mensagens com a técnica de duas camadas (`meshA` opaco + `meshB` overlay com
opacidade animada) já usada em `crowdBillboard.ts`. Ciclo: ~2.8s por
mensagem, ~0.6s de transição.

---

## Task 3: Fumaça, bandeiras e luz respirando

**Status: pendente — próximo a disparar.**

**Files:**
- Create `app/game/engine3d/ambientEffects.ts`
- Modify `app/game/engine3d/stadiumLights.ts`

```ts
// ambientEffects.ts
export interface AmbientEffects {
  object3D: Object3D
  update(now: number): void
}
export function buildAmbientEffects(layout: WorldLayout): AmbientEffects
```

1. **Fumaça atrás do gol**: 2-3 sprites glow cinza-claro/branco (raio
   1.5–2.5m), atrás do gol (x∈[-2,2], y∈[0.3,1.2], z≈-1.4). Opacidade pico
   baixa (0.12–0.2), ciclo ~6–10s de subida + balanço + fade in/out, fases
   diferentes por sprite. Sem blending aditivo (fumaça não brilha).
2. **Bandeirinhas** (2, não 4 — só os cantos perto do gol ficam em quadro):
   `x=±(goalWidth/2+1)`, `z≈-1.0`. Mastro fino + pano `PlaneGeometry(0.4,
   0.28, 4, 1)` segmentado, cor da paleta dourado/ciano/verde já usada.
   Perturbar vértices da borda solta com seno em `update()` (padrão de
   `netMesh.ts`).

```ts
// stadiumLights.ts — assinatura muda de Group para:
export interface StadiumLights {
  object3D: Group
  update(now: number): void
}
export function buildStadiumLights(width: number, topY: number, z: number): StadiumLights
```

Pulso lento (não blink duro) na opacidade dos halos de glow: seno período
~4–6s, entre ~0.7 e 1.0 da opacidade original. Fases diferentes por
refletor (opcional).

**⚠️ Breaking change**: quem chama `buildStadiumLights` precisa trocar
`scene.add(group)` por `scene.add(result.object3D)` e chamar
`result.update(now)` no loop — é trabalho da Task 5.

---

## Task 4: Torcida reativa ao gol

**Status: pendente — próximo a disparar.**

**Files:** Modify `app/game/engine3d/crowdBillboard.ts`

Adicionar ao `CrowdBillboard` (sem remover/renomear o que já existe —
`mesh` e `setExcitement` continuam iguais):
```ts
export interface CrowdBillboard {
  mesh: Mesh
  setExcitement(value: number, now: number): void
  celebrate(now: number): void  // novo
}
```

`celebrate(now)` é chamado **uma vez** pelo orquestrador quando sai um gol
(Task 5 faz essa chamada). Dispara por ~1.5–2s:
1. **Onda**: camada extra com textura de faixa vertical clara sobre fundo
   transparente, varrendo a largura da torcida (anime posição/offset de UV,
   não redesenhe canvas).
2. **Flashes de câmera**: ~10-15 sprites pequenos brancos espalhados pela
   área da torcida, cada um piscando aleatoriamente para opacidade alta e
   voltando a zero em poucos frames — só ativos durante a janela de
   celebração (fora dela, `group.visible = false` para custo zero).

O crossfade base (`setExcitement`, variante A/B com "pulo") continua
intocado — é a camada de empolgação contínua já existente; `celebrate()` é
um evento extra por cima, só no momento do gol.

---

## Task 5: Integração final no orquestrador

**Status: pendente — depois de Tasks 1-4 concluídas e revisadas.**
**Modelo: Opus** (única task que toca o arquivo compartilhado
`penaltyEngine3d.ts`, maior risco de conflito/regressão).

**Files:** Modify `app/game/engine3d/penaltyEngine3d.ts`

1. Importar e instanciar `buildFieldAtmosphere`, `buildAmbientEffects` —
   adicionar `object3D` de cada um à `scene`, chamar `update(now)` de cada
   um no loop principal (`update()`).
2. Adaptar os call sites de `buildAdBoards` e `buildStadiumLights` — agora
   retornam `{mesh/object3D, update}` em vez de `Mesh`/`Group` puro. Ajustar
   `scene.add(...)` e adicionar as chamadas de `update(now)` no loop.
3. Chamar `this.crowd.celebrate(now)` em `onBallArrive()`, junto do
   `if (this.outcome === 'goal')` que já existe (mesmo bloco que faz
   `this.ripples.push(...)`).
4. Rodar `npm run test:unit` (não deve quebrar — módulos novos são só
   visuais, testes cobrem lógica pura). Verificar no navegador (preview_*):
   cena renderiza sem erro no console, LED alterna mensagem, partículas
   visíveis, gol dispara celebração da torcida, resize não quebra.
5. Revisar performance: nenhum efeito deve redesenhar canvas por frame;
   contagem total de partículas/sprites razoável para throttling 4x CPU.
6. Commit (`git commit --no-gpg-sign`) descrevendo o conjunto.

---

## Notas gerais

- Nenhuma task adiciona dependências novas (só `three`, já instalado).
- Nenhuma task roda `git add`/`git commit` exceto a Task 5 (integração),
  que fecha tudo num commit coerente depois de verificado no navegador.
- Sem `vue-tsc`/lint configurado no projeto — cada implementador tipa
  manualmente sem `any` implícito.
