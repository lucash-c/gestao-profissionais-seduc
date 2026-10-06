import type {
  EventPreparationRecord,
  EventQueuePreviewItem,
  EventRecord,
  EventTieGroup,
  EventType,
  PaginatedResponse,
} from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import { HttpError } from '../../http/http-error.js';
import type { EventCreateInput, EventQuery, EventUpdateInput } from './event.schemas.js';

export interface RankingCandidate {
  dataEntrada: Date | string;
  dataNascimento: Date | string;
  matricula?: string;
  nome: string;
  numeroFilhos: number;
  pontuacao: Prisma.Decimal | number | string | null;
  profissionalId: string;
}

export interface RankedCandidate extends RankingCandidate {
  empatePendente: boolean;
  posicao: number | null;
}

export interface EventServices {
  create(input: EventCreateInput): Promise<EventRecord>;
  get(id: string): Promise<EventRecord>;
  list(query: EventQuery): Promise<PaginatedResponse<EventRecord>>;
  preparation(id: string): Promise<EventPreparationRecord>;
  savePreparation(id: string, profissionalIds: string[]): Promise<EventPreparationRecord>;
  start(id: string, userId: string): Promise<EventPreparationRecord>;
  update(id: string, input: EventUpdateInput): Promise<EventRecord>;
}

const eventInclude = {
  cargoFuncao: { select: { ativo: true, id: true, nome: true, usaPontuacao: true } },
} as const;

type EventPayload = Prisma.EventoGetPayload<{ include: typeof eventInclude }>;

const participantInclude = {
  profissional: {
    include: {
      cargoFuncao: { select: { nome: true, usaPontuacao: true } },
      lotacoesSede: { select: { id: true }, take: 1, where: { dataFim: null } },
    },
  },
} as const;

type ParticipantPayload = Prisma.EventoParticipanteGetPayload<{
  include: typeof participantInclude;
}>;

function civilDate(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function compareScore(left: RankingCandidate, right: RankingCandidate): number {
  return new Prisma.Decimal(right.pontuacao ?? 0).comparedTo(
    new Prisma.Decimal(left.pontuacao ?? 0),
  );
}

function compareOfficial(
  left: RankingCandidate,
  right: RankingCandidate,
  usaPontuacao: boolean,
): number {
  if (usaPontuacao) {
    const score = compareScore(left, right);
    if (score !== 0) return score;
  }
  const admission = civilDate(left.dataEntrada).localeCompare(civilDate(right.dataEntrada));
  if (admission !== 0) return admission;
  const birth = civilDate(left.dataNascimento).localeCompare(civilDate(right.dataNascimento));
  if (birth !== 0) return birth;
  return right.numeroFilhos - left.numeroFilhos;
}

export function rankCandidates(
  candidates: readonly RankingCandidate[],
  usaPontuacao: boolean,
): { gruposEmpate: EventTieGroup[]; ranked: RankedCandidate[] } {
  const sorted = [...candidates].sort((left, right) => compareOfficial(left, right, usaPontuacao));
  const groups: RankingCandidate[][] = [];
  for (const candidate of sorted) {
    const previous = groups.at(-1);
    if (previous && compareOfficial(previous[0]!, candidate, usaPontuacao) === 0) {
      previous.push(candidate);
    } else {
      groups.push([candidate]);
    }
  }

  let offset = 0;
  const ranked: RankedCandidate[] = [];
  const gruposEmpate: EventTieGroup[] = [];
  for (const group of groups) {
    const tied = group.length > 1;
    if (tied) {
      gruposEmpate.push({ profissionalIds: group.map(({ profissionalId }) => profissionalId) });
    }
    ranked.push(
      ...group.map((candidate) => ({
        ...candidate,
        empatePendente: tied,
        posicao: tied ? null : offset + 1,
      })),
    );
    offset += group.length;
  }
  return { gruposEmpate, ranked };
}

function mapEvent(event: EventPayload): EventRecord {
  return {
    ano: event.ano,
    cargoFuncao: event.cargoFuncao,
    cargoFuncaoId: event.cargoFuncaoId,
    dataFim: event.dataFim?.toISOString() ?? null,
    dataInicio: event.dataInicio?.toISOString() ?? null,
    id: event.id,
    iniciadoPorUsuarioId: event.iniciadoPorUsuarioId,
    nome: event.nome,
    status: event.status,
    tipo: event.tipo,
  };
}

function eligibility(
  tipo: EventType,
  professional: { permuta: boolean; remocao: boolean },
): {
  elegivel: boolean;
  motivo: string | null;
} {
  if (tipo === 'REMOCAO' && !professional.remocao) {
    return { elegivel: false, motivo: 'Profissional não habilitado para Remoção.' };
  }
  if (tipo === 'PERMUTA' && !professional.permuta) {
    return { elegivel: false, motivo: 'Profissional não habilitado para Permuta.' };
  }
  return { elegivel: true, motivo: null };
}

function participantCandidate(
  participant: ParticipantPayload,
  snapshots: boolean,
): RankingCandidate {
  const professional = participant.profissional;
  return {
    dataEntrada:
      snapshots && participant.dataEntradaSnapshot
        ? participant.dataEntradaSnapshot
        : professional.dataEntradaPrefeitura,
    dataNascimento:
      snapshots && participant.dataNascimentoSnapshot
        ? participant.dataNascimentoSnapshot
        : professional.dataNascimento,
    nome: professional.nomeCompleto,
    numeroFilhos:
      snapshots && participant.numeroFilhosSnapshot !== null
        ? participant.numeroFilhosSnapshot
        : professional.numeroFilhos,
    pontuacao:
      snapshots && participant.pontuacaoSnapshot !== null
        ? participant.pontuacaoSnapshot
        : professional.pontuacao,
    profissionalId: professional.id,
  };
}

function previewItem(candidate: RankedCandidate, usaPontuacao: boolean): EventQueuePreviewItem {
  return {
    dataEntrada: civilDate(candidate.dataEntrada),
    dataNascimento: civilDate(candidate.dataNascimento),
    empatePendente: candidate.empatePendente,
    nome: candidate.nome,
    numeroFilhos: candidate.numeroFilhos,
    posicao: candidate.posicao,
    profissionalId: candidate.profissionalId,
    pontuacao: usaPontuacao ? new Prisma.Decimal(candidate.pontuacao ?? 0).toFixed(2) : null,
  };
}

function handleDatabaseError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2003' || error.code === 'P2025') {
      throw new HttpError(404, 'NOT_FOUND', 'Registro relacionado não encontrado.');
    }
    if (error.code === 'P2004') {
      throw new HttpError(409, 'EVENT_CONFLICT', 'A operação viola o estado atual do evento.');
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

async function assertActiveCargo(
  client: Pick<Prisma.TransactionClient, 'cargoFuncao'>,
  cargoFuncaoId: string,
): Promise<void> {
  const cargo = await client.cargoFuncao.findUnique({
    select: { ativo: true },
    where: { id: cargoFuncaoId },
  });
  if (!cargo?.ativo) {
    throw new HttpError(409, 'INVALID_EVENT_CARGO', 'Selecione um cargo/função ativo.');
  }
}

export function createPrismaEventServices(
  database: DatabaseConnection,
  clock: () => Date = () => new Date(),
): EventServices {
  const { client } = database;

  async function getEvent(id: string): Promise<EventRecord> {
    const event = await client.evento.findUnique({ include: eventInclude, where: { id } });
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Evento não encontrado.');
    return mapEvent(event);
  }

  async function preparation(id: string): Promise<EventPreparationRecord> {
    const event = await client.evento.findUnique({ include: eventInclude, where: { id } });
    if (!event) throw new HttpError(404, 'NOT_FOUND', 'Evento não encontrado.');

    const [professionals, participants] = await client.$transaction([
      client.profissional.findMany({
        include: {
          cargoFuncao: { select: { nome: true, usaPontuacao: true } },
          lotacoesSede: { select: { id: true }, take: 1, where: { dataFim: null } },
        },
        orderBy: { nomeCompleto: 'asc' },
        where: { ativo: true, cargoFuncaoId: event.cargoFuncaoId },
      }),
      client.eventoParticipante.findMany({
        include: participantInclude,
        where: { eventoId: id },
      }),
    ]);
    const selectedIds = new Set(participants.map(({ profissionalId }) => profissionalId));
    const useSnapshots = event.status !== 'RASCUNHO';
    const ranking = useSnapshots
      ? {
          gruposEmpate: [] as EventTieGroup[],
          ranked: participants
            .map((participant) => ({
              ...participantCandidate(participant, true),
              empatePendente: false,
              posicao: participant.posicao,
            }))
            .sort((left, right) => (left.posicao ?? 0) - (right.posicao ?? 0)),
        }
      : rankCandidates(
          participants.map((participant) => participantCandidate(participant, false)),
          event.cargoFuncao.usaPontuacao,
        );
    const rankById = new Map(
      ranking.ranked.map((candidate) => [candidate.profissionalId, candidate] as const),
    );

    const visibleProfessionals = professionals.map((professional) => {
      const eligible = eligibility(event.tipo, professional);
      const ranked = rankById.get(professional.id);
      return {
        cargo: professional.cargoFuncao.nome,
        dataEntradaPrefeitura: civilDate(professional.dataEntradaPrefeitura),
        dataNascimento: civilDate(professional.dataNascimento),
        elegivel: eligible.elegivel,
        empatePendente: ranked?.empatePendente ?? false,
        matricula: professional.matricula,
        motivoInelegibilidade: eligible.motivo,
        nome: professional.nomeCompleto,
        numeroFilhos: professional.numeroFilhos,
        ordemPrevia: ranked?.posicao ?? null,
        permuta: professional.permuta,
        pontuacao: event.cargoFuncao.usaPontuacao ? professional.pontuacao.toFixed(2) : null,
        possuiSedeAtual: professional.lotacoesSede.length > 0,
        profissionalId: professional.id,
        remocao: professional.remocao,
        selecionado: selectedIds.has(professional.id),
      };
    });

    return {
      evento: mapEvent(event),
      gruposEmpate: ranking.gruposEmpate,
      preview: ranking.ranked.map((candidate) =>
        previewItem(candidate, event.cargoFuncao.usaPontuacao),
      ),
      profissionais: visibleProfessionals,
      selecionados: [...selectedIds],
      totais: {
        cargo: visibleProfessionals.length,
        elegiveis: visibleProfessionals.filter(({ elegivel }) => elegivel).length,
        empatesPendentes: ranking.gruposEmpate.length,
        selecionados: participants.length,
      },
    };
  }

  return {
    async create(input) {
      try {
        await assertActiveCargo(client, input.cargoFuncaoId);
        const event = await client.evento.create({ data: input, include: eventInclude });
        return mapEvent(event);
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    get: getEvent,
    async list(query) {
      const where: Prisma.EventoWhereInput = {
        ...(query.ano ? { ano: query.ano } : {}),
        ...(query.cargoFuncaoId ? { cargoFuncaoId: query.cargoFuncaoId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.tipo ? { tipo: query.tipo } : {}),
      };
      const [events, total] = await client.$transaction([
        client.evento.findMany({
          include: eventInclude,
          orderBy: [{ ano: 'desc' }, { criadoEm: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          where,
        }),
        client.evento.count({ where }),
      ]);
      return {
        items: events.map(mapEvent),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      };
    },
    preparation,
    async savePreparation(id, profissionalIds) {
      const uniqueIds = [...new Set(profissionalIds)];
      if (uniqueIds.length !== profissionalIds.length) {
        throw new HttpError(
          409,
          'DUPLICATE_EVENT_PARTICIPANT',
          'A seleção possui profissional repetido.',
        );
      }
      try {
        await client.$transaction(async (transaction) => {
          await lockEvent(transaction, id);
          const event = await transaction.evento.findUniqueOrThrow({ where: { id } });
          if (event.status !== 'RASCUNHO') {
            throw new HttpError(
              409,
              'EVENT_NOT_DRAFT',
              'A preparação só pode ser alterada em RASCUNHO.',
            );
          }
          const professionals = await transaction.profissional.findMany({
            select: { ativo: true, cargoFuncaoId: true, id: true, permuta: true, remocao: true },
            where: { id: { in: uniqueIds } },
          });
          if (
            professionals.length !== uniqueIds.length ||
            professionals.some(
              (professional) =>
                !professional.ativo || professional.cargoFuncaoId !== event.cargoFuncaoId,
            )
          ) {
            throw new HttpError(
              409,
              'INVALID_EVENT_SELECTION',
              'A seleção contém profissional inexistente, inativo ou de outro cargo.',
            );
          }
          if (
            professionals.some((professional) => !eligibility(event.tipo, professional).elegivel)
          ) {
            throw new HttpError(
              409,
              'INELIGIBLE_EVENT_PARTICIPANT',
              'A seleção contém profissional inelegível para o evento.',
            );
          }
          await transaction.eventoParticipante.deleteMany({ where: { eventoId: id } });
          if (uniqueIds.length > 0) {
            await transaction.eventoParticipante.createMany({
              data: uniqueIds.map((profissionalId) => ({ eventoId: id, profissionalId })),
            });
          }
        });
        return preparation(id);
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    async start(id, userId) {
      try {
        await client.$transaction(async (transaction) => {
          await lockEvent(transaction, id);
          const event = await transaction.evento.findUnique({
            include: {
              cargoFuncao: { select: { usaPontuacao: true } },
              participantes: { include: participantInclude },
            },
            where: { id },
          });
          if (!event) throw new HttpError(404, 'NOT_FOUND', 'Evento não encontrado.');
          if (event.status !== 'RASCUNHO') {
            throw new HttpError(409, 'EVENT_NOT_DRAFT', 'O evento já foi iniciado ou encerrado.');
          }
          if (event.participantes.length === 0) {
            throw new HttpError(
              409,
              'EVENT_WITHOUT_PARTICIPANTS',
              'Selecione ao menos um participante antes de iniciar.',
            );
          }
          const invalid = event.participantes.find(
            ({ profissional }) =>
              !profissional.ativo ||
              profissional.cargoFuncaoId !== event.cargoFuncaoId ||
              !eligibility(event.tipo, profissional).elegivel,
          );
          if (invalid) {
            throw new HttpError(
              409,
              'EVENT_PREPARATION_REVIEW_REQUIRED',
              'A preparação possui participante que perdeu a elegibilidade.',
            );
          }
          const ranking = rankCandidates(
            event.participantes.map((participant) => participantCandidate(participant, false)),
            event.cargoFuncao.usaPontuacao,
          );
          if (ranking.gruposEmpate.length > 0) {
            const names = ranking.gruposEmpate
              .map((group) =>
                group.profissionalIds
                  .map(
                    (professionalId) =>
                      event.participantes.find(
                        ({ profissionalId: candidateId }) => candidateId === professionalId,
                      )?.profissional.nomeCompleto,
                  )
                  .join(', '),
              )
              .join(' | ');
            throw new HttpError(
              409,
              'EVENT_HAS_PENDING_TIES',
              `Existem empates pendentes: ${names}.`,
            );
          }

          const participantByProfessional = new Map(
            event.participantes.map((participant) => [participant.profissionalId, participant]),
          );
          for (const ranked of ranking.ranked) {
            const participant = participantByProfessional.get(ranked.profissionalId)!;
            await transaction.eventoParticipante.update({
              data: {
                dataEntradaSnapshot: participant.profissional.dataEntradaPrefeitura,
                dataNascimentoSnapshot: participant.profissional.dataNascimento,
                numeroFilhosSnapshot: participant.profissional.numeroFilhos,
                pontuacaoSnapshot: event.cargoFuncao.usaPontuacao
                  ? participant.profissional.pontuacao
                  : null,
                posicao: ranked.posicao,
                status: 'AGUARDANDO',
              },
              where: { id: participant.id },
            });
          }
          await transaction.evento.update({
            data: { dataInicio: clock(), iniciadoPorUsuarioId: userId, status: 'ATIVO' },
            where: { id },
          });
        });
        return preparation(id);
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    async update(id, input) {
      try {
        return await client.$transaction(async (transaction) => {
          await lockEvent(transaction, id);
          const current = await transaction.evento.findUniqueOrThrow({
            include: { _count: { select: { participantes: true } } },
            where: { id },
          });
          if (current.status !== 'RASCUNHO') {
            throw new HttpError(
              409,
              'EVENT_NOT_DRAFT',
              'Somente eventos em RASCUNHO podem ser editados.',
            );
          }
          const structuralChange =
            (input.tipo !== undefined && input.tipo !== current.tipo) ||
            (input.cargoFuncaoId !== undefined && input.cargoFuncaoId !== current.cargoFuncaoId);
          if (structuralChange && current._count.participantes > 0) {
            throw new HttpError(
              409,
              'EVENT_PREPARATION_MUST_BE_CLEARED',
              'Limpe a preparação antes de alterar tipo ou cargo do evento.',
            );
          }
          if (input.cargoFuncaoId) await assertActiveCargo(transaction, input.cargoFuncaoId);
          const updated = await transaction.evento.update({
            data: {
              ...(input.ano === undefined ? {} : { ano: input.ano }),
              ...(input.cargoFuncaoId === undefined ? {} : { cargoFuncaoId: input.cargoFuncaoId }),
              ...(input.nome === undefined ? {} : { nome: input.nome }),
              ...(input.tipo === undefined ? {} : { tipo: input.tipo }),
            },
            include: eventInclude,
            where: { id },
          });
          return mapEvent(updated);
        });
      } catch (error) {
        handleDatabaseError(error);
      }
    },
  };
}
