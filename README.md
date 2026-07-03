# Penalti Premiado

Jogo de penalti feito com Nuxt 4 e Canvas 2D, pensado para ser distribuido como
build estatico via CDN. O jogador (camisa amarela, calcao azul) bate penalti
contra um goleiro todo de preto. Quem faz o gol pode ganhar premios em dinheiro
ou numeros da sorte para sorteios.

## Como funciona

- **Mira por toque ou mouse**: toque/clique no gol para mirar, arraste para
  ajustar e solte para chutar. Mirar fora do gol manda a bola para fora.
- **Goleiro com IA simples**: ele tende a ir para o lado do chute, mas nem
  sempre acerta o canto. A defesa acontece quando o mergulho alcanca a bola.
- **Tres desfechos**: gol (com festa da torcida, confete e ondulacao da rede),
  defesa do goleiro (com rebote para fora) e chute para fora (bola nas placas).
- **Ambientacao**: estadio noturno com refletores, torcida animada em dois
  quadros com crossfade, placas de publicidade, gramado em perspectiva e
  vinheta. Sons da torcida, apito, chute e gritos sintetizados via WebAudio
  (sem assets externos).
- **Modais animados** de vitoria (contador de dinheiro ou fichas com os
  numeros da sorte) e de derrota com "Tentar novamente".

## Rodando localmente

```bash
npm install
npm run dev
```

## Build estatico para CDN

```bash
npm run generate
```

A saida fica em `.output/public` com caminhos relativos (`baseURL: './'`),
entao pode ser servida de qualquer CDN, bucket ou subdiretorio:

- **jsDelivr (direto do GitHub)**: publique o conteudo de `.output/public` em
  uma branch (por exemplo `dist`) e sirva via
  `https://cdn.jsdelivr.net/gh/<owner>/web@dist/index.html`
- **GitHub Pages / Netlify / Vercel / S3 + CloudFront**: basta apontar para a
  pasta gerada.

## Integracao com a API (proximo passo)

O contrato esperado esta documentado em `app/composables/useGameApi.ts`:

```
GET  {apiBase}/games                  -> { games: GameInfo[] }
POST {apiBase}/games/{id}/play        -> { prize: Prize | null }
```

Enquanto a API nao existe, o jogo roda com dados mockados (`USE_MOCK = true`).
Para plugar a API real:

1. Defina `USE_MOCK = false` em `app/composables/useGameApi.ts`
2. Passe a base da API pela query string: `?api=https://sua-api.com`

Tipos de premio suportados:

- `money`: valor em centavos, exibido com contador animado em BRL
- `lucky-numbers`: lista de numeros da sorte, exibidos como fichas animadas

## Performance

- Fundo do estadio, torcida e vinheta pre-renderizados em canvases offscreen;
  o loop por quadro so desenha o que se move
- `devicePixelRatio` limitado a 2 para nao explodir em telas de celular
- Uma unica passada de `requestAnimationFrame`, sem alocacoes no caminho quente
- Sem dependencias de runtime alem do Nuxt/Vue
