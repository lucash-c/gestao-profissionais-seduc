<script setup lang="ts">
import type { EventMinutes, PublicEventChoice } from '@seduc/contracts';
import { QBanner, QBtn, QCard, QCardSection, QPage, QSpinner } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import logoSeduc from '@/assets/branding/logo-seduc-americana.png';
import { eventApi } from '@/services/event.service';

const route = useRoute();
const minutes = ref<EventMinutes | null>(null);
const loading = ref(true);
const error = ref('');
const eventId = computed(() => String(route.params.id));

function formatDate(value: string | null): string {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })
    .format(date)
    .replace(',', ' às');
}

function longDate(value: string | null): string {
  if (!value) return '____ de __________________ de ______';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  }).format(new Date(value));
}

function movementKey(movement: PublicEventChoice): string {
  return `${movement.dataHora}-${movement.especie}`;
}

function printMinutes(): void {
  window.print();
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    minutes.value = await eventApi.minutes(eventId.value);
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : 'Não foi possível carregar a ata.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <QPage class="registry-page minutes-page" data-testid="event-minutes-page">
    <div v-if="loading" class="registry-state"><QSpinner /> Carregando ata…</div>
    <QBanner v-else-if="error" class="bg-red-1 text-negative" role="alert">{{ error }}</QBanner>
    <article v-else-if="minutes" class="event-minutes" data-testid="event-minutes-document">
      <div class="minutes-actions no-print">
        <QBtn
          color="primary"
          icon="print"
          label="Imprimir ata"
          data-testid="print-minutes"
          @click="printMinutes"
        />
      </div>
      <header class="minutes-header">
        <img :src="logoSeduc" alt="Secretaria de Educação de Americana" />
        <div>
          <p class="eyebrow">SECRETARIA DE EDUCAÇÃO DE AMERICANA</p>
          <h1>ATA DO EVENTO</h1>
          <p class="minutes-title">{{ minutes.evento.nome }}</p>
        </div>
      </header>
      <QCard flat bordered class="minutes-summary">
        <QCardSection>
          <dl>
            <div>
              <dt>Tipo</dt>
              <dd>{{ minutes.evento.tipo }}</dd>
            </div>
            <div>
              <dt>Cargo</dt>
              <dd>{{ minutes.evento.cargoFuncao }}</dd>
            </div>
            <div>
              <dt>Ano</dt>
              <dd>{{ minutes.evento.ano }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ minutes.evento.status }}</dd>
            </div>
            <div>
              <dt>Data de início</dt>
              <dd>{{ formatDate(minutes.evento.dataInicio) }}</dd>
            </div>
            <div>
              <dt>Data de encerramento</dt>
              <dd>{{ formatDate(minutes.evento.dataFim) }}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{{ minutes.evento.responsavel ?? 'Não informado' }}</dd>
            </div>
          </dl>
        </QCardSection>
      </QCard>

      <section class="minutes-section">
        <h2>Participantes</h2>
        <ol v-if="minutes.participantes.length">
          <li
            v-for="participant in minutes.participantes"
            :key="`${participant.posicao}-${participant.nome}`"
          >
            {{ participant.posicao ? `${participant.posicao}º ` : '' }}{{ participant.nome }}
          </li>
        </ol>
        <p v-else>Nenhum participante informado.</p>
      </section>

      <section class="minutes-section">
        <h2>Histórico</h2>
        <p v-if="minutes.evento.dataInicio">
          {{ formatDate(minutes.evento.dataInicio) }} — Evento iniciado.
        </p>
        <template v-for="movement in minutes.movimentacoes" :key="movementKey(movement)">
          <div v-if="movement.especie === 'PERMUTA'" class="minutes-movement">
            <p>
              <strong>{{ formatDate(movement.dataHora) }} — Foi realizada permuta entre:</strong>
            </p>
            <p v-for="item in movement.itens" :key="item.profissional">
              {{ item.profissional }}<br />{{ item.unidadeOrigem }} → {{ item.unidadeDestino }}
            </p>
          </div>
          <div v-else class="minutes-movement">
            <p>
              <strong>{{ formatDate(movement.dataHora) }} — Movimentação realizada.</strong><br />
              {{ movement.profissional }}
              {{
                movement.unidadeOrigem
                  ? `foi movimentado de ${movement.unidadeOrigem} para`
                  : 'recebeu'
              }}
              {{ movement.unidadeDestino }}. Vínculo:
              {{ movement.tipoDestino === 'SEDE' ? 'COM SEDE' : 'SEM SEDE' }}.
            </p>
          </div>
        </template>
        <p v-if="minutes.movimentacoes.length === 0 && minutes.evento.status === 'ENCERRADO'">
          Participação encerrada sem movimentação.
        </p>
        <p v-if="minutes.evento.dataFim">
          {{ formatDate(minutes.evento.dataFim) }} — Evento encerrado.
        </p>
      </section>

      <section class="minutes-signatures">
        <p>Americana, {{ longDate(minutes.evento.dataFim) }}.</p>
        <div class="signature-grid">
          <div>
            <span></span><strong>Operador responsável</strong
            ><small
              >Nome: {{ minutes.evento.responsavel ?? '______________________________' }}</small
            >
          </div>
          <div>
            <span></span><strong>Representante da SEDUC</strong
            ><small>Nome: ______________________________</small>
          </div>
          <div v-for="movement in minutes.movimentacoes" :key="`sign-${movementKey(movement)}`">
            <template v-if="movement.especie === 'PERMUTA'">
              <div v-for="item in movement.itens" :key="item.profissional" class="signature-person">
                <span></span><strong>{{ item.profissional }}</strong>
              </div>
            </template>
            <template v-else
              ><span></span><strong>{{ movement.profissional }}</strong></template
            >
          </div>
        </div>
      </section>

      <details class="minutes-technical no-print">
        <summary>Ver detalhes técnicos (JSON)</summary>
        <pre>{{ JSON.stringify(minutes, null, 2) }}</pre>
      </details>
    </article>
  </QPage>
</template>

<style scoped>
.minutes-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
.event-minutes {
  background: var(--fluent-surface);
  margin: 0 auto;
  max-width: 920px;
  padding: clamp(24px, 5vw, 56px);
}
.minutes-header {
  align-items: center;
  border-bottom: 2px solid var(--fluent-border);
  display: flex;
  gap: 24px;
  padding-bottom: 20px;
}
.minutes-header img {
  height: auto;
  max-width: 180px;
  width: 36%;
}
.minutes-header h1,
.minutes-title {
  margin: 0;
}
.minutes-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-top: 6px;
}
.minutes-summary {
  margin-top: 20px;
}
.minutes-summary dl {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin: 0;
}
.minutes-summary dt {
  color: var(--q-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.minutes-summary dd {
  margin: 3px 0 0;
}
.minutes-section {
  margin-top: 28px;
}
.minutes-section h2 {
  border-bottom: 1px solid var(--fluent-border);
  font-size: 1.05rem;
  padding-bottom: 8px;
}
.minutes-movement {
  break-inside: avoid;
  page-break-inside: avoid;
}
.minutes-signatures {
  margin-top: 42px;
}
.signature-grid {
  display: grid;
  gap: 32px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 56px;
}
.signature-grid > div {
  break-inside: avoid;
  display: grid;
  gap: 5px;
  page-break-inside: avoid;
}
.signature-grid span {
  border-top: 1px solid currentColor;
  display: block;
}
.signature-grid small {
  font-size: 0.8rem;
}
.signature-person {
  margin-top: 32px;
}
.minutes-technical {
  margin-top: 32px;
}
.minutes-technical pre {
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
}
@media (max-width: 640px) {
  .minutes-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .signature-grid {
    grid-template-columns: 1fr;
  }
}
@media print {
  :global(body) {
    background: #fff;
  }
  .no-print {
    display: none !important;
  }
  .minutes-page {
    background: #fff;
    padding: 0;
  }
  .event-minutes {
    box-shadow: none;
    max-width: none;
    padding: 0;
  }
  .minutes-header,
  .minutes-section,
  .minutes-summary,
  .minutes-signatures {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  @page {
    margin: 18mm;
    size: A4;
  }
}
</style>
