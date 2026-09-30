<script setup lang="ts">
import {
  QAvatar,
  QBadge,
  QCard,
  QCardSection,
  QChip,
  QHeader,
  QLayout,
  QPage,
  QPageContainer,
  QSeparator,
  QToolbar,
  QToolbarTitle,
} from 'quasar';
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { getApiReadiness } from '@/services/health.service';

type ApiState = 'checking' | 'ready' | 'unavailable';

const apiState = ref<ApiState>('checking');
const controller = new AbortController();

onMounted(async () => {
  try {
    await getApiReadiness(controller.signal);
    apiState.value = 'ready';
  } catch {
    apiState.value = 'unavailable';
  }
});

onBeforeUnmount(() => controller.abort());
</script>

<template>
  <QLayout view="hHh lpR fFf" class="foundation-layout">
    <QHeader class="institutional-header">
      <QToolbar class="foundation-toolbar">
        <div class="brand-mark" aria-hidden="true">A</div>
        <QToolbarTitle>
          <span class="brand-title">SEDUC AMERICANA</span>
          <span class="brand-subtitle">Gestão de Remoção e Vagas</span>
        </QToolbarTitle>
        <QBadge color="blue-2" text-color="blue-10" label="ETAPA 0" />
      </QToolbar>
    </QHeader>

    <QPageContainer>
      <QPage class="foundation-page">
        <main class="foundation-content">
          <QCard flat bordered class="foundation-card">
            <QCardSection class="row items-start no-wrap q-gutter-md">
              <QAvatar color="primary" text-color="white" icon="foundation" size="52px" />
              <div>
                <div class="text-overline text-primary">Fundação técnica</div>
                <h1 class="text-h5 q-my-xs">Ambiente base do sistema</h1>
                <p class="text-body2 text-grey-8 q-mb-none">
                  Vue 3, Quasar, Express, Prisma e PostgreSQL preparados. Nenhum fluxo de negócio
                  foi implementado nesta etapa.
                </p>
              </div>
            </QCardSection>

            <QSeparator />

            <QCardSection>
              <div class="text-subtitle2 q-mb-sm">Estado da API e do banco</div>
              <QChip
                v-if="apiState === 'checking'"
                color="blue-1"
                text-color="primary"
                icon="sync"
                label="Verificando prontidão"
              />
              <QChip
                v-else-if="apiState === 'ready'"
                color="green-1"
                text-color="green-9"
                icon="check_circle"
                label="API e PostgreSQL disponíveis"
              />
              <QChip
                v-else
                color="orange-1"
                text-color="orange-10"
                icon="warning"
                label="API ou PostgreSQL indisponível"
              />
            </QCardSection>
          </QCard>
        </main>
      </QPage>
    </QPageContainer>
  </QLayout>
</template>
