<script setup lang="ts">
import { QLayout, QPageContainer } from 'quasar';
</script>

<template>
  <QLayout view="hHh lpR fFf" class="public-layout" data-testid="public-event-layout">
    <QPageContainer>
      <RouterView />
    </QPageContainer>
  </QLayout>
</template>
