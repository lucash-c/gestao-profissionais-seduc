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
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthHttpError } from '@/services/auth.service';
import { sessionStore } from '@/stores/session.store';

const route = useRoute();
const router = useRouter();
const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
const submitting = computed(() => sessionStore.state.status === 'loading');

function destinationAfterLogin(): string {
  const requestedPath = route.query.redirect;
  return typeof requestedPath === 'string' && requestedPath.startsWith('/') ? requestedPath : '/';
}

async function submit(): Promise<void> {
  errorMessage.value = '';

  try {
    await sessionStore.login({ identifier: identifier.value, password: password.value });
    await router.replace(destinationAfterLogin());
  } catch (error) {
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
            <div class="brand-mark login-brand-mark" aria-hidden="true">S</div>
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
