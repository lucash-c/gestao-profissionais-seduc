<script setup lang="ts">
import { QInput } from 'quasar';
import { computed, onBeforeUnmount, ref } from 'vue';

import {
  CepLookupError,
  isValidCep,
  lookupCep,
  normalizeCep,
  type ViaCepAddress,
} from '@/services/cep.service';

const props = withDefaults(
  defineProps<{
    error?: boolean | undefined;
    errorMessage?: string | undefined;
    modelValue: string;
  }>(),
  {
    error: false,
    errorMessage: '',
  },
);

const emit = defineEmits<{
  'address-found': [address: ViaCepAddress];
  'update:modelValue': [value: string];
}>();

const feedback = ref('');
const loading = ref(false);
let controller: AbortController | null = null;
let lastResolvedCep = '';
let pendingCep = '';
let requestId = 0;

const displayedMessage = computed(() => props.errorMessage || feedback.value);
const hasError = computed(() => props.error || Boolean(feedback.value));

function cancelPendingRequest(): void {
  requestId += 1;
  controller?.abort();
  controller = null;
  loading.value = false;
  pendingCep = '';
}

function messageFor(error: unknown): string {
  if (error instanceof CepLookupError && error.reason === 'NOT_FOUND') {
    return 'CEP não encontrado. Confira o número informado ou preencha o endereço manualmente.';
  }
  return 'Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.';
}

async function consultCep(value: string, showValidation: boolean): Promise<void> {
  const cep = normalizeCep(value);
  if (!cep) return;

  if (!isValidCep(cep)) {
    cancelPendingRequest();
    if (showValidation) feedback.value = 'Informe um CEP com 8 dígitos.';
    return;
  }

  if (cep === lastResolvedCep || (loading.value && cep === pendingCep)) return;

  cancelPendingRequest();
  const currentRequest = ++requestId;
  const currentController = new AbortController();
  controller = currentController;
  pendingCep = cep;
  loading.value = true;
  feedback.value = '';

  try {
    const address = await lookupCep(cep, currentController.signal);
    if (currentRequest !== requestId || normalizeCep(props.modelValue) !== cep) return;

    lastResolvedCep = cep;
    emit('address-found', address);
  } catch (error) {
    if (currentRequest !== requestId || currentController.signal.aborted) return;
    feedback.value = messageFor(error);
  } finally {
    if (currentRequest === requestId) {
      controller = null;
      loading.value = false;
      pendingCep = '';
    }
  }
}

function updateValue(value: string | number | null): void {
  const cep = normalizeCep(String(value ?? ''));
  const previousCep = normalizeCep(props.modelValue);
  emit('update:modelValue', cep);
  feedback.value = '';

  if (cep !== previousCep) lastResolvedCep = '';
  if (isValidCep(cep)) {
    void consultCep(cep, false);
  } else {
    cancelPendingRequest();
  }
}

function handleBlur(): void {
  void consultCep(props.modelValue, true);
}

onBeforeUnmount(cancelPendingRequest);
</script>

<template>
  <QInput
    :model-value="modelValue"
    data-testid="cep-input"
    outlined
    mask="#####-###"
    unmasked-value
    inputmode="numeric"
    autocomplete="postal-code"
    label="CEP"
    :loading="loading"
    :error="hasError"
    :error-message="displayedMessage"
    :hint="loading ? 'Buscando CEP…' : undefined"
    :persistent-hint="loading"
    @update:model-value="updateValue"
    @blur="handleBlur"
  />
</template>
