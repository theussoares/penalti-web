import { ref } from 'vue'

export type ModalState =
  | 'none'
  | 'gol'
  | 'defendeu'
  | 'chute-extra'
  | 'chutar-tudo-confirmar'
  | 'chutar-tudo-progresso'
  | 'resumo-sessao'
  | 'sem-premio'

export function useGameModals() {
  const modal = ref<ModalState>('none')

  function closeModal() {
    modal.value = 'none'
  }

  function openGolModal() {
    modal.value = 'gol'
  }

  function openDefendeuModal() {
    modal.value = 'defendeu'
  }

  function openChuteExtraModal() {
    modal.value = 'chute-extra'
  }

  function openChutarTudoConfirm() {
    modal.value = 'chutar-tudo-confirmar'
  }

  function openChutarTudoProgresso() {
    modal.value = 'chutar-tudo-progresso'
  }

  function openResumoSessao() {
    modal.value = 'resumo-sessao'
  }

  function openSemPremio() {
    modal.value = 'sem-premio'
  }

  return {
    modal,
    closeModal,
    openGolModal,
    openDefendeuModal,
    openChuteExtraModal,
    openChutarTudoConfirm,
    openChutarTudoProgresso,
    openResumoSessao,
    openSemPremio
  }
}
