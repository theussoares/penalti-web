<template>
  <button
    :class="[
      'h-12 w-full text-base font-bold rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity'
    ]"
    :style="styleObject"
    :disabled="props.disabled"
  >
    <svg
      v-if="props.carregando"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      class="animate-spin"
    >
      <g clip-path="url(#clip0_838_193)">
        <path
          d="M1.66666 10C1.66666 14.6024 5.39762 18.3334 10 18.3334C14.6024 18.3334 18.3333 14.6024 18.3333 10C18.3333 5.39765 14.6024 1.66669 10 1.66669"
          stroke="#ffffff"
          stroke-width="1.8"
        />
      </g>
      <defs>
        <clipPath id="clip0_838_193">
          <rect width="20" height="20" fill="#ffffff" />
        </clipPath>
      </defs>
    </svg>
    <p v-if="!props.carregando">{{ props.titulo }}</p>
  </button>
</template>

<script setup lang="ts">
import { ConfigRaspadinhaProps } from '@/types/Raspadinha'
import { getIdealTextColor } from '@/utils/helpers/colors/getIdealTextColor'
import { computed, ComputedRef, inject } from 'vue'

interface ButtonProps {
  titulo: string
  variant?: 'default' | 'outline' | 'gray' | 'red'
  carregando?: boolean
  disabled?: boolean
}

const props = defineProps<ButtonProps>()

const CONFIG_RASPADINHA = inject<ComputedRef<ConfigRaspadinhaProps>>('CONFIG_RASPADINHA')
if (!CONFIG_RASPADINHA) {
  throw new Error('CONFIG_RASPADINHA não foi fornecido.')
}

const corPrimaria = computed(() => CONFIG_RASPADINHA.value.corPrimaria)

const styleObject = computed(() => {
  if (props.variant === 'gray') {
    return {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      borderColor: '#D1D5DB',
      borderWidth: '1px'
    }
  }

  switch (props.variant) {
    case 'outline':
      return {
        borderColor: corPrimaria.value,
        color: corPrimaria.value,
        borderWidth: '1px'
      }

    case 'red':
      return {
        backgroundColor: '#DC2626',
        color: getIdealTextColor('#DC2626')
      }
    default:
      return {
        backgroundColor: corPrimaria.value,
        color: getIdealTextColor(corPrimaria.value)
      }
  }
})
</script>
