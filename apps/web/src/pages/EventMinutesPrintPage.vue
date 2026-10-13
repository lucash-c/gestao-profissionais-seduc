<script setup lang="ts">
import type { EventMinutes } from '@seduc/contracts';
import { QBanner, QSpinner } from 'quasar';
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import EventMinutesDocument from '@/components/EventMinutesDocument.vue';
import { eventApi } from '@/services/event.service';

const route = useRoute();
const minutes = ref<EventMinutes | null>(null);
const loading = ref(true);
const error = ref('');
const eventId = computed(() => String(route.params.id));

async function load(): Promise<void> {
  try {
    minutes.value = await eventApi.minutes(eventId.value);
    await nextTick();
    window.print();
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
  <main class="minutes-print-page" data-testid="event-minutes-print-page">
    <div v-if="loading" class="minutes-print-page__state"><QSpinner /> Carregando ata…</div>
    <QBanner v-else-if="error" class="bg-red-1 text-negative" role="alert">{{ error }}</QBanner>
    <EventMinutesDocument v-else-if="minutes" :minutes="minutes" />
  </main>
</template>

<style scoped>
.minutes-print-page {
  background: #fff;
  min-height: 100vh;
  padding: 28px;
}
.minutes-print-page__state {
  display: grid;
  min-height: 50vh;
  place-content: center;
}
@media print {
  .minutes-print-page {
    min-height: 0;
    padding: 0;
  }
}
</style>
