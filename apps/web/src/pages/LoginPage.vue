<script setup lang="ts">
import {
  QBtn,
  QCard,
  QCardSection,
  QForm,
  QIcon,
  QInput,
  QLayout,
  QPage,
  QPageContainer,
} from 'quasar';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthHttpError } from '@/services/auth.service';
import { sessionStore } from '@/stores/session.store';
import logoSeduc from '@/assets/branding/logo-seduc-americana.png';

const route = useRoute();
const router = useRouter();
const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
const retryAfterSeconds = ref(0);
let retryTimer: ReturnType<typeof setInterval> | undefined;
const submitting = computed(() => sessionStore.state.status === 'loading');
const blocked = computed(() => retryAfterSeconds.value > 0);
const retryTime = computed(() => {
  const minutes = Math.floor(retryAfterSeconds.value / 60);
  const seconds = retryAfterSeconds.value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

function stopRetryTimer(): void {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = undefined;
}

function startRetryCountdown(seconds: number): void {
  stopRetryTimer();
  retryAfterSeconds.value = Math.max(1, Math.ceil(seconds));
  retryTimer = setInterval(() => {
    retryAfterSeconds.value = Math.max(0, retryAfterSeconds.value - 1);
    if (retryAfterSeconds.value === 0) stopRetryTimer();
  }, 1_000);
}

onBeforeUnmount(stopRetryTimer);

function destinationAfterLogin(): string {
  const requestedPath = route.query.redirect;
  return typeof requestedPath === 'string' && requestedPath.startsWith('/') ? requestedPath : '/';
}

async function submit(): Promise<void> {
  if (blocked.value || submitting.value) return;
  errorMessage.value = '';

  try {
    await sessionStore.login({ identifier: identifier.value, password: password.value });
    await router.replace(destinationAfterLogin());
  } catch (error) {
    if (error instanceof AuthHttpError && error.status === 429) {
      startRetryCountdown(error.retryAfterSeconds ?? 15 * 60);
    }
    errorMessage.value =
      error instanceof AuthHttpError ? error.message : 'Não foi possível entrar. Tente novamente.';
  }
}
</script>

<template>
  <QLayout view="hHh lpR fFf">
    <QPageContainer>
      <QPage class="login-page">
        <main class="login-content">
          <section class="login-introduction" aria-labelledby="login-title">
            <img
              class="login-logo"
              :src="logoSeduc"
              alt="Prefeitura de Americana — Secretaria de Educação"
            />
            <p class="eyebrow q-mb-sm">SEDUC AMERICANA</p>
            <h1 id="login-title">Gestão de profissionais</h1>
            <p>
              Acesso administrativo ao sistema de remoção, permuta e listão da Secretaria de
              Educação.
            </p>
          </section>

          <QCard flat bordered class="login-card">
            <QCardSection>
              <QIcon name="shield" color="primary" size="32px" aria-hidden="true" />
              <h2 class="text-h5 q-mt-md q-mb-xs">Entrar</h2>
              <p class="text-body2 text-grey-7 q-mt-none q-mb-lg">
                Use seu login administrativo ou e-mail.
              </p>

              <QForm data-testid="login-form" class="q-gutter-md" @submit.prevent="submit">
                <QInput
                  v-model="identifier"
                  autocomplete="username"
                  data-testid="login-identifier"
                  label="Login ou e-mail"
                  outlined
                  required
                />
                <QInput
                  v-model="password"
                  autocomplete="current-password"
                  data-testid="login-password"
                  label="Senha"
                  outlined
                  required
                  type="password"
                />

                <p
                  v-if="blocked"
                  class="login-rate-limit"
                  data-testid="login-countdown"
                  role="status"
                >
                  Tente novamente em {{ retryTime }}
                </p>

                <p
                  v-if="errorMessage"
                  class="login-error text-negative"
                  data-testid="login-error"
                  role="alert"
                >
                  {{ errorMessage }}
                </p>

                <QBtn
                  class="full-width"
                  color="primary"
                  data-testid="login-submit"
                  label="Entrar"
                  :loading="submitting"
                  :disable="blocked"
                  no-caps
                  type="submit"
                  unelevated
                />
                <p class="security-note">
                  <QIcon name="lock" aria-hidden="true" /> Acesso restrito a contas administrativas
                  autorizadas.
                </p>
              </QForm>
            </QCardSection>
          </QCard>
        </main>
      </QPage>
    </QPageContainer>
  </QLayout>
</template>
