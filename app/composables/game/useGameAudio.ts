import { ref } from 'vue'
import { Sfx } from '~/game/sfx'

export function useGameAudio() {
  const sfx = new Sfx()
  const muted = ref(false)

  function toggleMute() {
    muted.value = !muted.value
    sfx.setMuted(muted.value)
  }

  function handleVisibilityChange() {
    sfx.handleVisibility(document.hidden)
  }

  function destroyAudio() {
    sfx.destroy()
  }

  return {
    sfx,
    muted,
    toggleMute,
    handleVisibilityChange,
    destroyAudio
  }
}
