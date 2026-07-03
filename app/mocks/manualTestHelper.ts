/**
 * 🧪 MANUAL TEST HELPER - Roleta Dev Mode
 * 
 * Use este arquivo para injetar mocks durante desenvolvimento/testes manuais
 * SEM modificar o código de produção.
 * 
 * Funciona via Pinia store (roletaTestMode) que gerencia estado de testes
 * Não afeta produção nem outros jogos (Raspadinha, Caixinha, Bau)
 * 
 * Instruções:
 * 1. Abra DevTools (F12)
 * 2. No console, execute: window.__ROLETA_MOCKS__.help()
 * 3. Use os comandos para injetar mocks diferentes
 */

import {
   PREMIACAO_TODAS_DERROTAS,
   PREMIACAO_TODOS_REPLAYS,
   PREMIACAO_TODOS_GANHOS_VALOR,
   PREMIACAO_TODOS_GANHOS_COTA,
   PREMIACAO_ALTERNADO,
   PREMIACAO_VALORES_ALTOS,
   PREMIACAO_GIRAR_TUDO_10_GIROS,
   PREMIACAO_REPLAY_DEPOIS_GANHO,
   PREMIACAO_PEQUENOS_GANHOS,
   PREMIACAO_NOMES_LONGOS,
   PREMIACAO_GIRAR_TUDO_VALOR_UNICO,
   PREMIACAO_GIRAR_TUDO_COTA_UNICA,
   PREMIACAO_GIRAR_TUDO_COTAS_E_VALOR,
   PREMIACAO_GIRAR_TUDO_VALOR_NAO_ULTIMO,
   PREMIOS_GT_HAPPY_PATH_VALOR,
   PREMIOS_GT_HAPPY_PATH_MISTO,
   PREMIOS_GT_APENAS_COTAS,
   PREMIOS_GT_BUG_CAMPO_TIPO_PREMIO,
   PREMIOS_GT_BUG_TIPO_UNDEFINED,
   PREMIOS_GT_BUG_VALOR_ZERADO,
} from './index'

import { useRoletaTestMode } from '../stores/roletaTestMode'
import { devLog, devLogError, devLogWarn, devLogGroup, devLogGroupEnd } from '../lib/devLogger'

/** Catálogo de Mocks para Testes Manuais */
export const MANUAL_TEST_SCENARIOS = {
   TODAS_DERROTAS: PREMIACAO_TODAS_DERROTAS,
   TODOS_REPLAYS: PREMIACAO_TODOS_REPLAYS,
   TODOS_GANHOS_VALOR: PREMIACAO_TODOS_GANHOS_VALOR,
   TODOS_GANHOS_COTA: PREMIACAO_TODOS_GANHOS_COTA,
   ALTERNADO: PREMIACAO_ALTERNADO,
   VALORES_ALTOS: PREMIACAO_VALORES_ALTOS,
   GIRAR_TUDO_10_GIROS: PREMIACAO_GIRAR_TUDO_10_GIROS,
   REPLAY_DEPOIS_GANHO: PREMIACAO_REPLAY_DEPOIS_GANHO,
   PEQUENOS_GANHOS: PREMIACAO_PEQUENOS_GANHOS,
   NOMES_LONGOS: PREMIACAO_NOMES_LONGOS,
   // Cenários específicos do fluxo girouTudo (requerem girosDisponiveis correto)
   GIRAR_TUDO_VALOR_UNICO: PREMIACAO_GIRAR_TUDO_VALOR_UNICO,      // precisa girosDisponiveis=1
   GIRAR_TUDO_COTA_UNICA: PREMIACAO_GIRAR_TUDO_COTA_UNICA,        // precisa girosDisponiveis=1
   GIRAR_TUDO_COTAS_E_VALOR: PREMIACAO_GIRAR_TUDO_COTAS_E_VALOR,  // precisa girosDisponiveis=3
   GIRAR_TUDO_VALOR_NAO_ULTIMO: PREMIACAO_GIRAR_TUDO_VALOR_NAO_ULTIMO, // precisa girosDisponiveis=2
}

/**
 * Catálogo de mocks para a prop premiosGirarTudo (formato interno { nome, valor, tipo })
 * Use com: window.__ROLETA_MOCKS__.injectGirarTudo('NOME_CENARIO')
 */
export const GIRAR_TUDO_PROP_SCENARIOS: Record<string, any[]> = {
   // Happy paths
   HAPPY_PATH_VALOR: PREMIOS_GT_HAPPY_PATH_VALOR,
   HAPPY_PATH_MISTO: PREMIOS_GT_HAPPY_PATH_MISTO,
   APENAS_COTAS: PREMIOS_GT_APENAS_COTAS,
   // Bugs
   BUG_CAMPO_TIPO_PREMIO: PREMIOS_GT_BUG_CAMPO_TIPO_PREMIO,
   BUG_TIPO_UNDEFINED: PREMIOS_GT_BUG_TIPO_UNDEFINED,
   BUG_VALOR_ZERADO: PREMIOS_GT_BUG_VALOR_ZERADO,
}

/**
 * Injeta um mock de cenário no estado da Roleta via Store
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.injectScenario('TODAS_DERROTAS')
 * window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_10_GIROS')
 */
export function injectScenario(scenarioName: string) {
   const scenario = MANUAL_TEST_SCENARIOS[scenarioName as keyof typeof MANUAL_TEST_SCENARIOS]

   if (!scenario) {
      devLogError(
         `❌ Cenário não encontrado: "${scenarioName}"\n` +
         `Cenários disponíveis: ${Object.keys(MANUAL_TEST_SCENARIOS).join(', ')}`
      )
      return false
   }

   // Usar store para injetar
   const testStore = useRoletaTestMode()
   testStore.setMockAtual(scenario, scenarioName)

   devLog(`🎲 Injetando cenário: ${scenarioName}`)
   devLog(`📊 ${scenario.length} giros carregados:`)
   scenario.forEach((p, i) => {
      const tipo = p.tipo_premio === 'valor' ? '💰' : p.tipo_premio === 'cota' ? '🎟️' : '❌'
      const desc = p.tipo_acao === 'ganhou'
         ? `${p.nome}`
         : p.tipo_acao === 'replay'
            ? '🔄 Giro Extra'
            : '❌ Sem Prêmio'
      devLog(`  ${i + 1}. ${tipo} ${desc}`)
   })

   devLogGroup('✅ Mock injetado com sucesso!')
   devLog(`Próxima vez que girar, usará este cenário`)
   devLogGroupEnd()

   return true
}

/**
 * Lista todos cenários disponíveis
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.listScenarios()
 */
export function listScenarios() {
   devLog('📋 Cenários Disponíveis para Testes Manuais:')
   devLog('='.repeat(60))

   Object.entries(MANUAL_TEST_SCENARIOS).forEach(([name, data]) => {
      const summary = data.slice(0, 3).map(p =>
         p.tipo_acao === 'ganhou' ? `${p.tipo_premio}` : p.tipo_acao
      ).join(' → ')
      devLog(`  • ${name.padEnd(30)} | ${data.length} giros | ${summary}...`)
   })

   devLog('='.repeat(60))
   devLog(`Usar: window.__ROLETA_MOCKS__.injectScenario('NOME_CENARIO')`)
}

/**
 * Exibe detalhes completos de um cenário
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.showScenarioDetails('GIRAR_TUDO_10_GIROS')
 */
export function showScenarioDetails(scenarioName: string) {
   const scenario = MANUAL_TEST_SCENARIOS[scenarioName as keyof typeof MANUAL_TEST_SCENARIOS]

   if (!scenario) {
      devLogError(`❌ Cenário não encontrado: "${scenarioName}"`)
      return
   }

   devLogGroup(`📊 Detalhes: ${scenarioName}`)
   devLog(`Total de giros: ${scenario.length}`)

   scenario.forEach((p, i) => {
      devLogGroup(`Giro ${i + 1}`)
      devLog(`Nome: ${p.nome}`)
      devLog(`Valor: ${p.valor}`)
      devLog(`Tipo Ação: ${p.tipo_acao}`)
      devLog(`Tipo Prêmio: ${p.tipo_premio}`)
      devLog(`ID: ${p.id} | IDB: ${p.idB}`)
      devLog(`Chave Giro: ${p.chave_giro}`)
      devLogGroupEnd()
   })

   devLogGroupEnd()
}

/**
 * Exportar cenário como JSON (para copiar/colar em outro lugar)
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.exportScenarioJSON('TODOS_REPLAYS')
 */
export function exportScenarioJSON(scenarioName: string) {
   const scenario = MANUAL_TEST_SCENARIOS[scenarioName as keyof typeof MANUAL_TEST_SCENARIOS]

   if (!scenario) {
      devLogError(`❌ Cenário não encontrado: "${scenarioName}"`)
      return
   }

   const json = JSON.stringify(scenario, null, 2)
   devLog(`📋 Cenário "${scenarioName}" como JSON:`)
   devLog(json)

   // Copiar para clipboard
   navigator.clipboard.writeText(json).then(() => {
      devLog('✅ Copiado para clipboard!')
   })
}

/**
 * Injeta um mock diretamente na prop premiosGirarTudo via window global
 * Útil para testar os bugs de campo (tipo vs tipo_premio) sem precisar girar
 *
 * Uso:
 * window.__ROLETA_MOCKS__.injectGirarTudo('HAPPY_PATH_VALOR')
 * window.__ROLETA_MOCKS__.injectGirarTudo('BUG_CAMPO_TIPO_PREMIO')
 *
 * Atenção: requer que o componente leia window.__GT_MOCK__ no mounted/watch.
 * Use apenas para inspeção manual de estado — não afeta o fluxo de premiação.
 */
export function injectGirarTudo(scenarioName: string) {
   const scenario = GIRAR_TUDO_PROP_SCENARIOS[scenarioName]

   if (!scenario) {
      devLogError(
         `❌ Cenário premiosGirarTudo não encontrado: "${scenarioName}"\n` +
         `Cenários disponíveis: ${Object.keys(GIRAR_TUDO_PROP_SCENARIOS).join(', ')}`
      )
      return false
   }

   // Expõe via window para inspeção no DevTools
   ;(window as any).__GT_MOCK__ = scenario

   devLogGroup(`🎟️ premiosGirarTudo mock: ${scenarioName}`)
   scenario.forEach((p: any, i: number) => {
      const tipoDisplay = p.tipo ?? p.tipo_premio ?? 'CAMPO_AUSENTE'
      devLog(`  ${i + 1}. tipo="${tipoDisplay}" | valor=${p.valor} | nome="${p.nome}"`)
   })
   devLog(``)
   devLog(`Acesse via: window.__GT_MOCK__`)
   devLog(`Para usar como prop: :premiosGirarTudo="window.__GT_MOCK__"`)
   devLogGroupEnd()

   return true
}

/**
 * Lista cenários de premiosGirarTudo disponíveis
 *
 * Uso:
 * window.__ROLETA_MOCKS__.listGirarTudoScenarios()
 */
export function listGirarTudoScenarios() {
   devLog('📋 Cenários premiosGirarTudo (prop direta):')
   devLog('='.repeat(60))

   Object.entries(GIRAR_TUDO_PROP_SCENARIOS).forEach(([name, data]) => {
      const tiposCampo = data.map((p: any) =>
         'tipo' in p ? `tipo="${p.tipo ?? 'undefined'}"` : 'sem campo tipo'
      ).join(', ')
      const isBug = name.startsWith('BUG') ? '⚠️ BUG' : '✅ OK'
      devLog(`  ${isBug} ${name.padEnd(28)} | ${tiposCampo}`)
   })

   devLog('='.repeat(60))
   devLog(`Usar: window.__ROLETA_MOCKS__.injectGirarTudo('NOME_CENARIO')`)
}

/**
 * Criar um mix customizado de cenários
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.mixScenarios(['TODOS_GANHOS_VALOR', 'TODOS_REPLAYS'])
 */
export function mixScenarios(scenarioNames: string[]) {
   const mixed = scenarioNames.flatMap(name => {
      const scenario = MANUAL_TEST_SCENARIOS[name as keyof typeof MANUAL_TEST_SCENARIOS]
      if (!scenario) {
         devLogWarn(`⚠️ Cenário não encontrado: "${name}"`)
         return []
      }
      return scenario
   })

   if (mixed.length === 0) {
      devLogError('❌ Nenhum cenário válido selecionado')
      return
   }

   const testStore = useRoletaTestMode()
   testStore.setMockAtual(mixed, `MIX(${scenarioNames.join('+')})`)

   devLog(`🎲 Mix criado com ${mixed.length} giros:`)
   devLog('✅ Pronto para usar!')
}

/**
 * Gerar relatório de cobertura de testes
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.generateCoverageReport()
 */
export function generateCoverageReport() {
   devLogGroup('📋 Relatório de Cobertura de Cenários')

   const stats = {
      totalGiros: 0,
      totalGanhos: 0,
      totalReplays: 0,
      totalDerrotas: 0,
      tiposValue: 0,
      tiposCota: 0,
   }

   Object.entries(MANUAL_TEST_SCENARIOS).forEach(([name, scenario]) => {
      stats.totalGiros += scenario.length
      scenario.forEach(p => {
         if (p.tipo_acao === 'ganhou') stats.totalGanhos++
         else if (p.tipo_acao === 'replay') stats.totalReplays++
         else stats.totalDerrotas++

         if (p.tipo_premio === 'valor') stats.tiposValue++
         else if (p.tipo_premio === 'cota') stats.tiposCota++
      })
   })

   devLog(`Total de Cenários: ${Object.keys(MANUAL_TEST_SCENARIOS).length}`)
   devLog(`Total de Giros: ${stats.totalGiros}`)
   devLog(`Ganhos: ${stats.totalGanhos} (${((stats.totalGanhos / stats.totalGiros) * 100).toFixed(1)}%)`)
   devLog(`Replays: ${stats.totalReplays} (${((stats.totalReplays / stats.totalGiros) * 100).toFixed(1)}%)`)
   devLog(`Derrotas: ${stats.totalDerrotas} (${((stats.totalDerrotas / stats.totalGiros) * 100).toFixed(1)}%)`)
   devLog(`Valores: ${stats.tiposValue}`)
   devLog(`Cotas: ${stats.tiposCota}`)
   devLogGroupEnd()
}

/**
 * Ativar/Desativar Dev Mode
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.toggleDevMode()
 * ou pressione F2
 */
export function toggleDevMode() {
   const testStore = useRoletaTestMode()
   const isActive = testStore.isDevMode

   if (isActive) {
      testStore.desativarDevMode()
      devLog('🔴 Dev Mode DESATIVADO')
   } else {
      testStore.ativarDevMode()
      devLog('🟢 Dev Mode ATIVADO - Agora você pode injetar mocks!')
      devLog('💡 Digite window.__ROLETA_MOCKS__.help() para ver seus comandos')
   }

   return !isActive
}

/**
 * Verifica se está rodando em localhost (segurança)
 */
function isLocalhost(): boolean {
   if (typeof window === 'undefined') return false
   const hostname = window.location.hostname
   return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')
}

/**
 * Configurar atalho F2 para ativar/desativar Dev Mode
 * Funciona APENAS em localhost (desenvolvimento local)
 */
export function setupF2Shortcut() {
   if (typeof window === 'undefined' || !isLocalhost()) return

   window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'F2') {
         event.preventDefault()
         toggleDevMode()
      }
   })
}

/**
 * Exibir menu de ajuda
 * 
 * Uso:
 * window.__ROLETA_MOCKS__.help()
 */
export function help() {
   devLog(`
╔════════════════════════════════════════════════════════════════╗
║          🎲 ROLETA MANUAL TEST HELPER - Menu de Ajuda         ║
╚════════════════════════════════════════════════════════════════╝

⌨️ ATALHOS DE TECLADO:

  F2  →  Ativar/Desativar Dev Mode

📍 CENÁRIOS DE PREMIAÇÃO (sequências de giro):

  🎯 Ativar/Desativar Dev Mode:
     window.__ROLETA_MOCKS__.toggleDevMode()

  🎯 Injetar Cenário:
     window.__ROLETA_MOCKS__.injectScenario('TODAS_DERROTAS')
     window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_10_GIROS')

  ⚠️  Cenários girouTudo (configure girosDisponiveis antes):
     window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_VALOR_UNICO')     // girosDisp=1 | Bug 3
     window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_COTA_UNICA')      // girosDisp=1 | resgate auto
     window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_COTAS_E_VALOR')   // girosDisp=3 | Bug 3 mix
     window.__ROLETA_MOCKS__.injectScenario('GIRAR_TUDO_VALOR_NAO_ULTIMO')// girosDisp=2 | Bug 4

  📋 Listar Todos os Cenários:
     window.__ROLETA_MOCKS__.listScenarios()

  🔍 Detalhes de Cenário:
     window.__ROLETA_MOCKS__.showScenarioDetails('GIRAR_TUDO_COTAS_E_VALOR')

  📥 Exportar como JSON:
     window.__ROLETA_MOCKS__.exportScenarioJSON('VALORES_ALTOS')

  🎲 Mix Customizado:
     window.__ROLETA_MOCKS__.mixScenarios(['TODOS_GANHOS_VALOR', 'TODOS_REPLAYS'])

  📊 Relatório de Cobertura:
     window.__ROLETA_MOCKS__.generateCoverageReport()

🎟️  MOCKS DIRETOS premiosGirarTudo (formato interno { nome, valor, tipo }):

  Injetar para inspeção/debug:
     window.__ROLETA_MOCKS__.injectGirarTudo('HAPPY_PATH_VALOR')      // ✅ campo tipo correto
     window.__ROLETA_MOCKS__.injectGirarTudo('HAPPY_PATH_MISTO')      // ✅ cota + valor correto
     window.__ROLETA_MOCKS__.injectGirarTudo('APENAS_COTAS')          // ✅ resgate automático
     window.__ROLETA_MOCKS__.injectGirarTudo('BUG_CAMPO_TIPO_PREMIO') // ⚠️ Bug 1: tipo_premio sem tipo
     window.__ROLETA_MOCKS__.injectGirarTudo('BUG_TIPO_UNDEFINED')    // ⚠️ Bug 1 variante
     window.__ROLETA_MOCKS__.injectGirarTudo('BUG_VALOR_ZERADO')      // ⚠️ Exibe R$ 0,00 no modal

  Listar cenários de prop:
     window.__ROLETA_MOCKS__.listGirarTudoScenarios()

  Acessar o dado injetado:
     window.__GT_MOCK__

🆘 Mostrar Este Menu:
     window.__ROLETA_MOCKS__.help()

════════════════════════════════════════════════════════════════

✨ DICAS:
  • Pressione F2 para ativar Dev Mode rapidamente
  • Cenários GIRAR_TUDO_* precisam de girosDisponiveis configurado corretamente
  • Logs aparecem APENAS em Dev Mode

═══════════════════════════════════════════════════════════════════
  `)
}

/**
 * Inicializar o helper no window
 * Use em um arquivo de inicialização global
 * 
 * Só funciona em localhost (segurança contra injeção em produção)
 */
export function setupManualTestHelper() {
   // Segurança: só setup em localhost
   if (!isLocalhost()) {
      return
   }

   window.__ROLETA_MOCKS__ = {
      toggleDevMode,
      injectScenario,
      listScenarios,
      showScenarioDetails,
      exportScenarioJSON,
      mixScenarios,
      generateCoverageReport,
      help,
      injectGirarTudo,
      listGirarTudoScenarios,
   }

   // Configurar F2 shortcut (já tem validação de localhost interna)
   setupF2Shortcut()

   devLog('✅ Roleta Manual Test Helper carregado!')
   devLog('💡 Pressione F2 para ativar Dev Mode, ou digite window.__ROLETA_MOCKS__.help()')
}

// ============================================================================
// AUTO-SETUP EM DEV MODE + LOCALHOST
// ============================================================================
// Inicializa automaticamente apenas se:
// 1. Estamos em NODE_ENV === 'development'
// 2. Rodando em localhost (127.0.0.1, 192.168.*, ou localhost)
// Garante que funcionalidades de dev NÃO apareçam em produção
// ============================================================================

declare global {
   interface Window {
      __ROLETA_MOCKS__?: {
         toggleDevMode: () => boolean
         injectScenario: (name: string) => void
         listScenarios: () => void
         showScenarioDetails: (name: string) => void
         exportScenarioJSON: (name: string) => void
         mixScenarios: (names: string[]) => void
         generateCoverageReport: () => void
         help: () => void
         injectGirarTudo: (name: string) => boolean
         listGirarTudoScenarios: () => void
      }
      __GT_MOCK__?: any[]
   }
}

// Inicializar automaticamente se em dev mode e localhost
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
   setupManualTestHelper()
}

export default {
   MANUAL_TEST_SCENARIOS,
   GIRAR_TUDO_PROP_SCENARIOS,
   toggleDevMode,
   injectScenario,
   listScenarios,
   showScenarioDetails,
   exportScenarioJSON,
   mixScenarios,
   generateCoverageReport,
   help,
   injectGirarTudo,
   listGirarTudoScenarios,
   setupManualTestHelper,
}
