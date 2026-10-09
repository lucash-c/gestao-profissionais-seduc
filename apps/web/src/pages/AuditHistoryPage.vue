<script setup lang="ts">
import type { AuditRecord } from '@seduc/contracts';
import { QBanner, QBtn, QCard, QCardSection, QInput, QPage, QSelect, QSpinner } from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import DataComparison from '@/components/DataComparison.vue';
import { auditApi } from '@/services/audit.service';
import { formatAuditDate, humanizeAudit } from '@/utils/audit-presentation';

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
const presentedItems = computed(() =>
  items.value.map((item) => ({ item, summary: humanizeAudit(item) })),
);

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
    <QBanner v-else-if="items.length === 0" class="registry-state" data-testid="audit-empty">
      Nenhum registro de auditoria encontrado.
    </QBanner>
    <section
      v-else
      class="audit-records"
      data-testid="audit-table"
      aria-label="Registros de auditoria"
    >
      <QCard
        v-for="entry in presentedItems"
        :key="entry.item.id"
        flat
        bordered
        class="audit-record"
      >
        <QCardSection>
          <p class="audit-record__date">{{ formatAuditDate(entry.item.dataHora) }}</p>
          <h2 class="audit-record__title">{{ entry.summary.titulo }}</h2>
          <p class="audit-record__description">{{ entry.summary.descricao }}</p>
          <dl class="audit-record__context">
            <div>
              <dt>Responsável</dt>
              <dd>{{ entry.item.usuario.nome }}</dd>
            </div>
            <div v-if="entry.summary.profissional">
              <dt>Profissional</dt>
              <dd>{{ entry.summary.profissional }}</dd>
            </div>
            <div v-if="entry.summary.unidadeOrigem">
              <dt>Unidade de origem</dt>
              <dd>{{ entry.summary.unidadeOrigem }}</dd>
            </div>
            <div v-if="entry.summary.unidadeDestino">
              <dt>Unidade{{ entry.summary.unidadeOrigem ? ' de destino' : '' }}</dt>
              <dd>{{ entry.summary.unidadeDestino }}</dd>
            </div>
            <div v-if="entry.summary.evento">
              <dt>Evento</dt>
              <dd>{{ entry.summary.evento }}</dd>
            </div>
          </dl>
          <QBtn
            v-if="entry.item.entidade === 'EVENTO'"
            class="q-mb-md"
            flat
            color="primary"
            icon="description"
            label="Ver ata do evento"
            :to="{ name: 'event-minutes', params: { id: entry.item.registroId } }"
          />
          <section class="audit-record__change" aria-label="Alteração registrada">
            <h3>Alteração registrada</h3>
            <DataComparison :antes="entry.item.dadosAnteriores" :depois="entry.item.dadosNovos" />
          </section>
        </QCardSection>
      </QCard>
    </section>
    <div v-if="!loading && !error && totalPages > 0" class="audit-pagination">
      <QBtn label="Anterior" :disable="page <= 1" @click="load(page - 1)" />
      <span>Página {{ page }} de {{ totalPages }}</span>
      <QBtn label="Próxima" :disable="page >= totalPages" @click="load(page + 1)" />
    </div>
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
.audit-records {
  display: grid;
  gap: 12px;
}
.audit-record__date {
  color: var(--q-secondary);
  font-size: 0.875rem;
  margin: 0 0 4px;
}
.audit-record__title {
  font-size: 1.125rem;
  margin: 0;
}
.audit-record__description {
  margin: 8px 0 12px;
}
.audit-record__context {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 28px;
  margin: 0 0 16px;
}
.audit-record__context div {
  min-width: 180px;
}
.audit-record__context dt {
  color: var(--q-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.audit-record__context dd {
  margin: 2px 0 0;
}
.audit-record__change {
  border-top: 1px solid var(--q-separator-color, #e0e0e0);
  padding-top: 12px;
}
.audit-record__change h3 {
  font-size: 0.875rem;
  margin: 0 0 8px;
}
</style>
