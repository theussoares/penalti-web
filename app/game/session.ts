import type { PenaltyPlayResult } from '~/types/game'

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
