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
