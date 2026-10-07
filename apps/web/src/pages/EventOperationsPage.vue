<script setup lang="ts">
import type {
  EventCentralRecord,
  EventChoiceSimulation,
  EventDestinationType,
  EventOperationalMovement,
  WorkPositionRecord,
} from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardActions,
  QCardSection,
  QDialog,
  QPage,
  QPagination,
  QSelect,
  QSpinner,
} from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import StatusChip from '@/components/StatusChip.vue';
import { eventApi } from '@/services/event.service';

const route = useRoute();
const eventId = computed(() => String(route.params.id));
const central = ref<EventCentralRecord | null>(null);
const vacancies = ref<WorkPositionRecord[]>([]);
const loading = ref(true);
const loadingVacancies = ref(false);
const loadingSimulation = ref(false);
const confirming = ref(false);
const closing = ref(false);
const error = ref('');
const dialogError = ref('');
const simulation = ref<EventChoiceSimulation | null>(null);
const selectedPosition = ref<WorkPositionRecord | null>(null);
const choiceDialog = ref(false);
const historyDialog = ref(false);
const history = ref<EventOperationalMovement[]>([]);
const historyPage = ref(1);
const historyPages = ref(1);
const filters = ref<{
  periodoId?: string;
  tipo?: EventDestinationType;
  unidadeId?: string;
}>({});

const unitOptions = computed(() => {
  const values = new Map<string, string>();
  for (const vacancy of central.value?.vagasDisponiveis ?? []) {
    values.set(vacancy.unidadeId, vacancy.unidade.nome);
  }
  return [...values].map(([value, label]) => ({ label, value }));
});
const periodOptions = computed(() => {
  const values = new Map<string, string>();
  for (const vacancy of central.value?.vagasDisponiveis ?? []) {
    values.set(vacancy.periodoId, vacancy.periodo.nome);
  }
  return [...values].map(([value, label]) => ({ label, value }));
});
const typeOptions = [
  { label: 'SEDE FIXA / COM SEDE', value: 'SEDE' },
  { label: 'SEM SEDE / SUBSTITUIÇÃO', value: 'SEM_SEDE' },
];

function destinationLabel(position: WorkPositionRecord): string {
  return position.disponibilidade === 'DISPONIVEL_COM_SEDE'
    ? 'SEDE FIXA / COM SEDE'
    : 'SEM SEDE / SUBSTITUIÇÃO';
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    central.value = await eventApi.central(eventId.value);
    vacancies.value = central.value.vagasDisponiveis;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar a Central.';
  } finally {
    loading.value = false;
  }
}

async function loadVacancies(): Promise<void> {
  if (!central.value) return;
  loadingVacancies.value = true;
  error.value = '';
  try {
    vacancies.value = await eventApi.vacancies(eventId.value, filters.value);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao consultar vagas.';
    vacancies.value = [];
  } finally {
    loadingVacancies.value = false;
  }
}

async function openChoice(position: WorkPositionRecord): Promise<void> {
  if (confirming.value) return;
  selectedPosition.value = position;
  simulation.value = null;
  dialogError.value = '';
  choiceDialog.value = true;
  loadingSimulation.value = true;
  try {
    simulation.value = await eventApi.simulate(eventId.value, position.id);
  } catch (simulationError) {
    dialogError.value =
      simulationError instanceof Error ? simulationError.message : 'Não foi possível simular.';
  } finally {
    loadingSimulation.value = false;
  }
}

async function confirmChoice(): Promise<void> {
  if (!simulation.value || !selectedPosition.value || confirming.value) return;
  confirming.value = true;
  dialogError.value = '';
  try {
    const result = await eventApi.choose(eventId.value, {
      participanteEsperadoId: simulation.value.participanteEsperadoId,
      postoTrabalhoId: selectedPosition.value.id,
    });
    central.value = result.central;
    vacancies.value = result.central.vagasDisponiveis;
    choiceDialog.value = false;
    simulation.value = null;
    selectedPosition.value = null;
    filters.value = {};
  } catch (choiceError) {
    dialogError.value =
      choiceError instanceof Error ? choiceError.message : 'Não foi possível confirmar a escolha.';
  } finally {
    confirming.value = false;
  }
}

async function closeEvent(): Promise<void> {
  if (!central.value?.totais.podeEncerrar || closing.value) return;
  closing.value = true;
  error.value = '';
  try {
    central.value.evento = await eventApi.close(eventId.value);
  } catch (closeError) {
    error.value = closeError instanceof Error ? closeError.message : 'Falha ao encerrar o evento.';
  } finally {
    closing.value = false;
  }
}

async function openHistory(page = 1): Promise<void> {
  historyDialog.value = true;
  historyPage.value = page;
  const result = await eventApi.movements(eventId.value, page, 20);
  history.value = result.items;
  historyPages.value = Math.max(result.totalPages, 1);
}

onMounted(load);
</script>

<template>
  <QPage class="registry-page" data-testid="event-operations-page">
    <div v-if="loading" class="registry-state"><QSpinner size="36px" /> Carregando Central…</div>
    <template v-else-if="central">
      <div class="registry-heading">
        <div>
          <p class="eyebrow">Central de Operações</p>
          <h1>{{ central.evento.nome }}</h1>
          <div class="row items-center q-gutter-xs q-mt-xs">
            <StatusChip :status="central.evento.tipo" />
            <StatusChip :status="central.evento.status" />
            <span>{{ central.evento.cargoFuncao.nome }} · {{ central.evento.ano }}</span>
          </div>
        </div>
        <QBtn
          v-if="central.evento.status === 'ATIVO'"
          data-testid="close-event"
          outline
          color="negative"
          label="Encerrar evento"
          :disable="!central.totais.podeEncerrar || closing"
          :loading="closing"
          @click="closeEvent"
        />
      </div>

      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="central-error">{{
        error
      }}</QBanner>
      <QBanner
        v-if="central.regraPeriodo?.mode === 'BLOCKED'"
        class="bg-orange-1 text-dark"
        data-testid="period-rule-warning"
      >
        <StatusChip status="BLOCKED" />
        {{ central.regraPeriodo.message }} As escolhas estão bloqueadas até existir uma origem de
        período inequívoca.
      </QBanner>
      <QBanner
        v-else-if="central.regraPeriodo?.mode === 'ANY'"
        class="bg-blue-1 text-primary"
        data-testid="any-period-info"
      >
        <StatusChip status="ANY" />
        {{ central.regraPeriodo.message }}
      </QBanner>
      <QBanner v-if="central.evento.status === 'ENCERRADO'" class="bg-blue-1 text-primary">
        Evento encerrado. Esta visualização é somente leitura.
      </QBanner>

      <section class="operations-grid">
        <QCard flat bordered data-testid="current-participant">
          <QCardSection>
            <p class="eyebrow">Profissional na mesa</p>
            <template v-if="central.participanteAtual">
              <h2>
                {{ central.participanteAtual.posicao }}º · {{ central.participanteAtual.nome }}
              </h2>
              <p>{{ central.participanteAtual.cargo }}</p>
              <p>
                Pontuação: {{ central.participanteAtual.pontuacaoSnapshot ?? 'não aplicável' }} ·
                Admissão: {{ central.participanteAtual.dataEntradaSnapshot }} · Nascimento:
                {{ central.participanteAtual.dataNascimentoSnapshot }} · Filhos:
                {{ central.participanteAtual.numeroFilhosSnapshot }}
              </p>
              <p>
                Sede atual:
                {{ central.situacaoAtual?.sedeAtual?.unidade.nome ?? 'Sem sede oficial' }}
                <StatusChip :status="central.situacaoAtual?.sedeAtual ? 'COM_SEDE' : 'SEM_SEDE'" />
              </p>
              <ul v-if="central.situacaoAtual?.exerciciosAtuais.length">
                <li v-for="exercise in central.situacaoAtual.exerciciosAtuais" :key="exercise.id">
                  Exercício: {{ exercise.unidade.nome }} · {{ exercise.periodo.nome }} ·
                  <StatusChip :status="exercise.tipo" />
                </li>
              </ul>
              <p v-else>Sem exercício ativo.</p>
            </template>
            <p v-else>Nenhum participante aguardando.</p>
          </QCardSection>
        </QCard>

        <QCard flat bordered data-testid="next-participants">
          <QCardSection>
            <p class="eyebrow">Próximos</p>
            <ol>
              <li v-for="participant in central.proximos" :key="participant.participanteId">
                {{ participant.posicao }}º · {{ participant.nome }}
              </li>
            </ol>
            <p v-if="central.proximos.length === 0">Nenhum próximo participante.</p>
          </QCardSection>
        </QCard>
      </section>

      <QCard flat bordered class="q-mt-md" data-testid="available-positions">
        <QCardSection>
          <div class="registry-heading compact-heading">
            <div><p class="eyebrow">Vagas disponíveis</p></div>
            <QSpinner v-if="loadingVacancies" size="24px" />
          </div>
          <div class="event-filters">
            <QSelect
              v-model="filters.unidadeId"
              clearable
              emit-value
              map-options
              outlined
              label="Unidade"
              :options="unitOptions"
              @update:model-value="loadVacancies"
            />
            <QSelect
              v-model="filters.periodoId"
              clearable
              emit-value
              map-options
              outlined
              label="Período"
              :options="periodOptions"
              @update:model-value="loadVacancies"
            />
            <QSelect
              v-model="filters.tipo"
              clearable
              emit-value
              map-options
              outlined
              label="Tipo de disponibilidade"
              :options="typeOptions"
              @update:model-value="loadVacancies"
            />
          </div>
          <div class="vacancy-grid">
            <QCard v-for="position in vacancies" :key="position.id" flat bordered>
              <QCardSection>
                <h3>{{ position.unidade.nome }}</h3>
                <p>{{ position.periodo.nome }} · Posto {{ position.codigo ?? 'sem código' }}</p>
                <StatusChip
                  :status="position.disponibilidade === 'DISPONIVEL_COM_SEDE' ? 'SEDE' : 'SEM_SEDE'"
                />
                <span class="block text-caption text-grey-7">{{ destinationLabel(position) }}</span>
                <p v-if="position.titularAtual">
                  Titular: {{ position.titularAtual.nomeCompleto }}
                </p>
              </QCardSection>
              <QCardActions align="right">
                <QBtn
                  color="primary"
                  label="Simular escolha"
                  :disable="central.evento.status !== 'ATIVO' || confirming"
                  @click="openChoice(position)"
                />
              </QCardActions>
            </QCard>
          </div>
          <p v-if="!loadingVacancies && vacancies.length === 0">Nenhuma vaga compatível.</p>
        </QCardSection>
      </QCard>

      <QCard flat bordered class="q-mt-md" data-testid="recent-movements">
        <QCardSection>
          <p class="eyebrow">Últimas cinco escolhas</p>
          <ul>
            <li v-for="movement in central.ultimasMovimentacoes" :key="movement.id">
              {{ movement.profissional }} · origem:
              {{ movement.origem?.unidade.nome ?? 'sem origem registrada' }} →
              {{ movement.unidadeDestino }} · {{ movement.periodo }} · {{ movement.tipoDestino }} ·
              {{ new Date(movement.dataHora).toLocaleString('pt-BR') }}
            </li>
          </ul>
          <p v-if="central.ultimasMovimentacoes.length === 0">Nenhuma escolha registrada.</p>
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Ver mais" @click="openHistory()" />
        </QCardActions>
      </QCard>

      <QDialog v-model="choiceDialog" persistent>
        <QCard class="registry-dialog" data-testid="choice-dialog">
          <QCardSection><h2>Confirmar escolha</h2></QCardSection>
          <QCardSection v-if="loadingSimulation"><QSpinner /> Simulando…</QCardSection>
          <QCardSection v-else-if="simulation">
            <h3>ANTES</h3>
            <p>{{ simulation.antes.profissional }}</p>
            <p>Sede: {{ simulation.antes.sedeOficial?.unidade.nome ?? 'Sem sede oficial' }}</p>
            <p>Exercícios: {{ simulation.antes.exerciciosAtuais.length }}</p>
            <h3>DESTINO</h3>
            <p>
              {{ simulation.destino.unidade.nome }} · {{ simulation.destino.periodo.nome }} ·
              {{ simulation.destino.tipo }}
            </p>
            <p v-if="simulation.destino.titular">
              Titular preservado: {{ simulation.destino.titular.nome }}
            </p>
            <h3>DEPOIS</h3>
            <p>
              Sede:
              {{ simulation.depois.sedeOficial?.unidade.nome ?? 'Sem alteração de sede' }}
            </p>
            <p v-if="simulation.depois.exercicioNovo">
              Exercício: {{ simulation.depois.exercicioNovo.unidade.nome }} ·
              {{ simulation.depois.exercicioNovo.tipo }}
            </p>
            <p v-if="simulation.depois.vinculoEncerrado">
              Vínculo encerrado: {{ simulation.depois.vinculoEncerrado.unidade.nome }}
            </p>
            <h3>NOVA VAGA GERADA</h3>
            <p v-if="simulation.novasVagasGeradas.length === 0">Nenhuma identificada.</p>
            <p v-for="vacancy in simulation.novasVagasGeradas" :key="vacancy.postoId">
              {{ vacancy.unidade.nome }} · {{ vacancy.periodo.nome }} · {{ vacancy.tipo }}
            </p>
          </QCardSection>
          <QBanner v-if="dialogError" class="bg-red-1 text-negative">{{ dialogError }}</QBanner>
          <QCardActions align="right">
            <QBtn flat label="Cancelar" :disable="confirming" @click="choiceDialog = false" />
            <QBtn
              data-testid="confirm-choice"
              color="primary"
              label="Confirmar escolha"
              :disable="loadingSimulation || !simulation || Boolean(dialogError) || confirming"
              :loading="confirming"
              @click="confirmChoice"
            />
          </QCardActions>
        </QCard>
      </QDialog>

      <QDialog v-model="historyDialog">
        <QCard class="registry-dialog" data-testid="movement-history-dialog">
          <QCardSection><h2>Histórico do evento</h2></QCardSection>
          <QCardSection>
            <p v-for="movement in history" :key="movement.id">
              {{ movement.profissional }} · origem:
              {{ movement.origem?.unidade.nome ?? 'sem origem registrada' }} →
              {{ movement.unidadeDestino }} ·
              {{ movement.tipoDestino }}
            </p>
            <QPagination
              v-model="historyPage"
              :max="historyPages"
              @update:model-value="openHistory"
            />
          </QCardSection>
        </QCard>
      </QDialog>
    </template>
    <QBanner v-else-if="error" class="bg-red-1 text-negative">{{ error }}</QBanner>
  </QPage>
</template>

<style scoped>
.operations-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
.event-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.vacancy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.compact-heading {
  margin-bottom: 8px;
}
@media (max-width: 800px) {
  .operations-grid,
  .event-filters {
    grid-template-columns: 1fr;
  }
}
</style>
