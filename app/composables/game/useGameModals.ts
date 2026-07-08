import { ref } from 'vue'

export type ModalState =
  | 'none'
  | 'gol'
  | 'defendeu'
  | 'chute-extra'
  | 'chutar-tudo-confirmar'
  | 'chutar-tudo-progresso'
  | 'resumo-tudo'

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

  function openResumoTudo() {
    modal.value = 'resumo-tudo'
  }

  return {
    modal,
    closeModal,
    openGolModal,
    openDefendeuModal,
    openChuteExtraModal,
    openChutarTudoConfirm,
    openChutarTudoProgresso,
    openResumoTudo
  }
}
