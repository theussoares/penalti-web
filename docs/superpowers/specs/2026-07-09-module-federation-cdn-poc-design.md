# Design — Microfrontend via Module Federation: POC com Vercel como CDN de teste

## Contexto

O card do ClickUp [Microfrontends de Jogos via Module Federation (Vite) + CDN
Cloudflare](https://app.clickup.com/t/9011027745/868h33vce) propõe transformar
os jogos (Penalti incluso) em remotes carregados dinamicamente por um App Pai
(Host), reduzindo acoplamento de deploy e bundle inicial. O trabalho anterior
já entregou o pré-requisito dessa arquitetura: o `PenaltyGame.client.vue` virou
um componente 100% de apresentação, recebendo `resultados: PenaltyPlayResult[]`
via prop e emitindo `fechar` — o contrato de dados que qualquer Host, remoto ou
não, vai consumir (ver
`docs/superpowers/specs/2026-07-08-contrato-props-emits-microfrontend-design.md`).

Este spec cobre a segunda metade do card: o empacotamento como microfrontend.
A arquitetura final do card envolve peças fora do alcance deste repositório —
CDN Cloudflare real, o Host de produção (outro repositório, o site de
checkout principal), pipeline de CI/CD com credenciais de infra. Para não
travar em pré-requisitos de infra que ainda não existem, este spec define uma
**POC funcional usando a própria Vercel deste projeto como "CDN de teste"** —
prova o fluxo técnico inteiro (build do remote → hospedagem → import dinâmico
→ props/emits) sem exigir nenhuma infra nova, deixando a versão "de verdade"
(Cloudflare, Host real, versionamento, segurança) documentada como próxima
fase.

## Arquitetura alvo (visão de produto, fase futura)

```
Usuário
  |
  v
Host (App Pai — checkout, outro repositorio)
  |  Module Federation (import dinamico via HTTP)
  v
CDN Cloudflare
  |
  ├── /jogos/penalti/latest/remoteEntry.js
  ├── /jogos/penalti/v1.0.0/remoteEntry.js
  ├── /jogos/penalti/v1.1.0/remoteEntry.js
  └── assets/* (chunks, modelos .glb, imagens)
```

- **Remote** = este repo (`penalti-web`), expondo `PenaltyGame.client.vue`.
- **Host** = repositório de checkout (fora do alcance desta sessão). Decide
  quando montar o jogo, resolve os dados via sua própria API e monta o
  componente remoto como async component, consumindo só `resultados`/`fechar`.
- Versionamento: **SemVer manual** (`package.json` deste repo). Cada deploy
  publica em `/jogos/penalti/<versao>/` e atualiza `/jogos/penalti/latest/`
  pra apontar pra ela — dá controle explícito de quando o Host recebe uma
  versão nova.
- Trigger de deploy: **push/merge na `main`**, lendo a versão do
  `package.json` (bumped manualmente antes do merge).
- Pré-requisito de infra (não existe ainda, fora de escopo desta sessão):
  conta/bucket Cloudflare (R2 ou Pages) com domínio e credenciais de deploy.
  Alguém com acesso a infra precisa provisionar isso antes do pipeline de
  CI/CD real funcionar.
- Segurança (fase futura, fora de escopo desta sessão): CSP no Host liberando
  `script-src`/`connect-src` pro domínio da CDN; CORS na CDN liberando o
  domínio do Host.
- Observabilidade (fase futura, fora de escopo desta sessão): métricas de
  carregamento do remote (tempo de fetch do `remoteEntry.js`, taxa de falha),
  alertas se uma versão nova quebrar no Host.

## POC desta fase: Vercel como CDN de teste

Objetivo: provar o fluxo técnico inteiro pro time, sem esperar a infra real.

### Build do remote

- **Build separado, Vite puro — não passa pelo Nuxt/Nitro.**
  `PenaltyGame.client.vue` e suas dependências (`~/game/*`, `~/composables/*`,
  `~/types/*`) já usam imports explícitos e o alias `~` aponta simplesmente
  pra `app/` (confirmado no `vitest.config.ts` já existente) — dá pra
  replicar esse alias num `vite.config.federation.ts` dedicado, com o plugin
  `@module-federation/vite` expondo o componente. Isso evita qualquer risco
  de compatibilidade entre Nuxt (SSR/Nitro/auto-import) e o plugin de Module
  Federation, que é pensado pra apps Vite puros.
- **Dependências compartilhadas**: `vue` vai como `shared` (singleton — Host
  e Remote precisam usar a mesma instância pra reatividade/provide-inject
  funcionarem). `three`, `canvas-confetti` e o resto do código do jogo ficam
  empacotados dentro do remote (o Host não usa isso em nenhum outro lugar).
- Saída: uma pasta de build própria (ex: `dist-mf/`), separada do
  `.output/public` do Nuxt.

### Deploy (reaproveitando o Vercel existente)

- O `buildCommand` do `vercel.json` passa a rodar os dois builds: o
  `nuxt generate` de sempre **e** o build do remote, copiando a saída do
  remote pra dentro de `.output/public/mf/` antes do deploy.
- Resultado: `remoteEntry.js` fica acessível em
  `https://<projeto>.vercel.app/mf/remoteEntry.js` — mesma origem do site
  standalone que já existe hoje.
- **Sem necessidade de mexer em CORS/CSP nesta fase**: como o Host de teste
  (abaixo) mora no mesmo domínio/deployment, é tudo same-origin. A
  configuração de CORS/CSP de verdade só entra quando o Host real (outro
  domínio) existir — documentado acima como fase futura.
- **Sem versionamento por pasta nesta fase**: o POC publica só um
  `remoteEntry.js` (equivalente a um `latest` único), já que o objetivo é
  demonstrar o fluxo, não replicar o pipeline de produção inteiro.

### Host de demonstração

- Nova página `pages/mf-demo.vue`, dentro deste mesmo projeto.
- Importa dinamicamente `/mf/remoteEntry.js` (relativo, mesma origem),
  resolve o componente exposto (`PenaltyGame`).
- Usa `devHostSimulator.ts` (já existe, criado no trabalho anterior) pra
  gerar um `resultados` de mentira, exatamente como `pages/index.vue` já
  faz — simulando o papel de um Host de verdade.
- Monta `<PenaltyGame :resultados="..." @fechar="...">` vindo do remote,
  provando visualmente pro time: o Host **não empacota** o código do jogo
  (o bundle da página de demo, sem o import dinâmico, não inclui Three.js
  nem o motor 3D) — só busca e monta em tempo de execução.

## Fora de escopo (documentado como próxima fase, não implementado agora)

- CDN Cloudflare real (bucket/domínio/credenciais).
- Host de produção real (outro repositório) consumindo o remote de verdade.
- Pipeline de CI/CD com versionamento SemVer automatizado e publicação em
  `/jogos/penalti/<versao>/` + `/jogos/penalti/latest/`.
- Políticas de segurança de produção (CSP no Host, CORS na CDN).
- Observabilidade/alertas de carregamento do remote.

## Critério de sucesso do POC

- `npm run build:mf` (ou equivalente) gera um `remoteEntry.js` funcional.
- O deploy na Vercel expõe esse arquivo publicamente.
- `pages/mf-demo.vue` carrega o jogo via import dinâmico e o fluxo completo
  funciona (sessão de chutes, fim de sessão, `fechar`) — igual ao
  `pages/index.vue` atual, mas vindo de um bundle separado, carregado em
  tempo de execução.
- Inspecionando o bundle da página de demo (sem o import dinâmico já
  resolvido), fica claro que Three.js e o motor 3D não fazem parte dele.

## Testes

- Verificação manual no navegador (igual ao padrão já usado no projeto):
  abrir `/mf-demo`, confirmar que o jogo carrega e funciona de ponta a
  ponta, checar aba de rede pra confirmar que `remoteEntry.js` e os chunks
  do jogo são baixados sob demanda (não no carregamento inicial da página).
- Não há lógica de negócio nova nesta spec (o contrato props/emits já foi
  testado no trabalho anterior) — o foco de verificação aqui é
  infraestrutura de build/deploy, não comportamento de jogo.
