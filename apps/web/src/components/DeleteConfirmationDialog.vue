<script setup lang="ts">
import { QBanner, QBtn, QCard, QCardActions, QCardSection, QDialog, QInput } from 'quasar';
import { ref, watch } from 'vue';

import ModalHeader from './ModalHeader.vue';

const props = defineProps<{
  description: string;
  error?: string;
  loading?: boolean;
  open: boolean;
  title: string;
}>();
const emit = defineEmits<{ cancel: []; confirm: [password: string] }>();
const password = ref('');

watch(
  () => props.open,
  (open) => {
    if (open) password.value = '';
  },
);
</script>

<template>
  <QDialog :model-value="open" persistent>
    <QCard class="registry-dialog compact" data-testid="delete-confirmation-dialog">
      <ModalHeader :title="title" :close-disabled="loading" @close="emit('cancel')" />
      <QCardSection class="modal-scroll-body">
        <p>{{ description }}</p>
        <QInput
          v-model="password"
          outlined
          type="password"
          autocomplete="current-password"
          label="Senha atual *"
          @keyup.enter="password && emit('confirm', password)"
        />
        <QBanner v-if="error" class="bg-red-1 text-negative q-mt-md" role="alert">{{
          error
        }}</QBanner>
      </QCardSection>
      <QCardActions align="right" class="modal-footer">
        <QBtn flat label="Cancelar" :disable="loading" @click="emit('cancel')" />
        <QBtn
          color="negative"
          label="Excluir"
          :loading="loading"
          :disable="loading || !password"
          @click="emit('confirm', password)"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>
