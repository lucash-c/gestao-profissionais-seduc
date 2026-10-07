<script setup lang="ts">
import type { AdministrativeCorrectionPreview } from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardActions,
  QCardSection,
  QDialog,
  QInput,
  QPage,
  QSelect,
} from 'quasar';
import { computed, ref } from 'vue';

import { auditApi } from '@/services/audit.service';

const entidade = ref<'PROFISSIONAL' | 'UNIDADE'>('PROFISSIONAL');
const registroId = ref('');
const field = ref('nomeCompleto');
const value = ref('');
const preview = ref<AdministrativeCorrectionPreview | null>(null);
const reviewedPayload = ref<(ReturnType<typeof payload> & { versaoEsperada: string }) | null>(null);
const dialogOpen = ref(false);
const submitting = ref(false);
const error = ref('');
const success = ref('');
const fields = computed(() =>
  entidade.value === 'UNIDADE'
    ? ['nome', 'codigoInep', 'ativo']
    : [
        'nomeCompleto',
        'matricula',
        'cpf',
        'dataEntradaPrefeitura',
        'dataNascimento',
        'numeroFilhos',
        'remocao',
        'permuta',
        'ativo',
      ],
);

function typedValue(): string | number | boolean {
  if (['ativo', 'remocao', 'permuta'].includes(field.value)) return value.value === 'true';
  if (field.value === 'numeroFilhos') return Number(value.value);
  return value.value;
}
function payload() {
  return {
    entidade: entidade.value,
    registroId: registroId.value,
    valores: { [field.value]: typedValue() },
  };
}
async function review(): Promise<void> {
  error.value = '';
  success.value = '';
  try {
    const request = payload();
    preview.value = await auditApi.previewCorrection(request);
    reviewedPayload.value = structuredClone({
      ...request,
      versaoEsperada: preview.value.versao,
    });
    dialogOpen.value = true;
  } catch (reviewError) {
    error.value = reviewError instanceof Error ? reviewError.message : 'Falha ao validar correção.';
  }
}
async function apply(): Promise<void> {
  if (submitting.value || !reviewedPayload.value) return;
  submitting.value = true;
  error.value = '';
  try {
    preview.value = await auditApi.applyCorrection(reviewedPayload.value);
    reviewedPayload.value = null;
    dialogOpen.value = false;
    success.value = 'Correção administrativa aplicada.';
  } catch (applyError) {
    dialogOpen.value = false;
    preview.value = null;
    reviewedPayload.value = null;
    error.value = applyError instanceof Error ? applyError.message : 'Falha ao aplicar correção.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <QPage class="registry-page" data-testid="correction-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Administração excepcional</p>
        <h1>Correção Administrativa</h1>
      </div>
    </div>
    <QBanner class="bg-orange-2 text-dark" data-testid="correction-warning">
      <strong>ATENÇÃO:</strong> Esta é uma correção administrativa excepcional. Alterações
      realizadas neste módulo não geram auditoria técnica nem movimentação de evento.
    </QBanner>
    <QCard flat bordered class="q-mt-md"
      ><QCardSection class="correction-form">
        <QSelect
          v-model="entidade"
          outlined
          label="Entidade"
          :options="['PROFISSIONAL', 'UNIDADE']"
          @update:model-value="field = entidade === 'UNIDADE' ? 'nome' : 'nomeCompleto'"
        />
        <QInput
          v-model="registroId"
          data-testid="correction-record"
          outlined
          label="Registro (UUID)"
        />
        <QSelect v-model="field" outlined label="Campo permitido" :options="fields" />
        <QInput v-model="value" data-testid="correction-value" outlined label="Valor corrigido" />
        <QBtn
          color="primary"
          label="Revisar correção"
          data-testid="review-correction"
          @click="review"
        /> </QCardSection
    ></QCard>
    <p v-if="error" class="text-negative">{{ error }}</p>
    <p v-if="success" class="text-positive">{{ success }}</p>
    <QDialog v-model="dialogOpen" persistent
      ><QCard v-if="preview" class="registry-dialog" data-testid="correction-dialog">
        <QCardSection
          ><h2>Confirmar correção excepcional</h2>
          <p>{{ preview.entidade }} · {{ preview.registroId }}</p>
          <h3>ANTES</h3>
          <pre>{{ JSON.stringify(preview.antes, null, 2) }}</pre>
          <h3>DEPOIS</h3>
          <pre>{{ JSON.stringify(preview.depois, null, 2) }}</pre>
        </QCardSection>
        <QCardActions align="right"
          ><QBtn flat label="Cancelar" :disable="submitting" @click="dialogOpen = false" /><QBtn
            color="negative"
            label="Confirmar correção"
            data-testid="confirm-correction"
            :disable="submitting"
            :loading="submitting"
            @click="apply"
        /></QCardActions> </QCard
    ></QDialog>
  </QPage>
</template>

<style scoped>
.correction-form {
  display: grid;
  gap: 14px;
  max-width: 720px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
