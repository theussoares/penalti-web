import type { PenaltyPlayResult } from '../types/game'

/**
 * Cenarios fixos para testar fluxos de UI sem depender do gerador aleatorio
 * de devHostSimulator.ts. Selecionaveis via query string `?cenario=<chave>`
 * (ver pickScenario em devHostSimulator.ts).
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
