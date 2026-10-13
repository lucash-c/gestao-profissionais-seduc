<script setup lang="ts">
import type { EventMinutes } from '@seduc/contracts';
import { QBanner, QBtn, QPage, QSpinner } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import EventMinutesDocument from '@/components/EventMinutesDocument.vue';
import { eventApi } from '@/services/event.service';

const route = useRoute();
const router = useRouter();
const minutes = ref<EventMinutes | null>(null);
const loading = ref(true);
const error = ref('');
const eventId = computed(() => String(route.params.id));

function printMinutes(): void {
  const printUrl = router.resolve({
    name: 'event-minutes-print',
    params: { id: eventId.value },
  }).href;
  window.open(printUrl, '_blank', 'noopener');
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
    <div class="minutes-actions no-print">
      <QBtn flat icon="arrow_back" label="Voltar" @click="router.push({ name: 'events' })" />
      <QBtn
        color="primary"
        icon="print"
        label="Imprimir ata"
        data-testid="print-minutes"
        @click="printMinutes"
      />
    </div>
    <div v-if="loading" class="registry-state"><QSpinner /> Carregando ata…</div>
    <QBanner v-else-if="error" class="bg-red-1 text-negative" role="alert">{{ error }}</QBanner>
    <EventMinutesDocument v-else-if="minutes" :minutes="minutes" />
  </QPage>
</template>

<style scoped>
.minutes-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin: 0 auto 16px;
  max-width: 820px;
}
.minutes-page :deep(.event-minutes-document) {
  box-shadow: 0 8px 24px rgba(31, 41, 55, 0.08);
}
</style>
