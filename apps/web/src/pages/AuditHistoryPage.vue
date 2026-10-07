<script setup lang="ts">
import type { AuditRecord } from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardSection,
  QDialog,
  QInput,
  QPage,
  QSelect,
  QSpinner,
} from 'quasar';
import { onMounted, reactive, ref } from 'vue';

import DataComparison from '@/components/DataComparison.vue';
import { auditApi } from '@/services/audit.service';

const filters = reactive({
  acao: '',
  dataFim: '',
  dataInicio: '',
  entidade: '',
  profissionalId: '',
  registroId: '',
  unidadeId: '',
  usuarioId: '',
});
const items = ref<AuditRecord[]>([]);
const page = ref(1);
const pageSize = 20;
const totalPages = ref(0);
const loading = ref(true);
const error = ref('');
const selected = ref<AuditRecord | null>(null);

async function load(targetPage = 1): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await auditApi.list({ ...filters, page: targetPage, pageSize });
    items.value = result.items;
    page.value = result.page;
    totalPages.value = result.totalPages;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar auditoria.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <QPage class="registry-page" data-testid="audit-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Administração</p>
        <h1>Auditoria / Histórico</h1>
      </div>
    </div>
    <QCard flat bordered>
      <QCardSection class="audit-filters">
        <QInput v-model="filters.dataInicio" outlined type="datetime-local" label="Data inicial" />
        <QInput v-model="filters.dataFim" outlined type="datetime-local" label="Data final" />
        <QInput v-model="filters.usuarioId" outlined label="Usuário (ID)" />
        <QInput v-model="filters.entidade" outlined label="Entidade" />
        <QInput v-model="filters.registroId" outlined label="Registro" />
        <QSelect
          v-model="filters.acao"
          outlined
          clearable
          label="Ação"
          :options="['CREATE', 'UPDATE', 'DELETE']"
        />
        <QInput v-model="filters.unidadeId" outlined label="Unidade relacionada (ID)" />
        <QInput v-model="filters.profissionalId" outlined label="Profissional relacionado (ID)" />
        <QBtn color="primary" label="Filtrar" data-testid="audit-filter" @click="load(1)" />
      </QCardSection>
    </QCard>
    <div v-if="loading" class="registry-state"><QSpinner /> Carregando histórico…</div>
    <QBanner v-else-if="error" class="bg-red-1 text-negative" role="alert">{{ error }}</QBanner>
    <table v-else class="registry-table" data-testid="audit-table">
      <thead>
        <tr>
          <th>Data/hora</th>
          <th>Usuário</th>
          <th>Ação</th>
          <th>Entidade</th>
          <th>Registro</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>{{ new Date(item.dataHora).toLocaleString('pt-BR') }}</td>
          <td>{{ item.usuario.nome }}</td>
          <td>{{ item.acao }}</td>
          <td>{{ item.entidade }}</td>
          <td>{{ item.registroId }}</td>
          <td><QBtn flat label="Detalhes" @click="selected = item" /></td>
        </tr>
      </tbody>
    </table>
    <div class="audit-pagination">
      <QBtn label="Anterior" :disable="page <= 1" @click="load(page - 1)" />
      <span>Página {{ page }} de {{ totalPages }}</span>
      <QBtn label="Próxima" :disable="page >= totalPages" @click="load(page + 1)" />
    </div>
    <QDialog :model-value="Boolean(selected)" @update:model-value="selected = null">
      <QCard v-if="selected" class="registry-dialog" data-testid="audit-details">
        <QCardSection
          ><h2>Detalhes da alteração</h2>
          <p>Campos alterados e respectivos valores antes e depois.</p>
          <DataComparison :antes="selected.dadosAnteriores" :depois="selected.dadosNovos" />
        </QCardSection>
      </QCard>
    </QDialog>
  </QPage>
</template>

<style scoped>
.audit-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
}
.audit-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
</style>
