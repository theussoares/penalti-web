export default defineNuxtConfig({
  compatibilityDate: '2026-07-03',
  devtools: { enabled: false },
  ssr: false,
  app: {
    // Caminho relativo para permitir servir os assets a partir de qualquer CDN
    baseURL: './',
    buildAssetsDir: 'assets',
    head: {
      title: 'Penalti Premiado',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        },
        {
          name: 'description',
          content: 'Bata o penalti, vença o goleiro e ganhe premios em dinheiro ou numeros da sorte.'
        },
        { name: 'theme-color', content: '#04120a' }
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href:
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#f2f5f8"/><polygon points="16,10 21.7,14.1 19.5,20.9 12.5,20.9 10.3,14.1" fill="#20262e"/><circle cx="16" cy="16" r="14" fill="none" stroke="#20262e" stroke-width="2"/></svg>'
            )
        }
      ]
    }
  },
  nitro: {
    preset: 'static'
  }
})
