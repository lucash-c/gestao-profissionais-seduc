<script setup lang="ts">
import type {
  EventExchangeCentralRecord,
  EventExchangeParticipant,
  EventExchangeSimulation,
} from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardActions,
  QCardSection,
  QDialog,
  QIcon,
  QPage,
  QSelect,
  QSpinner,
} from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import StatusChip from '@/components/StatusChip.vue';
import ModalHeader from '@/components/ModalHeader.vue';
import { eventApi } from '@/services/event.service';

const route = useRoute();
const eventId = computed(() => String(route.params.id));
const central = ref<EventExchangeCentralRecord | null>(null);
const selected = ref<EventExchangeParticipant | null>(null);
const simulation = ref<EventExchangeSimulation | null>(null);
const loading = ref(true);
const simulating = ref(false);
const confirming = ref(false);
const closing = ref(false);
const error = ref('');
const dialogError = ref('');
const dialogOpen = ref(false);

const candidateOptions = computed(() =>
  (central.value?.candidatos ?? []).map((candidate) => ({
    label: `${candidate.posicao}º · ${candidate.nome} · ${candidate.sedeAtual?.unidade.nome ?? 'Sem sede'}`,
    value: candidate,
  })),
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    central.value = await eventApi.exchangeCentral(eventId.value);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar a Permuta.';
  } finally {
    loading.value = false;
  }
}

async function simulate(): Promise<void> {
  if (!selected.value || simulating.value) return;
  simulating.value = true;
  error.value = '';
  simulation.value = null;
  try {
    simulation.value = await eventApi.simulateExchange(
      eventId.value,
      selected.value.participanteId,
    );
    dialogOpen.value = true;
  } catch (simulationError) {
    error.value =
      simulationError instanceof Error ? simulationError.message : 'Não foi possível simular.';
  } finally {
    simulating.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!simulation.value || confirming.value) return;
  confirming.value = true;
  dialogError.value = '';
  try {
    const result = await eventApi.confirmExchange(eventId.value, {
      participanteEsperadoId: simulation.value.participanteAtualEsperadoId,
      postoOrigemAtualEsperadoId: simulation.value.postoOrigemAtualEsperadoId,
      postoOrigemSegundoEsperadoId: simulation.value.postoOrigemSegundoEsperadoId,
      segundoParticipanteId: simulation.value.profissionalB.participanteId,
    });
    central.value = result.central;
    selected.value = null;
    simulation.value = null;
    dialogOpen.value = false;
  } catch (confirmationError) {
    dialogError.value =
      confirmationError instanceof Error
        ? confirmationError.message
        : 'Não foi possível confirmar a permuta.';
  } finally {
    confirming.value = false;
  }
}

async function closeEvent(): Promise<void> {
  if (!central.value || closing.value || central.value.totais.aguardando > 0) return;
  closing.value = true;
  error.value = '';
  try {
    const event = await eventApi.close(eventId.value);
    central.value = { ...central.value, evento: event };
  } catch (closeError) {
    error.value = closeError instanceof Error ? closeError.message : 'Não foi possível encerrar.';
  } finally {
    closing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <QPage class="registry-page" data-testid="event-exchange-page">
    <div v-if="loading" class="registry-state"><QSpinner size="36px" /> Carregando Permuta…</div>
    <template v-else-if="central">
      <div class="registry-heading">
        <div>
          <p class="eyebrow">Operação presencial de Permuta</p>
          <h1>{{ central.evento.nome }}</h1>
          <div class="row items-center q-gutter-xs q-mt-xs">
            <StatusChip :status="central.evento.tipo" />
            <StatusChip :status="central.evento.status" />
            <span>{{ central.evento.cargoFuncao.nome }} · {{ central.evento.ano }}</span>
          </div>
        </div>
      </div>
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="exchange-error">
        {{ error }}
      </QBanner>
      <QBanner
        v-if="central.evento.status === 'ENCERRADO'"
        class="bg-blue-1 text-primary"
        data-testid="exchange-readonly"
      >
        Evento encerrado. O histórico da Permuta está disponível somente para consulta.
      </QBanner>

      <section class="exchange-grid">
        <QCard flat bordered data-testid="exchange-current">
          <QCardSection>
            <p class="eyebrow">Profissional atual</p>
            <template v-if="central.participanteAtual">
              <h2>
                {{ central.participanteAtual.posicao }}º · {{ central.participanteAtual.nome }}
              </h2>
              <p>
                Sede A:
                {{ central.participanteAtual.sedeAtual?.unidade.nome ?? 'Sem sede ativa' }} ·
                {{ central.participanteAtual.sedeAtual?.periodo.nome ?? 'sem período' }}
              </p>
            </template>
            <p v-else>Nenhum participante aguardando.</p>
          </QCardSection>
        </QCard>
        <QCard flat bordered data-testid="exchange-partner">
          <QCardSection>
            <p class="eyebrow">Segundo participante</p>
            <QSelect
              v-model="selected"
              outlined
              emit-value
              map-options
              label="Selecionar participante da fila"
              :options="candidateOptions"
              :disable="central.evento.status !== 'ATIVO'"
            />
            <p v-if="selected">
              Sede B: {{ selected.sedeAtual?.unidade.nome ?? 'Sem sede ativa' }} ·
              {{ selected.sedeAtual?.periodo.nome ?? 'sem período' }}
            </p>
          </QCardSection>
          <QCardActions align="right">
            <QBtn
              color="primary"
              label="Simular Permuta"
              :disable="
                central.evento.status !== 'ATIVO' ||
                !selected ||
                simulating ||
                confirming ||
                closing
              "
              :loading="simulating"
              @click="simulate"
            />
          </QCardActions>
        </QCard>
      </section>

      <QCard flat bordered class="q-mt-md" data-testid="exchange-queue">
        <QCardSection>
          <p class="eyebrow">Fila congelada</p>
          <div
            v-for="participant in central.fila"
            :key="participant.participanteId"
            class="queue-row"
          >
            <span>{{ participant.posicao }}º · {{ participant.nome }}</span>
            <StatusChip :status="participant.status" />
          </div>
        </QCardSection>
      </QCard>

      <QCard flat bordered class="q-mt-md" data-testid="exchange-history">
        <QCardSection>
          <p class="eyebrow">Últimas Permutas</p>
          <div v-for="movement in central.ultimasPermutas" :key="movement.id">
            <p v-for="item in movement.itens" :key="item.profissionalId">
              {{ item.profissional }}: {{ item.origem.unidade.nome }} →
              {{ item.destino.unidade.nome }}
            </p>
          </div>
          <p v-if="central.ultimasPermutas.length === 0">Nenhuma permuta registrada.</p>
        </QCardSection>
      </QCard>

      <div class="q-mt-md row justify-end">
        <QBtn
          data-testid="close-exchange"
          color="negative"
          label="Encerrar Permuta"
          :disable="
            central.evento.status !== 'ATIVO' || central.totais.aguardando > 0 || confirming
          "
          :loading="closing"
          @click="closeEvent"
        />
      </div>

      <QDialog v-model="dialogOpen" persistent>
        <QCard v-if="simulation" class="registry-dialog" data-testid="exchange-dialog">
          <ModalHeader
            title="Confirmar Permuta"
            :close-disabled="confirming"
            @close="dialogOpen = false"
          />
          <QCardSection class="modal-scroll-body">
            <p>Confira os dois profissionais e as sedes antes de confirmar a troca atômica.</p>
            <div class="exchange-comparison">
              <section>
                <h3>ANTES</h3>
                <p>
                  <strong class="block">{{ simulation.profissionalA.nome }}</strong>
                  {{ simulation.profissionalA.sedeAtual.unidade.nome }} ·
                  {{ simulation.profissionalA.sedeAtual.periodo.nome }}
                </p>
                <p>
                  <strong class="block">{{ simulation.profissionalB.nome }}</strong>
                  {{ simulation.profissionalB.sedeAtual.unidade.nome }} ·
                  {{ simulation.profissionalB.sedeAtual.periodo.nome }}
                </p>
              </section>
              <QIcon class="exchange-arrow" name="swap_horiz" size="32px" aria-hidden="true" />
              <section>
                <h3>DEPOIS</h3>
                <p>
                  <strong class="block">{{ simulation.profissionalA.nome }}</strong>
                  {{ simulation.profissionalA.depois.unidade.nome }} ·
                  {{ simulation.profissionalA.depois.periodo.nome }}
                </p>
                <p>
                  <strong class="block">{{ simulation.profissionalB.nome }}</strong>
                  {{ simulation.profissionalB.depois.unidade.nome }} ·
                  {{ simulation.profissionalB.depois.periodo.nome }}
                </p>
              </section>
            </div>
            <p>{{ simulation.consequenciaQuadro }}</p>
            <QBanner v-if="dialogError" class="bg-red-1 text-negative" role="alert">{{
              dialogError
            }}</QBanner>
          </QCardSection>
          <QCardActions align="right">
            <QBtn flat label="Cancelar" :disable="confirming" @click="dialogOpen = false" />
            <QBtn
              data-testid="confirm-exchange"
              color="primary"
              label="Confirmar Permuta"
              :disable="
                central.evento.status !== 'ATIVO' ||
                confirming ||
                closing ||
                simulation.impedimentos.length > 0
              "
              :loading="confirming"
              @click="confirm"
            />
          </QCardActions>
        </QCard>
      </QDialog>
    </template>
    <QBanner v-else-if="error" class="bg-red-1 text-negative">{{ error }}</QBanner>
  </QPage>
</template>

<style scoped>
.exchange-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.queue-row {
  align-items: center;
  border-bottom: 1px solid var(--fluent-border);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding-block: 8px;
}
.exchange-comparison {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr auto 1fr;
}
.exchange-comparison section {
  background: var(--fluent-surface-secondary);
  border: 1px solid var(--fluent-border);
  border-radius: 8px;
  padding: 12px;
}
.exchange-arrow {
  color: var(--fluent-primary);
}
@media (max-width: 800px) {
  .exchange-grid,
  .exchange-comparison {
    grid-template-columns: 1fr;
  }
  .exchange-arrow {
    justify-self: center;
    transform: rotate(90deg);
  }
}
</style>
