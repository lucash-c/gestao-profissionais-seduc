import type {
  EventCentralRecord,
  EventChoiceResult,
  EventChoiceSimulation,
  EventOperationalExercise,
  EventOperationalLink,
  EventOperationalMovement,
  EventOperationalParticipant,
  EventOperationalSituation,
  EventPeriodRuleStatus,
  EventRecord,
  PaginatedResponse,
  PublicEventChoice,
  PublicEventDisplay,
  WorkPositionRecord,
} from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import { HttpError } from '../../http/http-error.js';
import { writeAudit } from '../audit/audit.service.js';
import {
  loadPosition,
  lockPositions,
  lockProfessionals,
  mapWorkPosition,
  positionAvailabilityInclude,
  type PositionAvailabilityPayload,
} from '../assignments/assignment.service.js';
import type {
  EventChoiceInput,
  EventMovementQuery,
  EventVacancyQuery,
} from './event-operation.schemas.js';
import { eventInclude, mapEvent, type EventPayload } from './event.service.js';

const participantInclude = {
  profissional: { select: { cargoFuncaoId: true, id: true, nomeCompleto: true } },
} as const;

const positionLinkInclude = {
  quadroNecessidade: { include: { periodo: true, unidade: true } },
} as const;

const professionalSituationInclude = {
  afastamentos: { select: { id: true }, where: { dataFim: null } },
  cargoFuncao: { select: { permiteMultiplosExercicios: true } },
  exercicios: {
    include: {
      postoTrabalho: { include: positionLinkInclude },
      substituiProfissional: { select: { id: true, nomeCompleto: true } },
    },
    orderBy: { dataInicio: 'asc' as const },
    where: { dataFim: null },
  },
  lotacoesSede: {
    include: { postoTrabalho: { include: positionLinkInclude } },
    take: 1,
    where: { dataFim: null },
  },
} as const;

const movementInclude = {
  itens: {
    include: {
      postoDestino: { include: positionLinkInclude },
      postoOrigem: { include: positionLinkInclude },
      profissional: { select: { nomeCompleto: true } },
    },
  },
} as const;

type ParticipantPayload = Prisma.EventoParticipanteGetPayload<{
  include: typeof participantInclude;
}>;
type ProfessionalSituationPayload = Prisma.ProfissionalGetPayload<{
  include: typeof professionalSituationInclude;
}>;
type MovementPayload = Prisma.MovimentacaoGetPayload<{ include: typeof movementInclude }>;

interface ChoiceAnalysis {
  destination: PositionAvailabilityPayload;
  destinationType: 'SEDE' | 'SEM_SEDE';
  oldExercise: ProfessionalSituationPayload['exercicios'][number] | null;
  oldPlacement: ProfessionalSituationPayload['lotacoesSede'][number] | null;
  periodId: string;
  professional: ProfessionalSituationPayload;
  simulation: EventChoiceSimulation;
  substituteProfessionalId: string | null;
  temporaryExerciseType: 'SUBSTITUICAO' | 'SEM_SEDE' | null;
}

type AllowedPeriodRule = Extract<EventPeriodRuleStatus, { mode: 'ANY' | 'FIXED' }>;

export interface EventOperationServices {
  central(id: string): Promise<EventCentralRecord>;
  choose(id: string, userId: string, input: EventChoiceInput): Promise<EventChoiceResult>;
  close(id: string, userId?: string): Promise<EventRecord>;
  movements(
    id: string,
    query: EventMovementQuery,
  ): Promise<PaginatedResponse<EventOperationalMovement>>;
  publicChoices(
    id: string,
    query: EventMovementQuery,
  ): Promise<PaginatedResponse<PublicEventChoice>>;
  publicDisplay(id: string): Promise<PublicEventDisplay>;
  simulate(id: string, postoTrabalhoId: string): Promise<EventChoiceSimulation>;
  vacancies(id: string, query: EventVacancyQuery): Promise<WorkPositionRecord[]>;
}

function civilDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function asLookup(value: { ativo: boolean; id: string; nome: string }) {
  return { ativo: value.ativo, id: value.id, nome: value.nome };
}

function mapLink(position: {
  id: string;
  periodoId: string;
  quadroNecessidade: {
    periodo: { ativo: boolean; id: string; nome: string };
    unidade: { ativo: boolean; id: string; nome: string };
  };
  unidadeId: string;
}): EventOperationalLink {
  return {
    periodo: asLookup(position.quadroNecessidade.periodo),
    periodoId: position.periodoId,
    postoId: position.id,
    unidade: asLookup(position.quadroNecessidade.unidade),
    unidadeId: position.unidadeId,
  };
}

function mapSituation(professional: ProfessionalSituationPayload): EventOperationalSituation {
  return {
    exerciciosAtuais: professional.exercicios.map((exercise): EventOperationalExercise => ({
      ...mapLink(exercise.postoTrabalho),
      id: exercise.id,
      substituiProfissional: exercise.substituiProfissional
        ? {
            id: exercise.substituiProfissional.id,
            nome: exercise.substituiProfissional.nomeCompleto,
          }
        : null,
      tipo: exercise.tipoExercicio,
    })),
    sedeAtual: professional.lotacoesSede[0]
      ? mapLink(professional.lotacoesSede[0].postoTrabalho)
      : null,
  };
}

function mapParticipant(
  participant: ParticipantPayload,
  cargo: string,
): EventOperationalParticipant {
  if (
    participant.posicao === null ||
    !participant.dataEntradaSnapshot ||
    !participant.dataNascimentoSnapshot ||
    participant.numeroFilhosSnapshot === null ||
    !['AGUARDANDO', 'ATENDIDO'].includes(participant.status)
  ) {
    throw new HttpError(
      409,
      'EVENT_QUEUE_INVALID',
      'A fila congelada possui participante sem dados oficiais válidos.',
    );
  }
  return {
    cargo,
    dataEntradaSnapshot: civilDate(participant.dataEntradaSnapshot),
    dataNascimentoSnapshot: civilDate(participant.dataNascimentoSnapshot),
    nome: participant.profissional.nomeCompleto,
    numeroFilhosSnapshot: participant.numeroFilhosSnapshot,
    participanteId: participant.id,
    pontuacaoSnapshot: participant.pontuacaoSnapshot?.toFixed(2) ?? null,
    posicao: participant.posicao,
    profissionalId: participant.profissionalId,
    status: participant.status as 'AGUARDANDO' | 'ATENDIDO',
  };
}

function mapMovement(movement: MovementPayload): EventOperationalMovement {
  const item = movement.itens[0];
  if (!item || movement.itens.length !== 1) {
    throw new HttpError(
      409,
      'EVENT_MOVEMENT_INVALID',
      'A movimentação do evento deve possuir exatamente um item.',
    );
  }
  return {
    dataHora: movement.dataHora.toISOString(),
    id: movement.id,
    origem: item.postoOrigem ? mapLink(item.postoOrigem) : null,
    periodo: item.postoDestino.quadroNecessidade.periodo.nome,
    postoDestinoId: item.postoDestinoId,
    postoOrigemId: item.postoOrigemId,
    profissional: item.profissional.nomeCompleto,
    tipoDestino: item.tipoDestino,
    unidadeDestino: item.postoDestino.quadroNecessidade.unidade.nome,
  };
}

function toPublicChoice(movement: EventOperationalMovement): PublicEventChoice {
  return {
    dataHora: movement.dataHora,
    periodo: movement.periodo,
    profissional: movement.profissional,
    tipoDestino: movement.tipoDestino,
    unidadeDestino: movement.unidadeDestino,
  };
}

function assertSupportedType(event: EventPayload): void {
  if (event.tipo === 'PERMUTA') {
    throw new HttpError(
      409,
      'EVENT_TYPE_NOT_SUPPORTED_IN_STAGE_7',
      'A operação de Permuta será disponibilizada na Etapa 8.',
    );
  }
}

function assertActiveEvent(event: EventPayload): void {
  assertSupportedType(event);
  assertClosableActiveEvent(event);
}

function assertClosableActiveEvent(event: EventPayload): void {
  if (event.status === 'RASCUNHO') {
    throw new HttpError(409, 'EVENT_NOT_ACTIVE', 'O evento ainda não foi iniciado.');
  }
  if (event.status === 'ENCERRADO') {
    throw new HttpError(409, 'EVENT_CLOSED', 'O evento está encerrado.');
  }
  if (event.status === 'CANCELADO') {
    throw new HttpError(409, 'EVENT_CANCELLED', 'O evento está cancelado.');
  }
}

function periodRule(situation: EventOperationalSituation): EventPeriodRuleStatus {
  if (situation.exerciciosAtuais.length > 0) {
    const exercisePeriods = new Set(situation.exerciciosAtuais.map(({ periodoId }) => periodoId));
    if (exercisePeriods.size === 1) {
      return {
        code: null,
        message: null,
        mode: 'FIXED',
        periodoId: [...exercisePeriods][0]!,
      };
    }
    return {
      code: 'EVENT_PERIOD_RULE_REQUIRED',
      message: 'Os exercícios ativos apontam para períodos diferentes.',
      mode: 'BLOCKED',
      periodoId: null,
    };
  }
  if (situation.sedeAtual) {
    return {
      code: null,
      message: null,
      mode: 'FIXED',
      periodoId: situation.sedeAtual.periodoId,
    };
  }
  return {
    code: null,
    message: 'Período permitido: qualquer período disponível.',
    mode: 'ANY',
    periodoId: null,
  };
}

function requireAllowedPeriodRule(situation: EventOperationalSituation): AllowedPeriodRule {
  const rule = periodRule(situation);
  if (rule.mode === 'BLOCKED') {
    throw new HttpError(409, 'EVENT_PERIOD_RULE_REQUIRED', rule.message);
  }
  return rule;
}

function handleDatabaseError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2010' && JSON.stringify(error.meta).includes('40001')) {
      throw new HttpError(
        409,
        'EVENT_OPERATION_CONFLICT',
        'A operação sofreu uma alteração concorrente. Atualize a Central e tente novamente.',
      );
    }
    if (['P2002', 'P2004', 'P2034'].includes(error.code)) {
      throw new HttpError(
        409,
        'POSITION_NO_LONGER_AVAILABLE',
        'O posto deixou de estar disponível. Atualize a Central e tente novamente.',
      );
    }
    if (['P2003', 'P2025'].includes(error.code)) {
      throw new HttpError(404, 'NOT_FOUND', 'Registro relacionado não encontrado.');
    }
  }
  throw error;
}

async function lockEvent(transaction: Prisma.TransactionClient, id: string): Promise<void> {
  const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "evento" WHERE "id" = ${id}::uuid FOR UPDATE
  `);
  if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Evento não encontrado.');
}

async function lockParticipant(transaction: Prisma.TransactionClient, id: string): Promise<void> {
  const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "evento_participante" WHERE "id" = ${id}::uuid FOR UPDATE
  `);
  if (rows.length === 0) {
    throw new HttpError(
      409,
      'EVENT_PARTICIPANT_ALREADY_HANDLED',
      'O participante esperado não está mais aguardando atendimento.',
    );
  }
}

async function loadEvent(transaction: Prisma.TransactionClient, id: string): Promise<EventPayload> {
  const event = await transaction.evento.findUnique({ include: eventInclude, where: { id } });
  if (!event) throw new HttpError(404, 'NOT_FOUND', 'Evento não encontrado.');
  return event;
}

async function loadProfessionalSituation(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<ProfessionalSituationPayload> {
  const professional = await transaction.profissional.findUnique({
    include: professionalSituationInclude,
    where: { id },
  });
  if (!professional) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
  return professional;
}

async function loadQueue(
  transaction: Prisma.TransactionClient,
  event: EventPayload,
): Promise<{ current: ParticipantPayload | null; queue: ParticipantPayload[] }> {
  const queue = await transaction.eventoParticipante.findMany({
    include: participantInclude,
    orderBy: { posicao: 'asc' },
    where: {
      eventoId: event.id,
      posicao: { not: null },
      status: { in: ['AGUARDANDO', 'ATENDIDO'] },
    },
  });
  return { current: queue.find(({ status }) => status === 'AGUARDANDO') ?? null, queue };
}

async function listAvailablePositions(
  transaction: Prisma.TransactionClient,
  event: EventPayload,
  periodRuleStatus: AllowedPeriodRule,
  query: EventVacancyQuery = {},
): Promise<WorkPositionRecord[]> {
  if (
    periodRuleStatus.mode === 'FIXED' &&
    query.periodoId &&
    query.periodoId !== periodRuleStatus.periodoId
  ) {
    return [];
  }
  const periodId = periodRuleStatus.mode === 'FIXED' ? periodRuleStatus.periodoId : query.periodoId;
  const positions = await transaction.postoTrabalho.findMany({
    include: positionAvailabilityInclude,
    orderBy: [{ unidadeId: 'asc' }, { periodoId: 'asc' }, { id: 'asc' }],
    where: {
      anoLetivo: event.ano,
      ativo: true,
      cargoFuncaoId: event.cargoFuncaoId,
      ...(periodId ? { periodoId: periodId } : {}),
      ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
    },
  });
  return positions
    .map(mapWorkPosition)
    .filter(({ disponibilidade }) =>
      query.tipo
        ? disponibilidade ===
          (query.tipo === 'SEDE' ? 'DISPONIVEL_COM_SEDE' : 'DISPONIVEL_SEM_SEDE')
        : ['DISPONIVEL_COM_SEDE', 'DISPONIVEL_SEM_SEDE'].includes(disponibilidade),
    );
}

async function analyzeChoice(
  transaction: Prisma.TransactionClient,
  event: EventPayload,
  participant: ParticipantPayload,
  postoTrabalhoId: string,
): Promise<ChoiceAnalysis> {
  const professional = await loadProfessionalSituation(transaction, participant.profissionalId);
  if (!professional.ativo || professional.cargoFuncaoId !== event.cargoFuncaoId) {
    throw new HttpError(
      409,
      'EVENT_PARTICIPANT_CARGO_MISMATCH',
      'O profissional atual está inativo ou não pertence mais ao cargo do evento.',
    );
  }
  if (event.tipo === 'ATRIBUICAO' && professional.lotacoesSede.length > 0) {
    throw new HttpError(
      409,
      'EVENT_PARTICIPANT_NO_LONGER_ELIGIBLE',
      'O profissional adquiriu sede e não é mais elegível para Atribuição.',
    );
  }
  const situation = mapSituation(professional);
  const allowedPeriodRule = requireAllowedPeriodRule(situation);
  const destination = await loadPosition(transaction, postoTrabalhoId);
  if (!destination.ativo) {
    throw new HttpError(409, 'POSITION_NO_LONGER_AVAILABLE', 'O posto está inativo.');
  }
  if (destination.anoLetivo !== event.ano) {
    throw new HttpError(409, 'INCOMPATIBLE_POSITION_YEAR', 'O posto pertence a outro ano.');
  }
  if (
    destination.cargoFuncaoId !== event.cargoFuncaoId ||
    professional.cargoFuncaoId !== destination.cargoFuncaoId
  ) {
    throw new HttpError(409, 'INCOMPATIBLE_POSITION_CARGO', 'O cargo do posto é incompatível.');
  }
  if (allowedPeriodRule.mode === 'FIXED' && destination.periodoId !== allowedPeriodRule.periodoId) {
    throw new HttpError(
      409,
      'INCOMPATIBLE_POSITION_PERIOD',
      'O período do posto é incompatível com a situação atual do profissional.',
    );
  }

  const availability = mapWorkPosition(destination);
  if (!['DISPONIVEL_COM_SEDE', 'DISPONIVEL_SEM_SEDE'].includes(availability.disponibilidade)) {
    throw new HttpError(409, 'POSITION_NO_LONGER_AVAILABLE', 'O posto deixou de estar disponível.');
  }
  const destinationType =
    availability.disponibilidade === 'DISPONIVEL_COM_SEDE' ? 'SEDE' : 'SEM_SEDE';
  const oldPlacement = professional.lotacoesSede[0] ?? null;
  let oldExercise: ProfessionalSituationPayload['exercicios'][number] | null = null;
  let substituteProfessionalId: string | null = null;
  let temporaryExerciseType: 'SUBSTITUICAO' | 'SEM_SEDE' | null = null;

  if (destinationType === 'SEDE' && oldPlacement) {
    const previousPosition = await loadPosition(transaction, oldPlacement.postoTrabalhoId);
    if (previousPosition.exercicios.length > 0) {
      throw new HttpError(
        409,
        'PREVIOUS_SEAT_STILL_OCCUPIED',
        'A sede anterior ainda possui ocupante temporário.',
      );
    }
  }
  if (destinationType === 'SEDE' && event.tipo === 'ATRIBUICAO') {
    if (professional.exercicios.length > 1) {
      throw new HttpError(
        409,
        'AMBIGUOUS_ACTIVE_EXERCISES',
        'Há múltiplos exercícios ativos e não é possível concluir a atribuição.',
      );
    }
    oldExercise = professional.exercicios[0] ?? null;
  }
  if (destinationType === 'SEM_SEDE') {
    if (professional.afastamentos.length > 0) {
      throw new HttpError(
        409,
        'PROFESSIONAL_ON_ACTIVE_ABSENCE',
        'Profissional afastado não pode receber exercício temporário.',
      );
    }
    if (professional.exercicios.length > 1) {
      throw new HttpError(
        409,
        'AMBIGUOUS_ACTIVE_EXERCISES',
        'Há múltiplos exercícios ativos e não é possível escolher qual deve ser encerrado.',
      );
    }
    oldExercise = professional.exercicios[0] ?? null;
    substituteProfessionalId = destination.lotacoesSede[0]?.profissionalId ?? null;
    if (!substituteProfessionalId || substituteProfessionalId === professional.id) {
      throw new HttpError(
        409,
        'POSITION_NO_LONGER_AVAILABLE',
        'O destino não possui titular válido para substituição.',
      );
    }
    temporaryExerciseType = oldPlacement ? 'SUBSTITUICAO' : 'SEM_SEDE';
  }

  const destinationLink = mapLink(destination);
  const newVacancies: EventChoiceSimulation['novasVagasGeradas'] = [];
  if (destinationType === 'SEDE' && oldPlacement?.postoTrabalhoId !== destination.id) {
    if (oldPlacement) newVacancies.push({ ...mapLink(oldPlacement.postoTrabalho), tipo: 'SEDE' });
  } else if (destinationType === 'SEM_SEDE') {
    if (oldExercise && oldExercise.postoTrabalhoId !== destination.id) {
      newVacancies.push({ ...mapLink(oldExercise.postoTrabalho), tipo: 'SEM_SEDE' });
    } else if (!oldExercise && oldPlacement) {
      const ownSeat = await loadPosition(transaction, oldPlacement.postoTrabalhoId);
      if (ownSeat.exercicios.length === 0) {
        newVacancies.push({ ...mapLink(oldPlacement.postoTrabalho), tipo: 'SEM_SEDE' });
      }
    }
  }

  return {
    destination,
    destinationType,
    oldExercise,
    oldPlacement,
    periodId: destination.periodoId,
    professional,
    simulation: {
      antes: {
        exerciciosAtuais: situation.exerciciosAtuais,
        profissional: professional.nomeCompleto,
        sedeOficial: situation.sedeAtual,
      },
      depois: {
        exercicioNovo:
          destinationType === 'SEM_SEDE'
            ? { ...destinationLink, tipo: temporaryExerciseType! }
            : null,
        sedeOficial: destinationType === 'SEDE' ? destinationLink : situation.sedeAtual,
        titularidadePreservada: destinationType === 'SEM_SEDE',
        vinculoEncerrado:
          destinationType === 'SEDE'
            ? situation.sedeAtual
            : oldExercise
              ? mapLink(oldExercise.postoTrabalho)
              : null,
      },
      destino: {
        ...destinationLink,
        tipo: destinationType,
        titular: availability.titularAtual
          ? { id: availability.titularAtual.id, nome: availability.titularAtual.nomeCompleto }
          : null,
      },
      novasVagasGeradas: newVacancies,
      participanteEsperadoId: participant.id,
    },
    substituteProfessionalId,
    temporaryExerciseType,
  };
}

async function latestMovements(
  transaction: Prisma.TransactionClient,
  eventId: string,
  take: number,
): Promise<EventOperationalMovement[]> {
  const movements = await transaction.movimentacao.findMany({
    include: movementInclude,
    orderBy: { dataHora: 'desc' },
    take,
    where: { eventoId: eventId },
  });
  return movements.map(mapMovement);
}

async function buildCentral(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<EventCentralRecord> {
  const event = await loadEvent(transaction, id);
  assertActiveEvent(event);
  const { current, queue } = await loadQueue(transaction, event);
  const mappedQueue = queue.map((participant) =>
    mapParticipant(participant, event.cargoFuncao.nome),
  );
  const currentMapped = current ? mapParticipant(current, event.cargoFuncao.nome) : null;
  let situation: EventOperationalSituation | null = null;
  let rule: EventPeriodRuleStatus | null = null;
  let vacancies: WorkPositionRecord[] = [];
  if (current) {
    situation = mapSituation(await loadProfessionalSituation(transaction, current.profissionalId));
    rule = periodRule(situation);
    if (rule.mode !== 'BLOCKED') {
      vacancies = await listAvailablePositions(transaction, event, rule);
    }
  }
  const waiting = mappedQueue.filter(({ status }) => status === 'AGUARDANDO');
  const attended = mappedQueue.filter(({ status }) => status === 'ATENDIDO');
  return {
    evento: mapEvent(event),
    fila: mappedQueue,
    participanteAtual: currentMapped,
    proximos: waiting.slice(current ? 1 : 0, current ? 6 : 5),
    regraPeriodo: rule,
    situacaoAtual: situation,
    totais: {
      aguardando: waiting.length,
      atendidos: attended.length,
      podeEncerrar: waiting.length === 0,
      total: mappedQueue.length,
      vagasDisponiveis: vacancies.length,
    },
    ultimasMovimentacoes: await latestMovements(transaction, id, 5),
    vagasDisponiveis: vacancies,
  };
}

export function createPrismaEventOperationServices(
  database: DatabaseConnection,
  clock: () => Date = () => new Date(),
): EventOperationServices {
  const { client } = database;

  return {
    async central(id) {
      return client.$transaction((transaction) => buildCentral(transaction, id));
    },
    async choose(id, userId, input) {
      try {
        const result = await client.$transaction(async (transaction) => {
          await lockEvent(transaction, id);
          const event = await loadEvent(transaction, id);
          assertActiveEvent(event);

          const expected = await transaction.eventoParticipante.findUnique({
            include: participantInclude,
            where: { id: input.participanteEsperadoId },
          });
          if (!expected || expected.eventoId !== id) {
            throw new HttpError(
              409,
              'EVENT_PARTICIPANT_ALREADY_HANDLED',
              'O participante esperado não pertence mais à vez atual.',
            );
          }
          await lockParticipant(transaction, expected.id);
          const current = await transaction.eventoParticipante.findFirst({
            include: participantInclude,
            orderBy: { posicao: 'asc' },
            where: { eventoId: id, posicao: { not: null }, status: 'AGUARDANDO' },
          });
          if (expected.status !== 'AGUARDANDO' || current?.id !== expected.id) {
            throw new HttpError(
              409,
              'EVENT_PARTICIPANT_ALREADY_HANDLED',
              'A vez mudou. Atualize a Central antes de confirmar outra escolha.',
            );
          }

          const initialDestination = await transaction.postoTrabalho.findUnique({
            select: {
              lotacoesSede: {
                select: { profissionalId: true },
                take: 1,
                where: { dataFim: null },
              },
            },
            where: { id: input.postoTrabalhoId },
          });
          if (!initialDestination) throw new HttpError(404, 'NOT_FOUND', 'Posto não encontrado.');
          const initialHolderId = initialDestination.lotacoesSede[0]?.profissionalId;
          await lockProfessionals(transaction, [
            expected.profissionalId,
            ...(initialHolderId ? [initialHolderId] : []),
          ]);
          const initialProfessional = await loadProfessionalSituation(
            transaction,
            expected.profissionalId,
          );
          await lockPositions(transaction, [
            input.postoTrabalhoId,
            ...initialProfessional.lotacoesSede.map(({ postoTrabalhoId }) => postoTrabalhoId),
            ...initialProfessional.exercicios.map(({ postoTrabalhoId }) => postoTrabalhoId),
          ]);

          const analysis = await analyzeChoice(transaction, event, expected, input.postoTrabalhoId);
          if (
            analysis.destinationType === 'SEM_SEDE' &&
            analysis.substituteProfessionalId !== initialHolderId
          ) {
            throw new HttpError(
              409,
              'POSITION_NO_LONGER_AVAILABLE',
              'A titularidade do destino mudou durante a confirmação.',
            );
          }
          const now = clock();
          let originId: string | null = null;
          if (analysis.destinationType === 'SEDE') {
            if (analysis.oldPlacement) {
              originId = analysis.oldPlacement.postoTrabalhoId;
              await transaction.lotacaoSede.update({
                data: {
                  dataFim: now,
                  motivoFim: `Movimentação por evento ${event.tipo}/${event.nome}`,
                },
                where: { id: analysis.oldPlacement.id },
              });
            }
            if (analysis.oldExercise) {
              originId ??= analysis.oldExercise.postoTrabalhoId;
              await transaction.exercicioProfissional.update({
                data: { dataFim: now },
                where: { id: analysis.oldExercise.id },
              });
            }
            await transaction.postoTrabalho.update({
              data: { reservadoParaEvento: false },
              where: { id: analysis.destination.id },
            });
            await transaction.lotacaoSede.create({
              data: {
                dataInicio: now,
                postoTrabalhoId: analysis.destination.id,
                profissionalId: expected.profissionalId,
              },
            });
          } else {
            if (analysis.oldExercise) {
              originId = analysis.oldExercise.postoTrabalhoId;
              await transaction.exercicioProfissional.update({
                data: { dataFim: now },
                where: { id: analysis.oldExercise.id },
              });
            }
            await transaction.exercicioProfissional.create({
              data: {
                dataInicio: now,
                observacoes: `Movimentação por evento ${event.tipo}/${event.nome}`,
                postoTrabalhoId: analysis.destination.id,
                profissionalId: expected.profissionalId,
                substituiProfissionalId: analysis.substituteProfessionalId,
                tipoExercicio: analysis.temporaryExerciseType!,
              },
            });
          }

          const movement = await transaction.movimentacao.create({
            data: {
              dataHora: now,
              eventoId: event.id,
              itens: {
                create: {
                  postoDestinoId: analysis.destination.id,
                  postoOrigemId: originId,
                  profissionalId: expected.profissionalId,
                  substituiProfissionalId: analysis.substituteProfessionalId,
                  tipoDestino: analysis.destinationType,
                },
              },
              tipo: event.tipo,
              usuarioId: userId,
            },
            include: movementInclude,
          });
          await transaction.eventoParticipante.update({
            data: { status: 'ATENDIDO' },
            where: { id: expected.id },
          });
          return {
            atendido: {
              ...mapParticipant(expected, event.cargoFuncao.nome),
              status: 'ATENDIDO' as const,
            },
            movimentacao: mapMovement(movement),
          };
        });
        return {
          ...result,
          central: await client.$transaction((transaction) => buildCentral(transaction, id)),
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    async close(id, userId) {
      try {
        return await client.$transaction(async (transaction) => {
          await lockEvent(transaction, id);
          const event = await loadEvent(transaction, id);
          assertClosableActiveEvent(event);
          const pending = await transaction.eventoParticipante.count({
            where: { eventoId: id, status: 'AGUARDANDO' },
          });
          if (pending > 0) {
            throw new HttpError(
              409,
              'EVENT_HAS_PENDING_PARTICIPANTS',
              'Todos os participantes precisam ser atendidos antes do encerramento.',
            );
          }
          const closed = mapEvent(
            await transaction.evento.update({
              data: { dataFim: clock(), status: 'ENCERRADO' },
              include: eventInclude,
              where: { id },
            }),
          );
          if (userId) {
            await writeAudit(transaction, {
              acao: 'UPDATE',
              after: closed,
              before: mapEvent(event),
              entidade: 'EVENTO',
              registroId: id,
              usuarioId: userId,
            });
          }
          return closed;
        });
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    async movements(id, query) {
      return client.$transaction(async (transaction) => {
        const event = await loadEvent(transaction, id);
        assertSupportedType(event);
        if (event.status === 'RASCUNHO') {
          throw new HttpError(409, 'EVENT_NOT_ACTIVE', 'O evento ainda não foi iniciado.');
        }
        if (event.status === 'CANCELADO') {
          throw new HttpError(409, 'EVENT_CANCELLED', 'O evento está cancelado.');
        }
        const where = { eventoId: id };
        const movements = await transaction.movimentacao.findMany({
          include: movementInclude,
          orderBy: { dataHora: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          where,
        });
        const total = await transaction.movimentacao.count({ where });
        return {
          items: movements.map(mapMovement),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        };
      });
    },
    async publicChoices(id, query) {
      return client.$transaction(async (transaction) => {
        const event = await loadEvent(transaction, id);
        assertSupportedType(event);
        if (!['ATIVO', 'ENCERRADO'].includes(event.status)) {
          throw new HttpError(404, 'NOT_FOUND', 'Evento público não encontrado.');
        }
        const where = { eventoId: id };
        const movements = await transaction.movimentacao.findMany({
          include: movementInclude,
          orderBy: { dataHora: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          where,
        });
        const total = await transaction.movimentacao.count({ where });
        return {
          items: movements.map(mapMovement).map(toPublicChoice),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        };
      });
    },
    async publicDisplay(id) {
      return client.$transaction(async (transaction) => {
        const event = await loadEvent(transaction, id);
        assertSupportedType(event);
        if (!['ATIVO', 'ENCERRADO'].includes(event.status)) {
          throw new HttpError(404, 'NOT_FOUND', 'Evento público não encontrado.');
        }
        const { current, queue } = await loadQueue(transaction, event);
        const waiting = queue.filter(({ status }) => status === 'AGUARDANDO');
        let positions: WorkPositionRecord[] = [];
        if (event.status === 'ATIVO' && current) {
          const situation = mapSituation(
            await loadProfessionalSituation(transaction, current.profissionalId),
          );
          const rule = periodRule(situation);
          if (rule.mode !== 'BLOCKED') {
            positions = await listAvailablePositions(transaction, event, rule);
          }
        }
        const grouped = new Map<string, PublicEventDisplay['vagas'][number]>();
        for (const position of positions) {
          const tipo = position.disponibilidade === 'DISPONIVEL_COM_SEDE' ? 'SEDE' : 'SEM_SEDE';
          const key = `${position.unidade.nome}|${position.periodo.nome}|${tipo}`;
          const existing = grouped.get(key);
          if (existing) existing.quantidade += 1;
          else {
            grouped.set(key, {
              periodo: position.periodo.nome,
              quantidade: 1,
              tipo,
              unidade: position.unidade.nome,
            });
          }
        }
        return {
          evento: {
            ano: event.ano,
            nome: event.nome,
            status: event.status as 'ATIVO' | 'ENCERRADO',
            tipo: event.tipo as 'REMOCAO' | 'LISTAO' | 'ATRIBUICAO',
          },
          participanteAtual: current
            ? { nome: current.profissional.nomeCompleto, posicao: current.posicao! }
            : null,
          proximos: waiting.slice(current ? 1 : 0, current ? 6 : 5).map((participant) => ({
            nome: participant.profissional.nomeCompleto,
            posicao: participant.posicao!,
          })),
          ultimasEscolhas: (await latestMovements(transaction, id, 5)).map(toPublicChoice),
          vagas: [...grouped.values()],
        };
      });
    },
    async simulate(id, postoTrabalhoId) {
      return client.$transaction(async (transaction) => {
        const event = await loadEvent(transaction, id);
        assertActiveEvent(event);
        const { current } = await loadQueue(transaction, event);
        if (!current) {
          throw new HttpError(
            409,
            'EVENT_WITHOUT_CURRENT_PARTICIPANT',
            'Não há participante atual.',
          );
        }
        return (await analyzeChoice(transaction, event, current, postoTrabalhoId)).simulation;
      });
    },
    async vacancies(id, query) {
      return client.$transaction(async (transaction) => {
        const event = await loadEvent(transaction, id);
        assertActiveEvent(event);
        const { current } = await loadQueue(transaction, event);
        if (!current) return [];
        const situation = mapSituation(
          await loadProfessionalSituation(transaction, current.profissionalId),
        );
        return listAvailablePositions(
          transaction,
          event,
          requireAllowedPeriodRule(situation),
          query,
        );
      });
    },
  };
}
