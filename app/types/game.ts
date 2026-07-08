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
