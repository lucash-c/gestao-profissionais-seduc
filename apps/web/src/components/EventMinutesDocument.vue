<script setup lang="ts">
import type { EventMinutes, PublicEventChoice } from '@seduc/contracts';

import logoSeduc from '@/assets/branding/logo-seduc-americana.png';

defineProps<{ minutes: EventMinutes }>();

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

function eventType(value: EventMinutes['evento']['tipo']): string {
  return { ATRIBUICAO: 'Atribuição', LISTAO: 'Listão', PERMUTA: 'Permuta', REMOCAO: 'Remoção' }[
    value
  ];
}

function eventStatus(value: EventMinutes['evento']['status']): string {
  return { ATIVO: 'Ativo', CANCELADO: 'Cancelado', ENCERRADO: 'Encerrado', RASCUNHO: 'Rascunho' }[
    value
  ];
}
</script>

<template>
  <article class="event-minutes-document" data-testid="event-minutes-document">
    <header class="minutes-document__header">
      <img :src="logoSeduc" alt="Prefeitura de Americana — Secretaria de Educação" />
      <div>
        <p>PREFEITURA DE AMERICANA</p>
        <p>SECRETARIA DE EDUCAÇÃO</p>
      </div>
    </header>

    <div class="minutes-document__title">
      <h1>ATA DO EVENTO</h1>
      <p>
        {{ eventType(minutes.evento.tipo) }} — {{ minutes.evento.cargoFuncao }} —
        {{ minutes.evento.ano }}
      </p>
    </div>

    <dl class="minutes-document__details">
      <div>
        <dt>Tipo</dt>
        <dd>{{ eventType(minutes.evento.tipo) }}</dd>
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
        <dd>{{ eventStatus(minutes.evento.status) }}</dd>
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

    <section class="minutes-document__section">
      <h2>Participantes</h2>
      <ol v-if="minutes.participantes.length">
        <li
          v-for="participant in minutes.participantes"
          :key="`${participant.posicao}-${participant.nome}`"
        >
          {{ participant.posicao ? `${participant.posicao}º — ` : '' }}{{ participant.nome }}
        </li>
      </ol>
      <p v-else>Nenhum participante informado.</p>
    </section>

    <section class="minutes-document__section">
      <h2>Histórico</h2>
      <p v-if="minutes.evento.dataInicio">
        {{ formatDate(minutes.evento.dataInicio) }} — Evento iniciado.
      </p>
      <template v-for="movement in minutes.movimentacoes" :key="movementKey(movement)">
        <div v-if="movement.especie === 'PERMUTA'" class="minutes-document__movement">
          <p>
            <strong
              >{{ formatDate(movement.dataHora) }} — Foi registrada a seguinte permuta:</strong
            >
          </p>
          <p v-for="item in movement.itens" :key="item.profissional">
            {{ item.profissional }}<br />{{ item.unidadeOrigem }} → {{ item.unidadeDestino }}
          </p>
        </div>
        <div v-else class="minutes-document__movement">
          <p>
            <strong>{{ formatDate(movement.dataHora) }} — Movimentação registrada.</strong><br />
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

    <section class="minutes-document__signatures">
      <p>Americana, {{ longDate(minutes.evento.dataFim) }}.</p>
      <div class="minutes-document__signature-grid">
        <div>
          <span></span><strong>Operador responsável</strong
          ><small>Nome: {{ minutes.evento.responsavel ?? '______________________________' }}</small>
        </div>
        <div>
          <span></span><strong>Representante da SEDUC</strong
          ><small>Nome: ______________________________</small>
        </div>
        <template v-for="movement in minutes.movimentacoes" :key="`sign-${movementKey(movement)}`">
          <template v-if="movement.especie === 'PERMUTA'">
            <div v-for="item in movement.itens" :key="item.profissional">
              <span></span><strong>{{ item.profissional }}</strong>
            </div>
          </template>
          <div v-else>
            <span></span><strong>{{ movement.profissional }}</strong>
          </div>
        </template>
      </div>
    </section>
  </article>
</template>

<style scoped>
.event-minutes-document {
  background: #fff;
  color: #1f2937;
  font-size: 0.95rem;
  line-height: 1.45;
  margin: 0 auto;
  max-width: 820px;
  padding: clamp(26px, 5vw, 44px);
}
.minutes-document__header {
  align-items: center;
  border-bottom: 1px solid #aeb8c4;
  display: flex;
  gap: 16px;
  padding-bottom: 12px;
}
.minutes-document__header img {
  height: auto;
  max-width: 132px;
  width: 30%;
}
.minutes-document__header p {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0;
}
.minutes-document__title {
  padding: 18px 0 12px;
  text-align: center;
}
.minutes-document__title h1 {
  font-size: 1.25rem;
  letter-spacing: 0.04em;
  margin: 0;
}
.minutes-document__title p {
  font-size: 1rem;
  font-weight: 600;
  margin: 6px 0 0;
}
.minutes-document__details {
  border-bottom: 1px solid #c7ced7;
  border-top: 1px solid #c7ced7;
  display: grid;
  gap: 8px 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 12px 0;
}
.minutes-document__details div {
  min-width: 0;
}
.minutes-document__details dt {
  color: #52606d;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.minutes-document__details dd {
  margin: 1px 0 0;
}
.minutes-document__section {
  margin-top: 22px;
}
.minutes-document__section h2 {
  border-bottom: 1px solid #aeb8c4;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  margin: 0 0 10px;
  padding-bottom: 5px;
  text-transform: uppercase;
}
.minutes-document__section ol {
  margin: 0;
  padding-left: 22px;
}
.minutes-document__section p {
  margin: 0 0 9px;
}
.minutes-document__movement {
  break-inside: avoid;
  page-break-inside: avoid;
}
.minutes-document__signatures {
  margin-top: 30px;
}
.minutes-document__signatures > p {
  margin: 0;
}
.minutes-document__signature-grid {
  display: grid;
  gap: 24px 34px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 38px;
}
.minutes-document__signature-grid > div {
  break-inside: avoid;
  display: grid;
  gap: 3px;
  page-break-inside: avoid;
}
.minutes-document__signature-grid span {
  border-top: 1px solid #1f2937;
  display: block;
}
.minutes-document__signature-grid small {
  font-size: 0.76rem;
}
@media (max-width: 640px) {
  .minutes-document__details,
  .minutes-document__signature-grid {
    grid-template-columns: 1fr;
  }
}
@media print {
  @page {
    margin: 20mm;
    size: A4 portrait;
  }
  .event-minutes-document {
    box-shadow: none;
    font-size: 11pt;
    max-width: none;
    min-height: 0;
    padding: 0;
  }
  .minutes-document__header,
  .minutes-document__details,
  .minutes-document__section,
  .minutes-document__signatures {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .minutes-document__title h1 {
    font-size: 18pt;
  }
}
</style>
