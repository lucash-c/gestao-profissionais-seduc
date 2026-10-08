<script setup lang="ts">
import { QChip } from 'quasar';
import { computed } from 'vue';

const props = defineProps<{
  status: string;
  tone?: 'positive' | 'negative' | 'warning' | 'info' | 'neutral';
}>();

const labels: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  ANY: 'Qualquer período',
  ATENDIDO: 'Atendido',
  ATIVO: 'Ativo',
  BLOCKED: 'Bloqueado',
  CANCELADO: 'Cancelado',
  COM_SEDE: 'Com sede',
  DISPONIVEL_COM_SEDE: 'Com sede: disponível',
  DISPONIVEL_SEM_SEDE: 'Sem sede: disponível',
  EMPATE_PENDENTE: 'Empate pendente',
  ENCERRADO: 'Encerrado',
  FIXED: 'Período fixo',
  INATIVO: 'Inativo',
  INDISPONIVEL: 'Indisponível',
  LISTAO: 'Listão',
  ATRIBUICAO: 'Atribuição',
  PERMUTA: 'Permuta',
  RASCUNHO: 'Rascunho',
  REMOCAO: 'Remoção',
  SEDE: 'Sede fixa',
  SEM_SEDE: 'Sem sede',
  SUBSTITUICAO: 'Substituição',
};

const normalized = computed(() => props.status.trim().toUpperCase());
const label = computed(() => labels[normalized.value] ?? props.status);
const resolvedTone = computed(() => {
  if (props.tone) return props.tone;
  if (['ATIVO', 'ATENDIDO', 'COM_SEDE', 'DISPONIVEL_COM_SEDE'].includes(normalized.value)) {
    return 'positive';
  }
  if (['CANCELADO', 'INATIVO', 'INDISPONIVEL', 'BLOCKED'].includes(normalized.value)) {
    return 'negative';
  }
  if (
    ['AGUARDANDO', 'EMPATE_PENDENTE', 'RASCUNHO', 'SEM_SEDE', 'DISPONIVEL_SEM_SEDE'].includes(
      normalized.value,
    )
  ) {
    return 'warning';
  }
  if (
    ['ANY', 'FIXED', 'LISTAO', 'ATRIBUICAO', 'PERMUTA', 'REMOCAO', 'SEDE', 'SUBSTITUICAO'].includes(
      normalized.value,
    )
  ) {
    return 'info';
  }
  return 'neutral';
});
const icon = computed(() => {
  if (resolvedTone.value === 'positive') return 'check_circle';
  if (resolvedTone.value === 'negative') return 'block';
  if (resolvedTone.value === 'warning') return 'schedule';
  if (resolvedTone.value === 'info') return 'info';
  return 'label';
});
</script>

<template>
  <QChip
    dense
    :icon="icon"
    :label="label"
    :class="`status-chip status-chip--${resolvedTone}`"
    :aria-label="`Status: ${label}`"
  />
</template>
