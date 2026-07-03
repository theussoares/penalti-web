import { PremiosRoletaProps } from '../components/Roleta/types/index'

/**
 * MOCK DATA PARA JOGOS (RASPADINHA, ROLETA, ETC.)
 *
 * Como usar:
 * 1. Importe os mocks desejados no seu composable (ex: `useGerarSorteio.ts`).
 *
 *    import {
 *      CARTAS_GERAIS,
 *      PREMIACAO_VITORIA_VALOR,
 *      PREMIACAO_SEQUENCIA_COMPLETA
 *    } from '@/mocks';
 *
 * 2. Substitua os mocks existentes pelos importados.
 *
 *    premiosRoleta.value = CARTAS_GERAIS;
 *    premiacao.value = PREMIACAO_VITORIA_VALOR; // ou outra sequência de premiação
 *
 */

// =============================================================================
// CARTAS: Opções de prêmios que aparecem para raspar/girar
// =============================================================================

/**
 * Uma lista extensa e variada de possíveis prêmios para preencher as cartelas.
 * Garante que os jogos tenham diversidade visual.
 */
export const CARTAS_GERAIS: PremiosRoletaProps[] = [
  {
    id: 2,
    idB: 102,
    nome: 'Tente de novo',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Não foi dessa vez',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou'
  },
  {
    id: 3,
    idB: 103,
    nome: 'R$ 5,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor'
  },
  {
    id: 4,
    idB: 104,
    nome: 'R$ 10,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor'
  },
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 100,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor'
  },
  {
    id: 7,
    idB: 107,
    nome: '1 Cota',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota'
  },
  {
    id: 8,
    idB: 108,
    nome: '5 Cotas',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota'
  },
  // {
  //   id: 9,
  //   idB: 109,
  //   nome: 'Prêmio Surpresa',
  //   valor: '1',
  //   tipo_acao: 'ganhou',
  //   tipo_premio: 'valor' // Pode ser um item especial
  // },
  // {
  //   id: 10,
  //   idB: 110,
  //   nome: 'Giro Extra',
  //   valor: '0',
  //   tipo_acao: 'replay',
  //   tipo_premio: 'replay'
  // },
  // {
  //   id: 11,
  //   idB: 111,
  //   nome: 'Não ganhou',
  //   valor: '0',
  //   tipo_acao: 'nao_ganhou',
  //   tipo_premio: 'nao_ganhou'
  // },
  // {
  //   id: 12,
  //   idB: 112,
  //   nome: 'R$ 25,00',
  //   valor: '1',
  //   tipo_acao: 'ganhou',
  //   tipo_premio: 'valor'
  // }
]

// =============================================================================
// SEQUÊNCIAS DE PREMIAÇÃO: Define o resultado de cada jogada
// =============================================================================

/**
 * Cenário: O jogador ganha um prêmio em dinheiro na primeira jogada.
 * Resultado: Ganha R$ 50,00.
 */
export const PREMIACAO_VITORIA_VALOR: PremiosRoletaProps[] = [
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'chave_vitoria_valor_1'
  }
]

/**
 * Cenário: O jogador ganha uma cota na primeira jogada.
 * Resultado: Ganha 5 cotas.
 */
export const PREMIACAO_VITORIA_COTA: PremiosRoletaProps[] = [
  {
    id: 8,
    idB: 108,
    nome: '5 Cotas',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'chave_vitoria_cota_1'
  }
]

/**
 * Cenário: O jogador não ganha nada na primeira jogada.
 * Resultado: Não ganhou.
 */
export const PREMIACAO_DERROTA: PremiosRoletaProps[] = [
  {
    id: 1,
    idB: 101,
    nome: 'Não foi dessa vez',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'chave_derrota_1'
  }
]

/**
 * Cenário: O jogador ganha um replay (nova chance) na primeira jogada.
 * Resultado: Giro Extra.
 */
export const PREMIACAO_REPLAY: PremiosRoletaProps[] = [
  {
    id: 10,
    idB: 110,
    nome: 'Giro Extra',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'chave_replay_1'
  }
]

// =============================================================================
// TESTES MANUAIS: Mocks adicionais para testar cenários específicos na UI
// =============================================================================

/**
 * Cenário: Todos os giros geram derrotas consecutivas
 * Uso: Testar comportamento de perda em sequência
 */
export const PREMIACAO_TODAS_DERROTAS: PremiosRoletaProps[] = [
  {
    id: 1,
    idB: 101,
    nome: 'Não foi dessa vez',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_derrota_1'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Tente amanhã',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_derrota_2'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Melhor sorte na próxima',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_derrota_3'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Não ganhou',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_derrota_4'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Sem prêmio',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_derrota_5'
  }
]

/**
 * Cenário: Todos os giros geram replays (cascata de giros extras)
 * Uso: Testar comportamento de botão bloqueado e múltiplos replays
 */
export const PREMIACAO_TODOS_REPLAYS: PremiosRoletaProps[] = [
  {
    id: 10,
    idB: 110,
    nome: 'Giro Extra! 🎉',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_replay_1'
  },
  {
    id: 10,
    idB: 110,
    nome: 'Mais um Giro!',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_replay_2'
  },
  {
    id: 10,
    idB: 110,
    nome: 'Continue girando!',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_replay_3'
  },
  {
    id: 10,
    idB: 110,
    nome: 'Sorte sua!',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_replay_4'
  },
  {
    id: 10,
    idB: 110,
    nome: 'Último giro extra',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_replay_5'
  }
]

/**
 * Cenário: Todos os giros geram ganhos (prêmios em dinheiro)
 * Uso: Testar acúmulo de valores e modal de vitórias
 */
export const PREMIACAO_TODOS_GANHOS_VALOR: PremiosRoletaProps[] = [
  {
    id: 3,
    idB: 103,
    nome: 'R$ 5,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_valor_1'
  },
  {
    id: 4,
    idB: 104,
    nome: 'R$ 10,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_valor_2'
  },
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_valor_3'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 100,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_valor_4'
  },
  {
    id: 3,
    idB: 103,
    nome: 'R$ 25,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_valor_5'
  }
]

/**
 * Cenário: Todos os giros geram ganho de cotas
 * Uso: Testar acúmulo de cotas e modal de cotas
 */
export const PREMIACAO_TODOS_GANHOS_COTA: PremiosRoletaProps[] = [
  {
    id: 7,
    idB: 107,
    nome: '1 Cota',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_cota_1'
  },
  {
    id: 8,
    idB: 108,
    nome: '5 Cotas',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_cota_2'
  },
  {
    id: 7,
    idB: 107,
    nome: '2 Cotas',
    valor: '2',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_cota_3'
  },
  {
    id: 8,
    idB: 108,
    nome: '10 Cotas',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_cota_4'
  },
  {
    id: 7,
    idB: 107,
    nome: '3 Cotas',
    valor: '3',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_cota_5'
  }
]

/**
 * Cenário: Padrão alternado ganho-perda-ganho
 * Uso: Testar mudança de estado e modal alternado
 */
export const PREMIACAO_ALTERNADO: PremiosRoletaProps[] = [
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: null,
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_alt_ganho_1'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Não foi dessa vez',
    valor: null,
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_alt_perda_1'
  },
  {
    id: 8,
    idB: 108,
    nome: '5 Cotas',
    valor: null,
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_alt_ganho_2'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Tente amanhã',
    valor: null,
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_alt_perda_2'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 100,00',
    valor: null,
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_alt_ganho_3'
  }
]

/**
 * Cenário: Prêmios de valores muito altos
 * Uso: Testar renderização de valores grandes no modal
 */
export const PREMIACAO_VALORES_ALTOS: PremiosRoletaProps[] = [
  {
    id: 6,
    idB: 106,
    nome: 'R$ 500,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_alto_1'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 1.000,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_alto_2'
  },
  {
    id: 8,
    idB: 108,
    nome: '50 Cotas Premium',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_alto_3'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 2.500,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_alto_4'
  },
  {
    id: 8,
    idB: 108,
    nome: '100 Cotas',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_alto_5'
  }
]

/**
 * Cenário: Sequência com "Girar Tudo" (10 giros)
 * Uso: Testar modal de "Girar Tudo" com múltiplos prêmios
 */
export const PREMIACAO_GIRAR_TUDO_10_GIROS: PremiosRoletaProps[] = [
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_tudo_1'
  },
  {
    id: 8,
    idB: 108,
    nome: '5 Cotas',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_tudo_2'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Não ganhou',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_tudo_3'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 100,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_tudo_4'
  },
  {
    id: 4,
    idB: 104,
    nome: 'R$ 10,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_tudo_5'
  },
  {
    id: 7,
    idB: 107,
    nome: '2 Cotas',
    valor: '2',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_tudo_6'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Tente de novo',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_tudo_7'
  },
  {
    id: 3,
    idB: 103,
    nome: 'R$ 5,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_tudo_8'
  },
  {
    id: 8,
    idB: 108,
    nome: '10 Cotas',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_tudo_9'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 200,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_tudo_10'
  }
]

/**
 * Cenário: Replay seguido de ganho (testa transição de replay para vitória)
 * Uso: Testar fluxo de replay bloqueando saída, depois desbloqueando
 */
export const PREMIACAO_REPLAY_DEPOIS_GANHO: PremiosRoletaProps[] = [
  {
    id: 10,
    idB: 110,
    nome: 'Giro Extra!',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_replay_ganho_1'
  },
  {
    id: 5,
    idB: 105,
    nome: 'R$ 75,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_replay_ganho_2'
  },
  {
    id: 10,
    idB: 110,
    nome: 'Mais um giro!',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_replay_ganho_3'
  },
  {
    id: 8,
    idB: 108,
    nome: '7 Cotas',
    valor: '7',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_replay_ganho_4'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Fim dos giros',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_replay_ganho_5'
  }
]

/**
 * Cenário: Pequenos ganhos (teste de UI com estado misto)
 * Uso: Testar renderização alternada de modais diferentes
 */
export const PREMIACAO_PEQUENOS_GANHOS: PremiosRoletaProps[] = [
  {
    id: 3,
    idB: 103,
    nome: 'R$ 1,00',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_pequeno_1'
  },
  {
    id: 3,
    idB: 103,
    nome: 'R$ 2,00',
    valor: '2',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_pequeno_2'
  },
  {
    id: 7,
    idB: 107,
    nome: '1 Cota',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_pequeno_3'
  },
  {
    id: 3,
    idB: 103,
    nome: 'R$ 3,00',
    valor: '3',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_pequeno_4'
  },
  {
    id: 7,
    idB: 107,
    nome: '1 Cota',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_pequeno_5'
  }
]

// =============================================================================
// SEQUÊNCIAS GIRAR TUDO: Terminam no modal girouTudo com composições específicas
// Pré-requisito: configure girosDisponiveis igual ao número de itens na sequência
// =============================================================================

/**
 * BUG 3 — ModalGanhou não desmonta quando ModalResgatePremio abre (dual modal)
 *
 * Sequência: 1 giro de valor → ehUltimoGiro = true → girouTudo
 * Resultado esperado: botão "Resgatar" abre ModalResgatePremio
 * Bug: ModalGanhou permanece montado com mesmo z-index (z-[100]) que ModalResgatePremio
 *
 * Como reproduzir:
 *   1. Configure girosDisponiveis = 1
 *   2. window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_VALOR_UNICO')
 *   3. Gire uma vez → modal girouTudo com "Resgatar"
 *   4. Clique "Resgatar" → observe se ModalResgatePremio aparece OU se parece sem ação
 */
export const PREMIACAO_GIRAR_TUDO_VALOR_UNICO: PremiosRoletaProps[] = [
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: '50',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'gt_bug3_valor_unico_1'
  }
]

/**
 * Fluxo correto: resgate automático (apenas cota)
 *
 * Sequência: 1 giro de cota → ehUltimoGiro = true → girouTudo
 * Resultado esperado: botão "Continuar" fecha o modal sem abrir PIX
 *
 * Como reproduzir:
 *   1. Configure girosDisponiveis = 1
 *   2. window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_COTA_UNICA')
 *   3. Gire → modal girouTudo com "Continuar" e "resgate automático"
 *   4. Clique "Continuar" → modal fecha. Nenhum formulário PIX deve aparecer.
 */
export const PREMIACAO_GIRAR_TUDO_COTA_UNICA: PremiosRoletaProps[] = [
  {
    id: 7,
    idB: 107,
    nome: '5 Cotas',
    valor: '5',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'gt_cota_unica_1'
  }
]

/**
 * BUG 3 — Dual modal com mix de cotas e valor
 *
 * Sequência: cota → derrota → valor (último giro) → girouTudo
 * Resultado esperado: resumo "X cotas + R$ 50,00", botão "Resgatar"
 * Bug: ao clicar "Resgatar" ambos os overlays ficam na DOM simultaneamente
 *
 * Como reproduzir:
 *   1. Configure girosDisponiveis = 3
 *   2. window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_COTAS_E_VALOR')
 *   3. Gire 3 vezes → modal girouTudo com resumo misto
 *   4. Clique "Resgatar" → inspecione o DOM: ModalGanhou ainda presente?
 */
export const PREMIACAO_GIRAR_TUDO_COTAS_E_VALOR: PremiosRoletaProps[] = [
  {
    id: 7,
    idB: 107,
    nome: '3 Cotas',
    valor: '3',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'gt_mix_cota_1'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Não foi dessa vez',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'gt_mix_derrota_1'
  },
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: '50',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'gt_mix_valor_1'
  }
]

/**
 * BUG 4 — tipoModalGanhou = 'ganhou' no meio do jogo (valor não é o último giro)
 *
 * Sequência: valor → derrota (2 giros totais)
 * Resultado esperado ao 1º giro: modal com botão "Continuar" (modo ganhou normal)
 * Bug simulado: se tipoModalGanhou vier como 'ganhou' mesmo no girouTudo,
 * o handleButtonClick emite 'continuar' em vez de 'resgatar' → modal fecha
 *
 * Como reproduzir:
 *   1. Configure girosDisponiveis = 2
 *   2. window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_VALOR_NAO_ULTIMO')
 *   3. Gire 1 vez → modal com "Continuar" (valor acumula, não abre PIX)
 *   4. Gire mais 1 → último giro é derrota → modal girouTudo com "Resgatar"
 *   5. Compare o comportamento do botão nos dois momentos
 */
export const PREMIACAO_GIRAR_TUDO_VALOR_NAO_ULTIMO: PremiosRoletaProps[] = [
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00',
    valor: '50',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'gt_bug4_valor_1'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Não ganhou',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'gt_bug4_derrota_1'
  }
]

// =============================================================================
// MOCKS DIRETOS premiosGirarTudo: Simulam o formato interno da prop
// Gerado por useGirarRoleta.ts: { nome, valor, tipo }
// Use para injetar diretamente via window.__ROLETA_MOCKS__.injectGirarTudo()
// =============================================================================

/**
 * Happy path: campo 'tipo' correto com valor monetário
 * Comportamento esperado: premiosValor.length = 1, temApenasCotas = false, botão "Resgatar"
 */
export const PREMIOS_GT_HAPPY_PATH_VALOR = [
  { nome: 'R$ 50,00', valor: 50, tipo: 'valor' }
]

/**
 * Happy path mix: cota + valor com campos corretos
 * Comportamento esperado: botão "Resgatar", resumo mostra ambos, PIX abre ao clicar
 */
export const PREMIOS_GT_HAPPY_PATH_MISTO = [
  { nome: '3 Cotas', valor: 3, tipo: 'cota' },
  { nome: 'R$ 50,00', valor: 50, tipo: 'valor' }
]

/**
 * Happy path: apenas cotas (resgate automático)
 * Comportamento esperado: temApenasCotas = true, botão "Continuar", sem PIX
 */
export const PREMIOS_GT_APENAS_COTAS = [
  { nome: '5 Cotas', valor: 5, tipo: 'cota' }
]

/**
 * BUG 1 — campo 'tipo_premio' em vez de 'tipo' (sem o campo 'tipo')
 *
 * Sintoma: p.tipo === undefined para todos os itens
 *   → RoletaModalBase: premiosValor = [], premiosCota = []
 *   → ModalGanhou v-if = false → modal NÃO ABRE
 *   → ModalGanhou.temApenasCotas = false (return false antes da checagem)
 *
 * Esse formato pode ocorrer se premiosGirarTudo for passado com objetos
 * em formato PremiosRoletaProps (com tipo_premio) em vez do formato interno.
 *
 * Para ver: use window.__ROLETA_MOCKS__.injectGirarTudo('BUG_CAMPO_TIPO_PREMIO')
 * e observe que o ModalGanhou não aparece mesmo com girosDisponiveis = 0
 */
export const PREMIOS_GT_BUG_CAMPO_TIPO_PREMIO: any[] = [
  { nome: 'R$ 50,00', valor: 50, tipo_premio: 'valor' }  // 'tipo' ausente → p.tipo === undefined
]

/**
 * BUG 1 variante — campo 'tipo' presente mas undefined
 *
 * Mesmo sintoma que BUG_CAMPO_TIPO_PREMIO.
 * Pode ocorrer se calcularValorTotalPremio retornar NaN ou se o map
 * em useGirarRoleta.ts receber um p.tipo_premio undefined.
 */
export const PREMIOS_GT_BUG_TIPO_UNDEFINED: any[] = [
  { nome: 'R$ 50,00', valor: 50, tipo: undefined }
]

/**
 * BUG dados — valor zerado (mapping de calcularValorTotalPremio retorna 0)
 *
 * Sintoma: premiosValor tem 1 item mas valor = 0
 *   → ModalResgatePremio abre com "Receba seu prêmio de R$ 0,00!"
 *   → Botão "Resgatar" funciona mas valor exibido é errado
 *
 * Pode ocorrer se o campo 'valor' no PremiosRoletaProps for '0' ou não numérico
 * quando calcularValorTotalPremio tenta converter.
 */
export const PREMIOS_GT_BUG_VALOR_ZERADO: any[] = [
  { nome: 'R$ 50,00', valor: 0, tipo: 'valor' }  // valor = 0 apesar do nome indicar 50
]

// =============================================================================
// CENÁRIOS DE NOMES LONGOS (existente abaixo)
// =============================================================================

/**
 * Cenário: Nomes longos em prêmios (teste de layout/overflow)
 * Uso: Testar renderização de nomes muito longos no modal
 */
export const PREMIACAO_NOMES_LONGOS: PremiosRoletaProps[] = [
  {
    id: 5,
    idB: 105,
    nome: 'R$ 50,00 - Desconto exclusivo em sua próxima compra',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_longo_1'
  },
  {
    id: 8,
    idB: 108,
    nome: '5 Cotas - Bônus especial para clientes VIP',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'cota',
    chave_giro: 'manual_longo_2'
  },
  {
    id: 10,
    idB: 110,
    nome: 'Giro Extra - Você tem mais uma chance de ganhar prêmios!',
    valor: '0',
    tipo_acao: 'replay',
    tipo_premio: 'replay',
    chave_giro: 'manual_longo_3'
  },
  {
    id: 1,
    idB: 101,
    nome: 'Esta vez a sorte não foi a seu favor, mas tente novamente amanhã!',
    valor: '0',
    tipo_acao: 'nao_ganhou',
    tipo_premio: 'nao_ganhou',
    chave_giro: 'manual_longo_4'
  },
  {
    id: 6,
    idB: 106,
    nome: 'R$ 100,00 - Valioso prêmio em dinheiro para você gastar como quiser',
    valor: '1',
    tipo_acao: 'ganhou',
    tipo_premio: 'valor',
    chave_giro: 'manual_longo_5'
  }
]
