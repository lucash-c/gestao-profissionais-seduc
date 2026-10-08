<script setup lang="ts">
import { QBtn, QCardSection } from 'quasar';

defineProps<{ closeDisabled?: boolean; title: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <QCardSection class="modal-header">
    <h2>{{ title }}</h2>
    <QBtn
      flat
      round
      dense
      icon="close"
      aria-label="Fechar"
      :disable="closeDisabled"
      @click="$emit('close')"
    />
  </QCardSection>
</template>
