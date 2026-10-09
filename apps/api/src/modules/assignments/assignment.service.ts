import type {
  AuthenticatedUser,
  ProfessionalAbsenceRecord,
  ProfessionalExerciseHistory,
  ProfessionalPlacementHistory,
  ProfessionalRelationshipsRecord,
  PeriodCode,
  PositionCode,
  WorkPositionProfessional,
  WorkPositionRecord,
  WorkPositionReleaseReason,
} from '@seduc/contracts';
import { periodLookup, positionDefinition, positionLookup } from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import { HttpError } from '../../http/http-error.js';
import { writeAudit } from '../audit/audit.service.js';
import type { AbsenceCreateInput, AbsenceQuery } from './assignment.schemas.js';

const professionalSummary = {
  id: true,
  matricula: true,
  nomeCompleto: true,
} as const;

export const positionAvailabilityInclude = {
  exercicios: {
    include: {
      profissional: {
        include: {
          afastamentos: { select: { id: true }, where: { dataFim: null } },
        },
      },
      substituiProfissional: { select: professionalSummary },
    },
    take: 1,
    where: { dataFim: null },
  },
  lotacoesSede: {
    include: {
      profissional: {
        include: {
          afastamentos: { select: { id: true }, where: { dataFim: null } },
          exercicios: {
            select: { postoTrabalhoId: true },
            where: { dataFim: null },
          },
        },
      },
    },
    take: 1,
    where: { dataFim: null },
  },
  quadroNecessidade: {
    include: {
      unidade: { select: { ativo: true, id: true, nome: true, tipoUnidadeId: true } },
    },
  },
} as const;

export type PositionAvailabilityPayload = Prisma.PostoTrabalhoGetPayload<{
  include: typeof positionAvailabilityInclude;
}>;

const relationshipInclude = {
  afastamentos: { orderBy: { dataInicio: 'desc' as const } },
  exercicios: {
    include: {
      postoTrabalho: { include: { quadroNecessidade: { include: { unidade: true } } } },
      substituiProfissional: { select: professionalSummary },
    },
    orderBy: { dataInicio: 'desc' as const },
  },
  lotacoesSede: {
    include: { postoTrabalho: { include: { quadroNecessidade: { include: { unidade: true } } } } },
    orderBy: { dataInicio: 'desc' as const },
  },
} as const;

type RelationshipPayload = Prisma.ProfissionalGetPayload<{ include: typeof relationshipInclude }>;

export interface AssignmentServices {
  absences: {
    create(
      profissionalId: string,
      input: AbsenceCreateInput,
      user?: AuthenticatedUser,
    ): Promise<ProfessionalAbsenceRecord>;
    end(
      profissionalId: string,
      id: string,
      dataFim?: Date,
      user?: AuthenticatedUser,
    ): Promise<ProfessionalAbsenceRecord>;
    list(profissionalId: string, query: AbsenceQuery): Promise<ProfessionalAbsenceRecord[]>;
  };
  exercises: {
    end(id: string, dataFim?: Date): Promise<ProfessionalExerciseHistory>;
    startTemporary(input: {
      dataInicio?: Date;
      observacoes?: string | null;
      postoTrabalhoId: string;
      profissionalId: string;
    }): Promise<ProfessionalExerciseHistory>;
  };
  placements: {
    assign(input: {
      dataInicio?: Date;
      motivoFimAnterior?: string | null;
      postoTrabalhoId: string;
      profissionalId: string;
    }): Promise<ProfessionalPlacementHistory>;
  };
  professionals: {
    administrativeUnitIds(id: string): Promise<string[]>;
    relationships(id: string): Promise<ProfessionalRelationshipsRecord>;
  };
}

function asIso(value: Date): string {
  return value.toISOString();
}

function mapProfessional(value: {
  id: string;
  matricula: string;
  nomeCompleto: string;
}): WorkPositionProfessional {
  return value;
}

export function mapWorkPosition(position: PositionAvailabilityPayload): WorkPositionRecord {
  const placement = position.lotacoesSede[0];
  const holder = placement?.profissional;
  const storedExercise = position.exercicios[0];
  const exercise =
    storedExercise?.profissional.ativo && storedExercise.profissional.afastamentos.length === 0
      ? storedExercise
      : undefined;
  const motivosLiberacao: WorkPositionReleaseReason[] = [];
  if (holder?.afastamentos.length) motivosLiberacao.push('AFASTAMENTO');
  if (holder?.exercicios.some(({ postoTrabalhoId }) => postoTrabalhoId !== position.id)) {
    motivosLiberacao.push('EXERCICIO_OUTRO_POSTO');
  }

  const holderOccupiesPosition = Boolean(
    holder?.ativo && holder.afastamentos.length === 0 && motivosLiberacao.length === 0,
  );
  const occupant = exercise?.profissional ?? (holderOccupiesPosition ? holder : null);

  const disponibilidade = !position.ativo
    ? 'INATIVO'
    : occupant
      ? 'INDISPONIVEL'
      : !holder
        ? 'DISPONIVEL_COM_SEDE'
        : 'DISPONIVEL_SEM_SEDE';

  return {
    anoLetivo: position.anoLetivo,
    ativo: position.ativo,
    cargoFuncao: positionLookup(position.cargoFuncaoId as PositionCode),
    cargoFuncaoId: position.cargoFuncaoId,
    codigo: position.codigo,
    disponibilidade,
    estadoEstrutural: disponibilidade,
    exercicioAtual: exercise
      ? {
          id: exercise.id,
          profissional: mapProfessional(exercise.profissional),
          substituiProfissional: exercise.substituiProfissional
            ? mapProfessional(exercise.substituiProfissional)
            : null,
          tipo: exercise.tipoExercicio,
        }
      : null,
    id: position.id,
    motivosLiberacao,
    ocupanteAtual: occupant ? mapProfessional(occupant) : null,
    periodo: periodLookup(position.periodoId as PeriodCode),
    periodoId: position.periodoId,
    quadroNecessidadeId: position.quadroNecessidadeId,
    reservadoParaEvento: position.reservadoParaEvento,
    titularAtual: holder ? mapProfessional(holder) : null,
    unidade: position.quadroNecessidade.unidade,
    unidadeId: position.unidadeId,
  };
}

function mapAbsence(absence: {
  dataFim: Date | null;
  dataInicio: Date;
  id: string;
  observacoes: string | null;
  profissionalId: string;
  tipo: string;
}): ProfessionalAbsenceRecord {
  return {
    ativo: absence.dataFim === null,
    dataFim: absence.dataFim ? asIso(absence.dataFim) : null,
    dataInicio: asIso(absence.dataInicio),
    id: absence.id,
    observacoes: absence.observacoes,
    profissionalId: absence.profissionalId,
    tipo: absence.tipo,
  };
}

function mapPlacement(
  placement: RelationshipPayload['lotacoesSede'][number],
): ProfessionalPlacementHistory {
  const unit = placement.postoTrabalho.quadroNecessidade.unidade;
  return {
    dataFim: placement.dataFim ? asIso(placement.dataFim) : null,
    dataInicio: asIso(placement.dataInicio),
    id: placement.id,
    motivoFim: placement.motivoFim,
    postoId: placement.postoTrabalhoId,
    unidadeId: unit.id,
    unidadeNome: unit.nome,
  };
}

function mapExercise(
  exercise: RelationshipPayload['exercicios'][number],
): ProfessionalExerciseHistory {
  const unit = exercise.postoTrabalho.quadroNecessidade.unidade;
  return {
    dataFim: exercise.dataFim ? asIso(exercise.dataFim) : null,
    dataInicio: asIso(exercise.dataInicio),
    id: exercise.id,
    observacoes: exercise.observacoes,
    postoId: exercise.postoTrabalhoId,
    substituiProfissional: exercise.substituiProfissional
      ? mapProfessional(exercise.substituiProfissional)
      : null,
    tipo: exercise.tipoExercicio,
    unidadeId: unit.id,
    unidadeNome: unit.nome,
  };
}

function mapRelationships(professional: RelationshipPayload): ProfessionalRelationshipsRecord {
  const historicoSedes = professional.lotacoesSede.map(mapPlacement);
  const historicoExercicios = professional.exercicios.map(mapExercise);
  const afastamentos = professional.afastamentos.map(mapAbsence);
  return {
    afastamentos,
    afastamentosAtivos: afastamentos.filter(({ ativo }) => ativo),
    exerciciosAtuais: historicoExercicios.filter(({ dataFim }) => dataFim === null),
    historicoExercicios,
    historicoSedes,
    profissionalId: professional.id,
    sedeAtual: historicoSedes.find(({ dataFim }) => dataFim === null) ?? null,
  };
}

function handleDatabaseError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002' || error.code === 'P2004') {
      throw new HttpError(409, 'ASSIGNMENT_CONFLICT', 'O vínculo conflita com o estado atual.');
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      throw new HttpError(404, 'NOT_FOUND', 'Registro relacionado não encontrado.');
    }
  }
  throw error;
}

export async function lockProfessionals(
  transaction: Prisma.TransactionClient,
  ids: string[],
): Promise<void> {
  const uniqueIds = [...new Set(ids)].sort();
  if (!uniqueIds.length) return;
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "profissional"
    WHERE "id" IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY "id" FOR UPDATE
  `);
}

export async function lockPositions(
  transaction: Prisma.TransactionClient,
  ids: string[],
): Promise<void> {
  const uniqueIds = [...new Set(ids)].sort();
  if (!uniqueIds.length) return;
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "posto_trabalho"
    WHERE "id" IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY "id" FOR UPDATE
  `);
}

export async function loadPosition(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<PositionAvailabilityPayload> {
  const position = await transaction.postoTrabalho.findUnique({
    include: positionAvailabilityInclude,
    where: { id },
  });
  if (!position) throw new HttpError(404, 'NOT_FOUND', 'Posto não encontrado.');
  return position;
}

async function loadRelationships(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<ProfessionalRelationshipsRecord> {
  const professional = await transaction.profissional.findUnique({
    include: relationshipInclude,
    where: { id },
  });
  if (!professional) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
  return mapRelationships(professional);
}

async function assertCanReturnToSeat(
  transaction: Prisma.TransactionClient,
  profissionalId: string,
  options: { excludeAbsenceId?: string; excludeExerciseId?: string },
): Promise<void> {
  const placement = await transaction.lotacaoSede.findFirst({
    select: { postoTrabalhoId: true },
    where: { dataFim: null, profissionalId },
  });
  if (!placement) return;

  await lockPositions(transaction, [placement.postoTrabalhoId]);
  const activeOccupant = await transaction.exercicioProfissional.findFirst({
    select: { id: true },
    where: { dataFim: null, postoTrabalhoId: placement.postoTrabalhoId },
  });
  if (!activeOccupant) return;

  const [otherAbsences, otherExternalExercises] = await Promise.all([
    transaction.afastamentoProfissional.count({
      where: {
        dataFim: null,
        ...(options.excludeAbsenceId ? { id: { not: options.excludeAbsenceId } } : {}),
        profissionalId,
      },
    }),
    transaction.exercicioProfissional.count({
      where: {
        dataFim: null,
        ...(options.excludeExerciseId ? { id: { not: options.excludeExerciseId } } : {}),
        postoTrabalhoId: { not: placement.postoTrabalhoId },
        profissionalId,
      },
    }),
  ]);
  if (otherAbsences === 0 && otherExternalExercises === 0) {
    throw new HttpError(
      409,
      'OFFICIAL_SEAT_STILL_OCCUPIED',
      'A sede do profissional ainda está ocupada por substituto ativo.',
    );
  }
}

function assertEndAfterStart(dataFim: Date, dataInicio: Date): void {
  if (dataFim <= dataInicio) {
    throw new HttpError(409, 'INVALID_END_DATE', 'A data final deve ser posterior à inicial.');
  }
}

export function createPrismaAssignmentServices(
  database: DatabaseConnection,
  clock: () => Date = () => new Date(),
): AssignmentServices {
  const { client } = database;

  return {
    absences: {
      async create(profissionalId, input, user) {
        try {
          return await client.$transaction(async (transaction) => {
            await lockProfessionals(transaction, [profissionalId]);
            const dataInicio = input.dataInicio ?? clock();
            const professional = await transaction.profissional.findUnique({
              select: { ativo: true },
              where: { id: profissionalId },
            });
            if (!professional)
              throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
            if (!professional.ativo) {
              throw new HttpError(409, 'INACTIVE_PROFESSIONAL', 'O profissional está inativo.');
            }
            await transaction.$queryRaw(Prisma.sql`
              SELECT "id" FROM "exercicio_profissional"
              WHERE "profissional_id" = ${profissionalId}::uuid AND "data_fim" IS NULL
              ORDER BY "id" FOR UPDATE
            `);
            const activeExercises = await transaction.exercicioProfissional.findMany({
              select: { dataInicio: true, id: true, postoTrabalhoId: true },
              where: { dataFim: null, profissionalId },
            });
            await lockPositions(
              transaction,
              activeExercises.map(({ postoTrabalhoId }) => postoTrabalhoId),
            );
            const temporallyInvalid = activeExercises.find(
              (exercise) => dataInicio <= exercise.dataInicio,
            );
            if (temporallyInvalid) {
              throw new HttpError(
                409,
                'ABSENCE_PRECEDES_ACTIVE_EXERCISE',
                'O início do afastamento deve ser posterior ao início do exercício ativo.',
              );
            }
            if (activeExercises.length > 0) {
              await transaction.exercicioProfissional.updateMany({
                data: { dataFim: dataInicio },
                where: { id: { in: activeExercises.map(({ id }) => id) } },
              });
            }
            const created = mapAbsence(
              await transaction.afastamentoProfissional.create({
                data: {
                  dataInicio,
                  observacoes: input.observacoes,
                  profissionalId,
                  tipo: input.tipo,
                },
              }),
            );
            if (user && user.perfil !== 'ADMINISTRADOR') {
              await writeAudit(transaction, {
                acao: 'CREATE',
                after: created,
                entidade: 'AFASTAMENTO_PROFISSIONAL',
                profissionalId,
                registroId: created.id,
                usuarioId: user.id,
              });
            }
            return created;
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async end(profissionalId, id, requestedEnd, user) {
        try {
          return await client.$transaction(async (transaction) => {
            const initial = await transaction.afastamentoProfissional.findUnique({
              select: { profissionalId: true },
              where: { id },
            });
            if (!initial) throw new HttpError(404, 'NOT_FOUND', 'Afastamento não encontrado.');
            if (initial.profissionalId !== profissionalId) {
              throw new HttpError(404, 'NOT_FOUND', 'Afastamento não encontrado.');
            }
            await lockProfessionals(transaction, [initial.profissionalId]);
            await transaction.$queryRaw(Prisma.sql`
              SELECT "id" FROM "afastamento_profissional" WHERE "id" = ${id}::uuid FOR UPDATE
            `);
            const absence = await transaction.afastamentoProfissional.findUniqueOrThrow({
              where: { id },
            });
            if (absence.dataFim) {
              throw new HttpError(409, 'ABSENCE_ALREADY_ENDED', 'O afastamento já foi encerrado.');
            }
            await assertCanReturnToSeat(transaction, absence.profissionalId, {
              excludeAbsenceId: absence.id,
            });
            const dataFim = requestedEnd ?? clock();
            assertEndAfterStart(dataFim, absence.dataInicio);
            const updated = mapAbsence(
              await transaction.afastamentoProfissional.update({
                data: { dataFim },
                where: { id },
              }),
            );
            if (user && user.perfil !== 'ADMINISTRADOR') {
              await writeAudit(transaction, {
                acao: 'UPDATE',
                after: updated,
                before: mapAbsence(absence),
                entidade: 'AFASTAMENTO_PROFISSIONAL',
                profissionalId,
                registroId: id,
                usuarioId: user.id,
              });
            }
            return updated;
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async list(profissionalId, query) {
        const exists = await client.profissional.findUnique({
          select: { id: true },
          where: { id: profissionalId },
        });
        if (!exists) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
        const absences = await client.afastamentoProfissional.findMany({
          orderBy: { dataInicio: 'desc' },
          where: {
            profissionalId,
            ...(query.ativo === undefined ? {} : { dataFim: query.ativo ? null : { not: null } }),
          },
        });
        return absences.map(mapAbsence);
      },
    },
    exercises: {
      async end(id, requestedEnd) {
        try {
          return await client.$transaction(async (transaction) => {
            const initial = await transaction.exercicioProfissional.findUnique({
              select: { profissionalId: true },
              where: { id },
            });
            if (!initial) throw new HttpError(404, 'NOT_FOUND', 'Exercício não encontrado.');
            await lockProfessionals(transaction, [initial.profissionalId]);
            await transaction.$queryRaw(Prisma.sql`
              SELECT "id" FROM "exercicio_profissional" WHERE "id" = ${id}::uuid FOR UPDATE
            `);
            const exercise = await transaction.exercicioProfissional.findUniqueOrThrow({
              where: { id },
            });
            if (exercise.dataFim) {
              throw new HttpError(409, 'EXERCISE_ALREADY_ENDED', 'O exercício já foi encerrado.');
            }
            await lockPositions(transaction, [exercise.postoTrabalhoId]);
            await assertCanReturnToSeat(transaction, exercise.profissionalId, {
              excludeExerciseId: exercise.id,
            });
            const dataFim = requestedEnd ?? clock();
            assertEndAfterStart(dataFim, exercise.dataInicio);
            await transaction.exercicioProfissional.update({ data: { dataFim }, where: { id } });
            const relationships = await loadRelationships(transaction, exercise.profissionalId);
            return relationships.historicoExercicios.find(({ id: itemId }) => itemId === id)!;
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async startTemporary(input) {
        try {
          return await client.$transaction(async (transaction) => {
            const initialPosition = await transaction.postoTrabalho.findUnique({
              select: {
                lotacoesSede: {
                  select: { profissionalId: true },
                  take: 1,
                  where: { dataFim: null },
                },
              },
              where: { id: input.postoTrabalhoId },
            });
            if (!initialPosition) throw new HttpError(404, 'NOT_FOUND', 'Posto não encontrado.');
            const initialHolderId = initialPosition.lotacoesSede[0]?.profissionalId;
            if (!initialHolderId) {
              throw new HttpError(
                409,
                'POSITION_NOT_AVAILABLE_WITHOUT_SEAT',
                'O posto não possui titular ativo para substituição.',
              );
            }
            await lockProfessionals(transaction, [input.profissionalId, initialHolderId]);
            await lockPositions(transaction, [input.postoTrabalhoId]);

            const [professional, position] = await Promise.all([
              transaction.profissional.findUnique({
                include: {
                  afastamentos: { select: { id: true }, where: { dataFim: null } },
                  lotacoesSede: { select: { id: true }, take: 1, where: { dataFim: null } },
                  _count: { select: { exercicios: { where: { dataFim: null } } } },
                },
                where: { id: input.profissionalId },
              }),
              loadPosition(transaction, input.postoTrabalhoId),
            ]);
            if (!professional)
              throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
            if (!professional.ativo) {
              throw new HttpError(409, 'INACTIVE_PROFESSIONAL', 'O profissional está inativo.');
            }
            if (professional.afastamentos.length > 0) {
              throw new HttpError(
                409,
                'PROFESSIONAL_ON_ACTIVE_ABSENCE',
                'Profissional afastado não pode iniciar exercício temporário.',
              );
            }
            const availability = mapWorkPosition(position);
            if (availability.disponibilidade !== 'DISPONIVEL_SEM_SEDE') {
              throw new HttpError(
                409,
                'POSITION_NOT_AVAILABLE_WITHOUT_SEAT',
                'O posto não está disponível sem sede.',
              );
            }
            const holderId = position.lotacoesSede[0]!.profissionalId;
            if (holderId !== initialHolderId || holderId === input.profissionalId) {
              throw new HttpError(
                409,
                'ASSIGNMENT_CONFLICT',
                'A titularidade do posto foi alterada.',
              );
            }
            if (professional.cargoFuncaoId !== position.cargoFuncaoId) {
              throw new HttpError(
                409,
                'INCOMPATIBLE_POSITION_CARGO',
                'O cargo do profissional é incompatível com o posto.',
              );
            }
            if (
              !positionDefinition(professional.cargoFuncaoId as PositionCode)
                .permiteMultiplosExercicios &&
              professional._count.exercicios > 0
            ) {
              throw new HttpError(
                409,
                'ACTIVE_EXERCISE_LIMIT',
                'O cargo do profissional não permite outro exercício ativo.',
              );
            }

            const exercise = await transaction.exercicioProfissional.create({
              data: {
                dataInicio: input.dataInicio ?? clock(),
                observacoes: input.observacoes ?? null,
                postoTrabalhoId: input.postoTrabalhoId,
                profissionalId: input.profissionalId,
                substituiProfissionalId: holderId,
                tipoExercicio: professional.lotacoesSede.length ? 'SUBSTITUICAO' : 'SEM_SEDE',
              },
            });
            const relationships = await loadRelationships(transaction, input.profissionalId);
            return relationships.historicoExercicios.find(({ id }) => id === exercise.id)!;
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
    },
    placements: {
      async assign(input) {
        try {
          return await client.$transaction(async (transaction) => {
            await lockProfessionals(transaction, [input.profissionalId]);
            const current = await transaction.lotacaoSede.findFirst({
              where: { dataFim: null, profissionalId: input.profissionalId },
            });
            await lockPositions(transaction, [
              input.postoTrabalhoId,
              ...(current ? [current.postoTrabalhoId] : []),
            ]);
            const [professional, position] = await Promise.all([
              transaction.profissional.findUnique({
                select: { ativo: true, cargoFuncaoId: true },
                where: { id: input.profissionalId },
              }),
              loadPosition(transaction, input.postoTrabalhoId),
            ]);
            if (!professional)
              throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
            if (!professional.ativo) {
              throw new HttpError(409, 'INACTIVE_PROFESSIONAL', 'O profissional está inativo.');
            }
            if (current?.postoTrabalhoId === input.postoTrabalhoId) {
              const relationships = await loadRelationships(transaction, input.profissionalId);
              return relationships.sedeAtual!;
            }
            if (mapWorkPosition(position).disponibilidade !== 'DISPONIVEL_COM_SEDE') {
              throw new HttpError(
                409,
                'POSITION_NOT_AVAILABLE_WITH_SEAT',
                'O posto não está disponível com sede.',
              );
            }
            if (professional.cargoFuncaoId !== position.cargoFuncaoId) {
              throw new HttpError(
                409,
                'INCOMPATIBLE_POSITION_CARGO',
                'O cargo do profissional é incompatível com o posto.',
              );
            }
            const dataInicio = input.dataInicio ?? clock();
            if (current) {
              const occupant = await transaction.exercicioProfissional.findFirst({
                select: { id: true },
                where: { dataFim: null, postoTrabalhoId: current.postoTrabalhoId },
              });
              if (occupant) {
                throw new HttpError(
                  409,
                  'PREVIOUS_SEAT_STILL_OCCUPIED',
                  'A sede anterior ainda possui ocupante temporário.',
                );
              }
              assertEndAfterStart(dataInicio, current.dataInicio);
              await transaction.lotacaoSede.update({
                data: { dataFim: dataInicio, motivoFim: input.motivoFimAnterior ?? null },
                where: { id: current.id },
              });
            }
            const placement = await transaction.lotacaoSede.create({
              data: {
                dataInicio,
                postoTrabalhoId: input.postoTrabalhoId,
                profissionalId: input.profissionalId,
              },
            });
            const relationships = await loadRelationships(transaction, input.profissionalId);
            return relationships.historicoSedes.find(({ id }) => id === placement.id)!;
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
    },
    professionals: {
      async administrativeUnitIds(id) {
        const exercises = await client.exercicioProfissional.findMany({
          select: { postoTrabalho: { select: { unidadeId: true } } },
          where: { dataFim: null, profissionalId: id },
        });
        if (exercises.length) {
          return [...new Set(exercises.map(({ postoTrabalho }) => postoTrabalho.unidadeId))];
        }
        const placement = await client.lotacaoSede.findFirst({
          select: { postoTrabalho: { select: { unidadeId: true } } },
          where: { dataFim: null, profissionalId: id },
        });
        return placement ? [placement.postoTrabalho.unidadeId] : [];
      },
      async relationships(id) {
        const professional = await client.profissional.findUnique({
          include: relationshipInclude,
          where: { id },
        });
        if (!professional) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
        return mapRelationships(professional);
      },
    },
  };
}
