# 🎲 Mocks para Testes Manuais da Roleta

## 📋 Como Usar

Para testar a Roleta manualmente com diferentes cenários, importe os mocks desejados em seu composable ou use via Dev Tools.

### Opção 1: No Composable (Dev)

```typescript
// Em useGerarSorteio.ts ou seu file de composable
import { 
  PREMIACAO_TODOS_REPLAYS,
  PREMIACAO_TODAS_DERROTAS,
  PREMIACAO_GIRAR_TUDO_10_GIROS,
  // ... outros mocks
} from '@/mocks'

// Diretamente na função para testar:
premiosRoleta.value = PREMIOS_RODA_8_FATIAS
premiacao.value = PREMIACAO_TODOS_REPLAYS // ← Mude como desejar
```

### Opção 2: Via Console Dev Tools

```javascript
// Abra DevTools (F12)
// No console, execute:

import('@/mocks').then(m => {
  window.MOCKS = m
  console.log('Mocks carregados:', Object.keys(m))
})

// Depois mude o estado da Roleta:
// window.MOCKS.PREMIACAO_TODOS_REPLAYS
```

---

## 🎯 Mocks Disponíveis para Testes Manuais

### 1. **PREMIACAO_TODAS_DERROTAS** ❌
**Cenário:** Todos os giros resultam em derrotas
```
Giro 1: Não foi dessa vez
Giro 2: Tente amanhã
Giro 3: Melhor sorte na próxima
Giro 4: Não ganhou
Giro 5: Sem prêmio
```
**Testa:** Modal "Perdeu Tudo", mensagens alternadas, contador de giros

---

### 2. **PREMIACAO_TODOS_REPLAYS** 🔄
**Cenário:** Cascata de giros extras (bloqueio de saída)
```
Giro 1: Giro Extra! 🎉
Giro 2: Mais um Giro!
Giro 3: Continue girando!
Giro 4: Sorte sua!
Giro 5: Último giro extra
```
**Testa:** 
- Botão "Sair" bloqueado (ultimoResultadoFoiReplay = true)
- Modal de Replay
- Transição entre replays

---

### 3. **PREMIACAO_TODOS_GANHOS_VALOR** 💰
**Cenário:** Todos os giros geram dinheiro
```
Giro 1: R$ 5,00
Giro 2: R$ 10,00
Giro 3: R$ 50,00
Giro 4: R$ 100,00
Giro 5: R$ 25,00
```
**Testa:** 
- Acúmulo de valores
- Modal "Ganhou Valor"
- Renderização de valores

---

### 4. **PREMIACAO_TODOS_GANHOS_COTA** 🎟️
**Cenário:** Todos os giros geram cotas
```
Giro 1: 1 Cota
Giro 2: 5 Cotas
Giro 3: 2 Cotas
Giro 4: 10 Cotas
Giro 5: 3 Cotas
```
**Testa:** 
- Acúmulo de cotas
- Modal "Ganhou Cota"
- Formatação de cotas

---

### 5. **PREMIACAO_ALTERNADO** 🔁
**Cenário:** Padrão alternado ganho → perda → ganho
```
Giro 1: R$ 50,00 ✓
Giro 2: Não foi dessa vez ✗
Giro 3: 5 Cotas ✓
Giro 4: Tente amanhã ✗
Giro 5: R$ 100,00 ✓
```
**Testa:** 
- Mudança de estado modal
- Renderização alternada
- Transição entre derrotas/vitórias

---

### 6. **PREMIACAO_VALORES_ALTOS** 🤑
**Cenário:** Prêmios com valores muito altos
```
Giro 1: R$ 500,00
Giro 2: R$ 1.000,00
Giro 3: 50 Cotas Premium
Giro 4: R$ 2.500,00
Giro 5: 100 Cotas
```
**Testa:** 
- Renderização de números grandes
- Overflow de texto no modal
- Formatação monetária

---

### 8. **PREMIACAO_GIRAR_TUDO_10_GIROS** 🎊
**Cenário:** Sequência para o modal "Girar Tudo"
```
Giro 1: R$ 50,00
Giro 2: 5 Cotas
Giro 3: Não ganhou
Giro 4: R$ 100,00
Giro 5: R$ 10,00
Giro 6: 2 Cotas
Giro 7: Tente de novo
Giro 8: R$ 5,00
Giro 9: 10 Cotas
Giro 10: R$ 200,00
```
**Testa:** 
- Modal "Girar Tudo" com múltiplos prêmios
- Lista de resultados
- Cálculo de totais

---

### 9. **PREMIACAO_REPLAY_DEPOIS_GANHO** 🎯
**Cenário:** Replay bloqueando, depois desbloqueando com ganho
```
Giro 1: Giro Extra! (bloqueado)
Giro 2: R$ 75,00 (desbloqueado)
Giro 3: Mais um giro! (bloqueado novamente)
Giro 4: 7 Cotas (desbloqueado)
Giro 5: Fim dos giros (derrota)
```
**Testa:** 
- Transição replay → ganho
- Bloqueio/desbloqueio de botão
- Modal alternado

---

### 10. **PREMIACAO_PEQUENOS_GANHOS** 💵
**Cenário:** Ganhos pequenos (UI stress test)
```
Giro 1: R$ 1,00
Giro 2: R$ 2,00
Giro 3: 1 Cota
Giro 4: R$ 3,00
Giro 5: 1 Cota
```
**Testa:** 
- Renderização de valores pequenos
- Múltiplos modais rápidos
- Performance com cliques frequentes

---

### 11. **PREMIACAO_NOMES_LONGOS** 📝
**Cenário:** Prêmios com nomes muito longos (overflow test)
```
Giro 1: R$ 50,00 - Desconto exclusivo em sua próxima compra
Giro 2: 5 Cotas - Bônus especial para clientes VIP
Giro 3: Giro Extra - Você tem mais uma chance de ganhar prêmios!
Giro 4: Esta vez a sorte não foi a seu favor, mas tente novamente amanhã!
Giro 5: R$ 100,00 - Valioso prêmio em dinheiro para você gastar como quiser
```
**Testa:** 
- Quebra de linhas no modal
- Responsividade com texto longo
- Overflow e ellipsis

---

## 🔍 Checklist de Testes Manuais

Use os mocks para validar:

### 🎲 Comportamento de Giro
- [ ] Rotação suave da roda
- [ ] Animação de velocidade (5 voltas)
- [ ] Duração da animação (2 segundos)
- [ ] Alinhamento do prêmio no centro

### 📊 Modais
- [ ] ModalGanhou exibe com sucesso
- [ ] ModalPerdeuTudo exibe com sucesso
- [ ] ModalGirarTudo lista todos os 10 prêmios
- [ ] ModalReplay bloqueia botão "Sair"
- [ ] Fechar modal não apaga histórico

### 🔘 Botões
- [ ] Botão "Girar" desabilitado durante animação
- [ ] Botão "Girar" desabilitado quando carregando
- [ ] Botão "Sair" desabilitado com ultimoResultadoFoiReplay
- [ ] Botão "Sair" ativa confirmação modal

### 💾 Dados
- [ ] Histórico acumula corretamente
- [ ] Giros disponíveis decrementam (mas NÃO replay)
- [ ] Requisiçõ de persistência enviadas (com chave_giro)
- [ ] Estados visuais sincronizam (roda, botões, modais)

### 🎨 UI/UX
- [ ] Cores primária/secundária aplicadas
- [ ] Responsividade em mobile
- [ ] Textos não sofrem overflow
- [ ] Modais centrados e legíveis
- [ ] Transições suaves entre estados

---

## 💡 Dicas de Teste

### Teste 1: Fluxo Completo
```javascript
// 1. Importe PREMIACAO_ALTERNADO
// 2. Clique "Girar" 5 vezes
// 3. Valide: modal muda (ganho → perda), histórico cresce
// 4. Clique "Sair" → modal de confirmação
// 5. Clique "Fechar" → dados enviados na requisição
```

### Teste 2: Botão Bloqueado
```javascript
// 1. Importe PREMIACAO_TODOS_REPLAYS
// 2. Clique "Girar" até 5 replays
// 3. Valide: botão "Sair" SEMPRE DESABILITADO
// 4. Após 5 replays, botão deve desabilitar finalmente
```

### Teste 3: Requisição de Persistência
```javascript
// 1. Abra DevTools → Network
// 2. Importe PREMIACAO_TODOS_GANHOS_VALOR
// 3. Clique "Girar"
// 4. Valide POST para /roletas/giros/v2 com chave_giro
```

### Teste 4: Valores Grandes
```javascript
// 1. Importe PREMIACAO_VALORES_ALTOS
// 2. Clique "Girar" → modal deve renderizar R$ 2.500,00
// 3. Valide: formatação, quebra de linha, responsividade
```

---

## 🐛 Debugging

### Logs Importante
```typescript
// Console já loga muita coisa:
[🎯 buscarPremiosRoleta] Chamada com chaveGiro: ...
[🎯 buscarPremiosRoleta] Payload: { ... }
[🎯 buscarPremiosRoleta] Headers: { ... }
```

### Inspecionar Estado
```javascript
// No DevTools:
window.__ROLETA_STATE__ = {
  girando: false,
  rotacao: 0,
  historico: [...],
  ultimoResultadoFoiReplay: false,
  botaoGirarDesabilitado: false,
  mostrarModal: false
}
```

---

## 🚀 Resumo Rápido

| Mock | Giros | Melhor Para | Status |
|------|-------|-----------|--------|
| TODAS_DERROTAS | 5 ❌ | Testar derrota | ✅ |
| TODOS_REPLAYS | 5 🔄 | Testar replay | ✅ |
| TODOS_GANHOS_VALOR | 5 💰 | Testar valor | ✅ |
| TODOS_GANHOS_COTA | 5 🎟️ | Testar cota | ✅ |
| ALTERNADO | 5 🔁 | Testar transição | ✅ |
| VALORES_ALTOS | 5 🤑 | Testar overflow | ✅ |
| GIRAR_TUDO_10_GIROS | 10 🎊 | Testar modal batch | ✅ |
| REPLAY_DEPOIS_GANHO | 5 🎯 | Testar bloqueio | ✅ |
| PEQUENOS_GANHOS | 5 💵 | Testar stress | ✅ |
| NOMES_LONGOS | 5 📝 | Testar overflow | ✅ |

---

✨ **Divirta-se testando!** ✨
