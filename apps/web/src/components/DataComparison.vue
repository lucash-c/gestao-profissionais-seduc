<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ antes: unknown; depois: unknown }>();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatField(value: string): string {
  const spaced = value.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toLocaleUpperCase('pt-BR') + spaced.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') {
    const record = asRecord(value);
    const name =
      record && (record.nomeCompleto ?? record.nome ?? record.unidadeNome ?? record.codigo);
    if (typeof name === 'string' && name.trim()) return name;
    if (Array.isArray(value)) return value.length ? `${value.length} item(ns)` : 'Nenhum item';
    return 'Informação disponível nos detalhes técnicos.';
  }
  return String(value);
}

function isTechnicalField(field: string): boolean {
  return field === 'id' || field.endsWith('Id') || field === 'criadoEm' || field === 'atualizadoEm';
}

const rows = computed(() => {
  const before = asRecord(props.antes);
  const after = asRecord(props.depois);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => !isTechnicalField(field))
    .sort((left, right) => left.localeCompare(right, 'pt-BR'))
    .map((field) => ({
      after: formatValue(after[field]),
      before: formatValue(before[field]),
      changed: JSON.stringify(before[field]) !== JSON.stringify(after[field]),
      field,
      label: formatField(field),
    }));
});
</script>

<template>
  <div class="data-comparison" data-testid="data-comparison">
    <template v-if="rows.length">
      <div class="data-comparison__row data-comparison__row--header" aria-hidden="true">
        <span>CAMPO</span><span>ESTADO ANTERIOR</span><span>ESTADO ATUAL</span>
      </div>
      <div
        v-for="row in rows"
        :key="row.field"
        class="data-comparison__row"
        :class="{ 'data-comparison__row--changed': row.changed }"
      >
        <strong>{{ row.label }}</strong>
        <span :aria-label="`${row.label}, antes: ${row.before}`">{{ row.before }}</span>
        <span :aria-label="`${row.label}, depois: ${row.after}`">{{ row.after }}</span>
      </div>
    </template>
    <p v-else class="data-comparison__empty">Não há campos administrativos para comparar.</p>
  </div>
  <details class="q-mt-md">
    <summary>Ver detalhes técnicos (JSON)</summary>
    <pre>{{ JSON.stringify({ antes, depois }, null, 2) }}</pre>
  </details>
</template>
