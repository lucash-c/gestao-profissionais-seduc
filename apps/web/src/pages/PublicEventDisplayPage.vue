<script setup lang="ts">
import type { PublicEventChoice, PublicEventDisplay } from '@seduc/contracts';
import { QBanner, QBtn, QCard, QCardSection, QDialog, QPage, QPagination, QSpinner } from 'quasar';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import StatusChip from '@/components/StatusChip.vue';
import ModalHeader from '@/components/ModalHeader.vue';
import { eventApi } from '@/services/event.service';

const route = useRoute();
const eventId = computed(() => String(route.params.id));
const display = ref<PublicEventDisplay | null>(null);
const loading = ref(true);
const error = ref('');
const historyOpen = ref(false);
const choices = ref<PublicEventChoice[]>([]);
const page = ref(1);
const pages = ref(1);
let pollId: ReturnType<typeof setInterval> | undefined;

async function load(showLoading = false): Promise<void> {
  if (showLoading) loading.value = true;
  try {
    display.value = await eventApi.publicDisplay(eventId.value);
    error.value = '';
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao atualizar o telão.';
  } finally {
    loading.value = false;
  }
}

async function loadChoices(targetPage = 1): Promise<void> {
  historyOpen.value = true;
  page.value = targetPage;
  const result = await eventApi.publicChoices(eventId.value, targetPage, 20);
  choices.value = result.items;
  pages.value = Math.max(result.totalPages, 1);
}

onMounted(async () => {
  await load(true);
  pollId = setInterval(() => void load(), 3_000);
});
onBeforeUnmount(() => {
  if (pollId) clearInterval(pollId);
});
</script>

<template>
  <QPage class="public-display" data-testid="public-event-display" aria-live="polite">
    <div v-if="loading" class="public-state"><QSpinner size="48px" /> Carregando sessão…</div>
    <template v-else-if="display">
      <header>
        <p class="eyebrow">SEDUC Americana · Sessão pública</p>
        <h1>{{ display.evento.nome }}</h1>
        <div class="row items-center q-gutter-sm">
          <StatusChip :status="display.evento.tipo" />
          <StatusChip
            :status="display.evento.status === 'ENCERRADO' ? 'EVENTO ENCERRADO' : 'EM ANDAMENTO'"
            :tone="display.evento.status === 'ENCERRADO' ? 'neutral' : 'positive'"
          />
          <span>{{ display.evento.ano }}</span>
        </div>
      </header>
      <QBanner v-if="error" class="bg-red-1 text-negative">{{ error }}</QBanner>

      <section class="public-main">
        <QCard flat bordered data-testid="public-current-participant">
          <QCardSection>
            <p class="eyebrow">Profissional atual</p>
            <h2 v-if="display.participanteAtual">
              {{ display.participanteAtual.posicao }}º · {{ display.participanteAtual.nome }}
            </h2>
            <h2 v-else>Nenhuma pessoa na mesa</h2>
          </QCardSection>
        </QCard>
        <QCard flat bordered data-testid="public-next-participants">
          <QCardSection>
            <p class="eyebrow">Próximos</p>
            <p v-for="participant in display.proximos" :key="participant.posicao">
              {{ participant.posicao }}º · {{ participant.nome }}
            </p>
            <p v-if="display.proximos.length === 0">Nenhum próximo participante.</p>
          </QCardSection>
        </QCard>
      </section>

      <h2>Vagas compatíveis</h2>
      <section class="public-vacancies" data-testid="public-vacancies">
        <QCard
          v-for="vacancy in display.vagas"
          :key="`${vacancy.unidade}-${vacancy.periodo}-${vacancy.tipo}`"
          flat
          bordered
        >
          <QCardSection>
            <h3>{{ vacancy.unidade }}</h3>
            <p>{{ vacancy.periodo }}</p>
            <StatusChip
              :status="vacancy.tipo === 'SEDE' ? 'SEDE FIXA / COM SEDE' : 'SEM SEDE / SUBSTITUIÇÃO'"
              tone="info"
            />
            <strong>{{ vacancy.quantidade }} vaga(s)</strong>
          </QCardSection>
        </QCard>
        <p v-if="display.vagas.length === 0">Nenhuma vaga compatível disponível.</p>
      </section>

      <QCard flat bordered class="q-mt-lg" data-testid="public-recent-choices">
        <QCardSection>
          <p class="eyebrow">Últimas escolhas</p>
          <p
            v-for="choice in display.ultimasEscolhas"
            :key="`${choice.dataHora}-${choice.profissional}`"
          >
            {{ choice.profissional }} → {{ choice.unidadeDestino }} · {{ choice.periodo }} ·
            {{ choice.tipoDestino }}
          </p>
          <p v-if="display.ultimasEscolhas.length === 0">Nenhuma escolha registrada.</p>
          <QBtn flat label="Ver escolhas anteriores" @click="loadChoices()" />
        </QCardSection>
      </QCard>

      <QDialog v-model="historyOpen">
        <QCard class="registry-dialog public-history" data-testid="public-choice-history">
          <ModalHeader title="Escolhas anteriores" @close="historyOpen = false" />
          <QCardSection class="modal-scroll-body">
            <p v-for="choice in choices" :key="`${choice.dataHora}-${choice.profissional}`">
              {{ choice.profissional }} · {{ choice.unidadeDestino }} · {{ choice.periodo }} ·
              {{ choice.tipoDestino }}
            </p>
            <QPagination v-model="page" :max="pages" @update:model-value="loadChoices" />
          </QCardSection>
        </QCard>
      </QDialog>
    </template>
    <QBanner v-else-if="error" class="bg-red-1 text-negative">{{ error }}</QBanner>
  </QPage>
</template>

<style scoped>
.public-display {
  min-height: 100vh;
  padding: clamp(20px, 4vw, 56px);
  background: var(--fluent-background);
}
.public-display header {
  margin-bottom: 24px;
}
.public-main {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
.public-vacancies {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}
.public-vacancies strong {
  display: block;
  margin-top: 8px;
}
.public-history {
  min-width: min(700px, 90vw);
}
.public-state {
  display: grid;
  min-height: 70vh;
  place-content: center;
  text-align: center;
}
@media (max-width: 800px) {
  .public-main {
    grid-template-columns: 1fr;
  }
}
</style>
