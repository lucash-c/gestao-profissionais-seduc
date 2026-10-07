import type {
  EventExchangeCentralRecord,
  EventExchangeMovement,
  EventExchangeParticipant,
  EventExchangeResult,
  EventExchangeSimulation,
  EventOperationalLink,
  EventOperationalParticipant,
} from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import { HttpError } from '../../http/http-error.js';
import { lockPositions, lockProfessionals } from '../assignments/assignment.service.js';
import type { EventExchangeConfirmationInput } from './event-operation.schemas.js';
import { eventInclude, mapEvent, type EventPayload } from './event.service.js';

const participantInclude = {
  profissional: { select: { cargoFuncaoId: true, id: true, nomeCompleto: true } },
} as const;

const positionScopeInclude = {
  quadroNecessidade: { include: { periodo: true, unidade: true } },
} as const;

const exchangeProfessionalInclude = {
  afastamentos: { select: { id: true }, where: { dataFim: null } },
  exercicios: { select: { id: true }, where: { dataFim: null } },
  lotacoesSede: {
    include: {
      postoTrabalho: {
        include: {
          ...positionScopeInclude,
          exercicios: { select: { id: true, profissionalId: true }, where: { dataFim: null } },
          lotacoesSede: { select: { profissionalId: true }, where: { dataFim: null } },
        },
      },
    },
    where: { dataFim: null },
  },
} as const;

const exchangeMovementInclude = {
  itens: {
    include: {
      postoDestino: { include: positionScopeInclude },
      postoOrigem: { include: positionScopeInclude },
      profissional: { select: { nomeCompleto: true } },
    },
    orderBy: { profissionalId: 'asc' as const },
  },
} as const;

type ParticipantPayload = Prisma.EventoParticipanteGetPayload<{
  include: typeof participantInclude;
}>;
type ExchangeProfessionalPayload = Prisma.ProfissionalGetPayload<{
  include: typeof exchangeProfessionalInclude;
}>;
type ExchangeMovementPayload = Prisma.MovimentacaoGetPayload<{
  include: typeof exchangeMovementInclude;
}>;

interface ExchangePair {
  first: ExchangeProfessionalPayload;
  firstParticipant: ParticipantPayload;
  firstSeat: ExchangeProfessionalPayload['lotacoesSede'][number];
  second: ExchangeProfessionalPayload;
  secondParticipant: ParticipantPayload;
  secondSeat: ExchangeProfessionalPayload['lotacoesSede'][number];
  simulation: EventExchangeSimulation;
}

export interface EventExchangeServices {
  central(id: string): Promise<EventExchangeCentralRecord>;
  confirm(
    id: string,
    userId: string,
    input: EventExchangeConfirmationInput,
  ): Promise<EventExchangeResult>;
  simulate(id: string, secondParticipantId: string): Promise<EventExchangeSimulation>;
}

function civilDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function lookup(value: { ativo: boolean; id: string; nome: string }) {
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
    periodo: lookup(position.quadroNecessidade.periodo),
    periodoId: position.periodoId,
    postoId: position.id,
    unidade: lookup(position.quadroNecessidade.unidade),
    unidadeId: position.unidadeId,
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
    throw new HttpError(409, 'EVENT_QUEUE_INVALID', 'A fila congelada está inconsistente.');
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

function mapMovement(movement: ExchangeMovementPayload): EventExchangeMovement {
  if (movement.itens.length !== 2) {
    throw new HttpError(409, 'EXCHANGE_MOVEMENT_INVALID', 'A permuta deve possuir dois itens.');
  }
  return {
    dataHora: movement.dataHora.toISOString(),
    id: movement.id,
    itens: movement.itens.map((item) => {
      if (!item.postoOrigem) {
        throw new HttpError(409, 'EXCHANGE_MOVEMENT_INVALID', 'A permuta exige origem bilateral.');
      }
      return {
        destino: mapLink(item.postoDestino),
        origem: mapLink(item.postoOrigem),
        profissional: item.profissional.nomeCompleto,
        profissionalId: item.profissionalId,
      };
    }),
  };
}

function assertExchangeEvent(event: EventPayload): void {
  if (event.tipo !== 'PERMUTA') {
    throw new HttpError(
      409,
      'EVENT_TYPE_NOT_SUPPORTED_FOR_EXCHANGE',
      'Este fluxo opera somente eventos de Permuta.',
    );
  }
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

function databaseError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P2002', 'P2004', 'P2034'].includes(error.code)) {
      throw new HttpError(
        409,
        'EXCHANGE_CONFLICT',
        'Os vínculos mudaram durante a permuta. Atualize a página e tente novamente.',
      );
    }
    if (error.code === 'P2010' && JSON.stringify(error.meta).includes('40001')) {
      throw new HttpError(409, 'EXCHANGE_CONFLICT', 'A permuta sofreu alteração concorrente.');
    }
  }
  throw error;
}

async function lockEvent(transaction: Prisma.TransactionClient, id: string): Promise<void> {
  const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "evento" WHERE "id" = ${id}::uuid FOR UPDATE
  `);
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Evento não encontrado.');
}

async function lockParticipants(
  transaction: Prisma.TransactionClient,
  ids: string[],
): Promise<void> {
  const unique = [...new Set(ids)].sort();
  const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "evento_participante"
    WHERE "id" IN (${Prisma.join(unique.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY "id" FOR UPDATE
  `);
  if (rows.length !== unique.length) {
    throw new HttpError(409, 'EXCHANGE_PARTICIPANT_INVALID', 'Participante da permuta inválido.');
  }
}

async function loadEvent(transaction: Prisma.TransactionClient, id: string): Promise<EventPayload> {
  const event = await transaction.evento.findUnique({ include: eventInclude, where: { id } });
  if (!event) throw new HttpError(404, 'NOT_FOUND', 'Evento não encontrado.');
  return event;
}

async function loadQueue(transaction: Prisma.TransactionClient, eventId: string) {
  return transaction.eventoParticipante.findMany({
    include: participantInclude,
    orderBy: { posicao: 'asc' },
    where: {
      eventoId: eventId,
      posicao: { not: null },
      status: { in: ['AGUARDANDO', 'ATENDIDO'] },
    },
  });
}

async function loadProfessionals(
  transaction: Prisma.TransactionClient,
  ids: string[],
): Promise<ExchangeProfessionalPayload[]> {
  return transaction.profissional.findMany({
    include: exchangeProfessionalInclude,
    where: { id: { in: ids } },
  });
}

function requireProfessional(
  professionals: ExchangeProfessionalPayload[],
  id: string,
): ExchangeProfessionalPayload {
  const professional = professionals.find((item) => item.id === id);
  if (!professional) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
  return professional;
}

function validateProfessional(
  professional: ExchangeProfessionalPayload,
  event: EventPayload,
): ExchangeProfessionalPayload['lotacoesSede'][number] {
  if (!professional.ativo || professional.cargoFuncaoId !== event.cargoFuncaoId) {
    throw new HttpError(
      409,
      'EXCHANGE_PROFESSIONAL_INCOMPATIBLE',
      'O profissional está inativo ou pertence a outro cargo.',
    );
  }
  if (professional.lotacoesSede.length !== 1) {
    throw new HttpError(409, 'EXCHANGE_SEAT_REQUIRED', 'Ambos precisam possuir sede ativa.');
  }
  if (professional.exercicios.length || professional.afastamentos.length) {
    throw new HttpError(
      409,
      'EXCHANGE_OPERATIONAL_SITUATION_AMBIGUOUS',
      'Exercício ou afastamento ativo impede a permuta automática.',
    );
  }
  const seat = professional.lotacoesSede[0]!;
  const position = seat.postoTrabalho;
  if (
    !position.ativo ||
    position.anoLetivo !== event.ano ||
    position.cargoFuncaoId !== event.cargoFuncaoId
  ) {
    throw new HttpError(
      409,
      'EXCHANGE_SEAT_INCOMPATIBLE',
      'A sede está inativa ou é incompatível com ano/cargo do evento.',
    );
  }
  if (
    position.lotacoesSede.length !== 1 ||
    position.lotacoesSede[0]?.profissionalId !== professional.id
  ) {
    throw new HttpError(409, 'EXCHANGE_OWNERSHIP_CHANGED', 'A titularidade da sede mudou.');
  }
  if (position.exercicios.length) {
    throw new HttpError(
      409,
      'EXCHANGE_SEAT_HAS_TEMPORARY_OCCUPANT',
      'Uma das sedes possui ocupante temporário ativo.',
    );
  }
  return seat;
}

async function analyzePair(
  transaction: Prisma.TransactionClient,
  event: EventPayload,
  firstParticipant: ParticipantPayload,
  secondParticipant: ParticipantPayload,
): Promise<ExchangePair> {
  if (firstParticipant.id === secondParticipant.id) {
    throw new HttpError(409, 'EXCHANGE_SAME_PARTICIPANT', 'Selecione outro participante.');
  }
  if (
    firstParticipant.status !== 'AGUARDANDO' ||
    secondParticipant.status !== 'AGUARDANDO' ||
    firstParticipant.eventoId !== event.id ||
    secondParticipant.eventoId !== event.id
  ) {
    throw new HttpError(
      409,
      'EXCHANGE_PARTICIPANT_INVALID',
      'Os dois participantes devem estar aguardando na fila congelada deste evento.',
    );
  }
  if (firstParticipant.profissionalId === secondParticipant.profissionalId) {
    throw new HttpError(
      409,
      'EXCHANGE_SAME_PROFESSIONAL',
      'O profissional não pode permutar consigo.',
    );
  }
  const professionals = await loadProfessionals(transaction, [
    firstParticipant.profissionalId,
    secondParticipant.profissionalId,
  ]);
  const first = requireProfessional(professionals, firstParticipant.profissionalId);
  const second = requireProfessional(professionals, secondParticipant.profissionalId);
  const firstSeat = validateProfessional(first, event);
  const secondSeat = validateProfessional(second, event);
  if (firstSeat.postoTrabalho.periodoId !== secondSeat.postoTrabalho.periodoId) {
    throw new HttpError(
      409,
      'EXCHANGE_PERIOD_INCOMPATIBLE',
      'As sedes da permuta precisam pertencer ao mesmo período.',
    );
  }
  return {
    first,
    firstParticipant,
    firstSeat,
    second,
    secondParticipant,
    secondSeat,
    simulation: {
      compatibilidade: 'COMPATIVEL',
      consequenciaQuadro:
        'As duas sedes permanecem ocupadas; apenas as titularidades são trocadas.',
      impedimentos: [],
      participanteAtualEsperadoId: firstParticipant.id,
      postoOrigemAtualEsperadoId: firstSeat.postoTrabalhoId,
      postoOrigemSegundoEsperadoId: secondSeat.postoTrabalhoId,
      profissionalA: {
        depois: mapLink(secondSeat.postoTrabalho),
        nome: first.nomeCompleto,
        participanteId: firstParticipant.id,
        profissionalId: first.id,
        sedeAtual: mapLink(firstSeat.postoTrabalho),
      },
      profissionalB: {
        depois: mapLink(firstSeat.postoTrabalho),
        nome: second.nomeCompleto,
        participanteId: secondParticipant.id,
        profissionalId: second.id,
        sedeAtual: mapLink(secondSeat.postoTrabalho),
      },
    },
  };
}

async function buildCentral(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<EventExchangeCentralRecord> {
  const event = await loadEvent(transaction, id);
  assertExchangeEvent(event);
  const queue = await loadQueue(transaction, id);
  const mapped = queue.map((participant) => mapParticipant(participant, event.cargoFuncao.nome));
  const currentPayload = queue.find(({ status }) => status === 'AGUARDANDO') ?? null;
  const waiting = queue.filter(({ status }) => status === 'AGUARDANDO');
  const professionals = await loadProfessionals(
    transaction,
    waiting.map(({ profissionalId }) => profissionalId),
  );
  const exchangeParticipant = (participant: ParticipantPayload): EventExchangeParticipant => {
    const professional = professionals.find(
      ({ id: professionalId }) => professionalId === participant.profissionalId,
    );
    const seat = professional?.lotacoesSede[0]?.postoTrabalho;
    return {
      ...mapParticipant(participant, event.cargoFuncao.nome),
      sedeAtual: seat ? mapLink(seat) : null,
    };
  };
  const recent = await transaction.movimentacao.findMany({
    include: exchangeMovementInclude,
    orderBy: { dataHora: 'desc' },
    take: 5,
    where: { eventoId: id, tipo: 'PERMUTA' },
  });
  return {
    candidatos: waiting
      .filter(({ id: participantId }) => participantId !== currentPayload?.id)
      .map(exchangeParticipant),
    evento: mapEvent(event),
    fila: mapped,
    participanteAtual: currentPayload ? exchangeParticipant(currentPayload) : null,
    proximos: mapped.filter(({ status }) => status === 'AGUARDANDO').slice(1, 6),
    totais: {
      aguardando: waiting.length,
      atendidos: mapped.filter(({ status }) => status === 'ATENDIDO').length,
      total: mapped.length,
    },
    ultimasPermutas: recent.map(mapMovement),
  };
}

export function createPrismaEventExchangeServices(
  database: DatabaseConnection,
  clock: () => Date = () => new Date(),
): EventExchangeServices {
  const { client } = database;
  return {
    async central(id) {
      return client.$transaction((transaction) => buildCentral(transaction, id));
    },
    async confirm(id, userId, input) {
      try {
        const movement = await client.$transaction(async (transaction) => {
          await lockEvent(transaction, id);
          const event = await loadEvent(transaction, id);
          assertExchangeEvent(event);
          await lockParticipants(transaction, [
            input.participanteEsperadoId,
            input.segundoParticipanteId,
          ]);
          const queue = await loadQueue(transaction, id);
          const current = queue.find(({ status }) => status === 'AGUARDANDO');
          const firstParticipant = queue.find(
            ({ id: participantId }) => participantId === input.participanteEsperadoId,
          );
          const secondParticipant = queue.find(
            ({ id: participantId }) => participantId === input.segundoParticipanteId,
          );
          if (!firstParticipant || !secondParticipant || current?.id !== firstParticipant.id) {
            throw new HttpError(
              409,
              'EVENT_PARTICIPANT_ALREADY_HANDLED',
              'A vez ou o par da permuta mudou. Atualize a página.',
            );
          }
          await lockProfessionals(transaction, [
            firstParticipant.profissionalId,
            secondParticipant.profissionalId,
          ]);
          const initialProfessionals = await loadProfessionals(transaction, [
            firstParticipant.profissionalId,
            secondParticipant.profissionalId,
          ]);
          const initialSeats = initialProfessionals.flatMap(({ lotacoesSede }) =>
            lotacoesSede.map(({ postoTrabalhoId }) => postoTrabalhoId),
          );
          await lockPositions(transaction, initialSeats);
          const pair = await analyzePair(transaction, event, firstParticipant, secondParticipant);
          if (
            pair.firstSeat.postoTrabalhoId !== input.postoOrigemAtualEsperadoId ||
            pair.secondSeat.postoTrabalhoId !== input.postoOrigemSegundoEsperadoId
          ) {
            throw new HttpError(
              409,
              'EXCHANGE_OWNERSHIP_CHANGED',
              'Uma das sedes mudou desde a simulação.',
            );
          }
          const now = clock();
          const reason = `Permuta por evento ${event.nome}`;
          await transaction.lotacaoSede.updateMany({
            data: { dataFim: now, motivoFim: reason },
            where: { id: { in: [pair.firstSeat.id, pair.secondSeat.id] }, dataFim: null },
          });
          await transaction.lotacaoSede.createMany({
            data: [
              {
                dataInicio: now,
                postoTrabalhoId: pair.secondSeat.postoTrabalhoId,
                profissionalId: pair.first.id,
              },
              {
                dataInicio: now,
                postoTrabalhoId: pair.firstSeat.postoTrabalhoId,
                profissionalId: pair.second.id,
              },
            ],
          });
          const created = await transaction.movimentacao.create({
            data: {
              dataHora: now,
              eventoId: event.id,
              itens: {
                create: [
                  {
                    postoDestinoId: pair.secondSeat.postoTrabalhoId,
                    postoOrigemId: pair.firstSeat.postoTrabalhoId,
                    profissionalId: pair.first.id,
                    tipoDestino: 'SEDE',
                  },
                  {
                    postoDestinoId: pair.firstSeat.postoTrabalhoId,
                    postoOrigemId: pair.secondSeat.postoTrabalhoId,
                    profissionalId: pair.second.id,
                    tipoDestino: 'SEDE',
                  },
                ],
              },
              tipo: 'PERMUTA',
              usuarioId: userId,
            },
            include: exchangeMovementInclude,
          });
          const updated = await transaction.eventoParticipante.updateMany({
            data: { status: 'ATENDIDO' },
            where: {
              eventoId: id,
              id: { in: [firstParticipant.id, secondParticipant.id] },
              status: 'AGUARDANDO',
            },
          });
          if (updated.count !== 2) {
            throw new HttpError(
              409,
              'EXCHANGE_PARTICIPANT_INVALID',
              'A fila mudou durante a permuta.',
            );
          }
          return mapMovement(created);
        });
        return {
          central: await client.$transaction((transaction) => buildCentral(transaction, id)),
          movimentacao: movement,
        };
      } catch (error) {
        databaseError(error);
      }
    },
    async simulate(id, secondParticipantId) {
      return client.$transaction(async (transaction) => {
        const event = await loadEvent(transaction, id);
        assertExchangeEvent(event);
        const queue = await loadQueue(transaction, id);
        const current = queue.find(({ status }) => status === 'AGUARDANDO');
        const second = queue.find(({ id: participantId }) => participantId === secondParticipantId);
        if (!current) {
          throw new HttpError(
            409,
            'EVENT_WITHOUT_CURRENT_PARTICIPANT',
            'Não há participante atual.',
          );
        }
        if (!second) {
          throw new HttpError(
            409,
            'EXCHANGE_PARTICIPANT_INVALID',
            'O segundo participante não pertence à fila congelada válida.',
          );
        }
        return (await analyzePair(transaction, event, current, second)).simulation;
      });
    },
  };
}
