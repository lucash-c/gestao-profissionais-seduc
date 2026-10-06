import type { PaginatedResponse, StaffingPlanRecord, WorkPositionRecord } from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import { HttpError } from '../../http/http-error.js';
import { mapWorkPosition, positionAvailabilityInclude } from '../assignments/assignment.service.js';
import type {
  StaffingPlanCreateInput,
  StaffingPlanQuery,
  StaffingPlanUpdateInput,
  WorkPositionQuery,
} from './staffing.schemas.js';

export interface StaffingServices {
  staffingPlans: {
    create(input: StaffingPlanCreateInput): Promise<StaffingPlanRecord>;
    get(id: string): Promise<StaffingPlanRecord>;
    list(query: StaffingPlanQuery): Promise<PaginatedResponse<StaffingPlanRecord>>;
    update(id: string, input: StaffingPlanUpdateInput): Promise<StaffingPlanRecord>;
  };
  workPositions: {
    get(id: string): Promise<WorkPositionRecord>;
    list(query: WorkPositionQuery): Promise<PaginatedResponse<WorkPositionRecord>>;
    updateStatus(id: string, ativo: boolean): Promise<WorkPositionRecord>;
  };
}

const planInclude = {
  _count: { select: { postos: { where: { ativo: true } } } },
  cargoFuncao: { select: { ativo: true, id: true, nome: true } },
  periodo: { select: { ativo: true, id: true, nome: true } },
  segmentoEnsino: { select: { ativo: true, id: true, nome: true } },
  unidade: { select: { ativo: true, id: true, nome: true, tipoUnidadeId: true } },
} as const;

type PlanPayload = Prisma.QuadroNecessidadeGetPayload<{ include: typeof planInclude }>;

function mapPlan(plan: PlanPayload): StaffingPlanRecord {
  return {
    anoLetivo: plan.anoLetivo,
    cargoFuncao: plan.cargoFuncao,
    cargoFuncaoId: plan.cargoFuncaoId,
    id: plan.id,
    observacoes: plan.observacoes,
    periodo: plan.periodo,
    periodoId: plan.periodoId,
    quantidade: plan.quantidade,
    quantidadePostosAtivos: plan._count.postos,
    segmentoEnsino: plan.segmentoEnsino,
    segmentoEnsinoId: plan.segmentoEnsinoId,
    unidade: plan.unidade,
    unidadeId: plan.unidadeId,
  };
}

function pagination<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResponse<T> {
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function handleDatabaseError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'STAFFING_SCOPE_CONFLICT', 'Já existe um quadro com este escopo.');
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      throw new HttpError(404, 'NOT_FOUND', 'Registro relacionado não encontrado.');
    }
    if (error.code === 'P2004') {
      throw new HttpError(409, 'BUSINESS_RULE_CONFLICT', 'A alteração viola uma regra de quadro.');
    }
  }
  throw error;
}

async function lockPlan(transaction: Prisma.TransactionClient, id: string): Promise<void> {
  const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id"
    FROM "quadro_necessidade"
    WHERE "id" = ${id}::uuid
    FOR UPDATE
  `);
  if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Quadro não encontrado.');
}

async function assertCompatible(
  transaction: Prisma.TransactionClient,
  unidadeId: string,
  cargoFuncaoId: string,
): Promise<void> {
  const unit = await transaction.unidade.findUnique({
    select: { tipoUnidadeId: true },
    where: { id: unidadeId },
  });
  if (!unit) throw new HttpError(404, 'NOT_FOUND', 'Unidade não encontrada.');
  const compatible = await transaction.cargoTipoUnidade.findUnique({
    where: {
      cargoFuncaoId_tipoUnidadeId: {
        cargoFuncaoId,
        tipoUnidadeId: unit.tipoUnidadeId,
      },
    },
  });
  if (!compatible) {
    throw new HttpError(
      409,
      'INCOMPATIBLE_UNIT_TYPE',
      'O cargo/função não é compatível com o tipo da unidade.',
    );
  }
}

async function loadPlan(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<StaffingPlanRecord> {
  const plan = await transaction.quadroNecessidade.findUnique({
    include: planInclude,
    where: { id },
  });
  if (!plan) throw new HttpError(404, 'NOT_FOUND', 'Quadro não encontrado.');
  return mapPlan(plan);
}

async function loadPosition(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<WorkPositionRecord> {
  const position = await transaction.postoTrabalho.findUnique({
    include: positionAvailabilityInclude,
    where: { id },
  });
  if (!position) throw new HttpError(404, 'NOT_FOUND', 'Posto não encontrado.');
  return mapWorkPosition(position);
}

export function createPrismaStaffingServices(database: DatabaseConnection): StaffingServices {
  const { client } = database;

  return {
    staffingPlans: {
      async create(input) {
        try {
          return await client.$transaction(async (transaction) => {
            await assertCompatible(transaction, input.unidadeId, input.cargoFuncaoId);
            const plan = await transaction.quadroNecessidade.create({
              data: input,
            });
            if (input.quantidade > 0) {
              await transaction.postoTrabalho.createMany({
                data: Array.from({ length: input.quantidade }, () => ({
                  anoLetivo: input.anoLetivo,
                  cargoFuncaoId: input.cargoFuncaoId,
                  periodoId: input.periodoId,
                  quadroNecessidadeId: plan.id,
                  unidadeId: input.unidadeId,
                })),
              });
            }
            return loadPlan(transaction, plan.id);
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async get(id) {
        const plan = await client.quadroNecessidade.findUnique({
          include: planInclude,
          where: { id },
        });
        if (!plan) throw new HttpError(404, 'NOT_FOUND', 'Quadro não encontrado.');
        return mapPlan(plan);
      },
      async list(query) {
        const where: Prisma.QuadroNecessidadeWhereInput = {
          ...(query.anoLetivo ? { anoLetivo: query.anoLetivo } : {}),
          ...(query.cargoFuncaoId ? { cargoFuncaoId: query.cargoFuncaoId } : {}),
          ...(query.periodoId ? { periodoId: query.periodoId } : {}),
          ...(query.segmentoEnsinoId ? { segmentoEnsinoId: query.segmentoEnsinoId } : {}),
          ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
        };
        const [items, total] = await client.$transaction([
          client.quadroNecessidade.findMany({
            include: planInclude,
            orderBy: [
              { anoLetivo: 'desc' },
              { unidade: { nome: 'asc' } },
              { cargoFuncao: { nome: 'asc' } },
              { periodo: { nome: 'asc' } },
            ],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          client.quadroNecessidade.count({ where }),
        ]);
        return pagination(items.map(mapPlan), query.page, query.pageSize, total);
      },
      async update(id, input) {
        try {
          return await client.$transaction(async (transaction) => {
            await lockPlan(transaction, id);
            const current = await transaction.quadroNecessidade.findUniqueOrThrow({
              include: { _count: { select: { postos: true } } },
              where: { id },
            });
            const structuralChanges = {
              anoLetivo: input.anoLetivo,
              cargoFuncaoId: input.cargoFuncaoId,
              periodoId: input.periodoId,
              segmentoEnsinoId: input.segmentoEnsinoId,
              unidadeId: input.unidadeId,
            };
            const changedStructure = Object.entries(structuralChanges).some(
              ([field, value]) =>
                value !== undefined && value !== current[field as keyof typeof structuralChanges],
            );
            if (changedStructure && current._count.postos > 0) {
              throw new HttpError(
                409,
                'IMMUTABLE_STAFFING_SCOPE',
                'O escopo do quadro não pode ser alterado depois da geração dos postos.',
              );
            }

            const unidadeId = input.unidadeId ?? current.unidadeId;
            const cargoFuncaoId = input.cargoFuncaoId ?? current.cargoFuncaoId;
            if (changedStructure) await assertCompatible(transaction, unidadeId, cargoFuncaoId);

            const targetQuantity = input.quantidade ?? current.quantidade;
            if (input.quantidade !== undefined) {
              const activeCount = await transaction.postoTrabalho.count({
                where: { ativo: true, quadroNecessidadeId: id },
              });
              if (activeCount !== current.quantidade) {
                throw new HttpError(
                  409,
                  'STAFFING_COUNT_INCONSISTENT',
                  'A quantidade do quadro está inconsistente com seus postos ativos.',
                );
              }
              if (targetQuantity > current.quantidade) {
                await transaction.postoTrabalho.createMany({
                  data: Array.from({ length: targetQuantity - current.quantidade }, () => ({
                    anoLetivo: current.anoLetivo,
                    cargoFuncaoId: current.cargoFuncaoId,
                    periodoId: current.periodoId,
                    quadroNecessidadeId: id,
                    unidadeId: current.unidadeId,
                  })),
                });
              } else if (targetQuantity < current.quantidade) {
                const decrease = current.quantidade - targetQuantity;
                const candidates = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
                  SELECT p."id"
                  FROM "posto_trabalho" p
                  WHERE p."quadro_necessidade_id" = ${id}::uuid
                    AND p."ativo" = TRUE
                    AND NOT EXISTS (
                      SELECT 1 FROM "lotacao_sede" ls
                      WHERE ls."posto_trabalho_id" = p."id" AND ls."data_fim" IS NULL
                    )
                    AND NOT EXISTS (
                      SELECT 1 FROM "exercicio_profissional" ep
                      WHERE ep."posto_trabalho_id" = p."id" AND ep."data_fim" IS NULL
                    )
                  ORDER BY
                    CASE WHEN EXISTS (
                      SELECT 1 FROM "lotacao_sede" lhs WHERE lhs."posto_trabalho_id" = p."id"
                    ) OR EXISTS (
                      SELECT 1 FROM "exercicio_profissional" eph WHERE eph."posto_trabalho_id" = p."id"
                    ) THEN 1 ELSE 0 END,
                    p."criado_em" DESC,
                    p."id" ASC
                  LIMIT ${decrease}
                  FOR UPDATE OF p
                `);
                if (candidates.length < decrease) {
                  throw new HttpError(
                    409,
                    'INSUFFICIENT_FREE_POSITIONS',
                    `Não há ${decrease} postos livres para reduzir o quadro.`,
                  );
                }
                await transaction.postoTrabalho.updateMany({
                  data: { ativo: false },
                  where: { id: { in: candidates.map(({ id: positionId }) => positionId) } },
                });
              }
            }

            await transaction.quadroNecessidade.update({
              data: {
                ...(input.anoLetivo === undefined ? {} : { anoLetivo: input.anoLetivo }),
                ...(input.cargoFuncaoId === undefined
                  ? {}
                  : { cargoFuncaoId: input.cargoFuncaoId }),
                ...(input.observacoes === undefined ? {} : { observacoes: input.observacoes }),
                ...(input.periodoId === undefined ? {} : { periodoId: input.periodoId }),
                ...(input.quantidade === undefined ? {} : { quantidade: targetQuantity }),
                ...(input.segmentoEnsinoId === undefined
                  ? {}
                  : { segmentoEnsinoId: input.segmentoEnsinoId }),
                ...(input.unidadeId === undefined ? {} : { unidadeId: input.unidadeId }),
              },
              where: { id },
            });
            return loadPlan(transaction, id);
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
    },
    workPositions: {
      async get(id) {
        const position = await client.postoTrabalho.findUnique({
          include: positionAvailabilityInclude,
          where: { id },
        });
        if (!position) throw new HttpError(404, 'NOT_FOUND', 'Posto não encontrado.');
        return mapWorkPosition(position);
      },
      async list(query) {
        const where: Prisma.PostoTrabalhoWhereInput = {
          ...(query.anoLetivo ? { anoLetivo: query.anoLetivo } : {}),
          ...(query.ativo === undefined ? {} : { ativo: query.ativo }),
          ...(query.cargoFuncaoId ? { cargoFuncaoId: query.cargoFuncaoId } : {}),
          ...(query.periodoId ? { periodoId: query.periodoId } : {}),
          ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
        };
        const [items, total] = await client.$transaction([
          client.postoTrabalho.findMany({
            include: positionAvailabilityInclude,
            orderBy: [
              { anoLetivo: 'desc' },
              { quadroNecessidade: { unidade: { nome: 'asc' } } },
              { criadoEm: 'asc' },
            ],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          client.postoTrabalho.count({ where }),
        ]);
        return pagination(items.map(mapWorkPosition), query.page, query.pageSize, total);
      },
      async updateStatus(id, ativo) {
        try {
          return await client.$transaction(async (transaction) => {
            const target = await transaction.postoTrabalho.findUnique({
              select: { quadroNecessidadeId: true },
              where: { id },
            });
            if (!target) throw new HttpError(404, 'NOT_FOUND', 'Posto não encontrado.');
            await lockPlan(transaction, target.quadroNecessidadeId);
            await transaction.$queryRaw(Prisma.sql`
              SELECT "id" FROM "posto_trabalho" WHERE "id" = ${id}::uuid FOR UPDATE
            `);
            const current = await transaction.postoTrabalho.findUniqueOrThrow({
              include: {
                exercicios: { select: { id: true }, where: { dataFim: null } },
                lotacoesSede: { select: { id: true }, where: { dataFim: null } },
                quadroNecessidade: {
                  select: { cargoFuncaoId: true, quantidade: true, unidadeId: true },
                },
              },
              where: { id },
            });
            if (current.ativo === ativo) return loadPosition(transaction, id);

            const activeCount = await transaction.postoTrabalho.count({
              where: { ativo: true, quadroNecessidadeId: current.quadroNecessidadeId },
            });
            if (activeCount !== current.quadroNecessidade.quantidade) {
              throw new HttpError(
                409,
                'STAFFING_COUNT_INCONSISTENT',
                'A quantidade do quadro está inconsistente com seus postos ativos.',
              );
            }
            if (!ativo) {
              if (current.lotacoesSede.length || current.exercicios.length) {
                throw new HttpError(
                  409,
                  'POSITION_OCCUPIED',
                  'O posto não pode ser inativado enquanto possuir sede ou exercício ativo.',
                );
              }
            } else {
              await assertCompatible(
                transaction,
                current.quadroNecessidade.unidadeId,
                current.quadroNecessidade.cargoFuncaoId,
              );
            }

            await transaction.postoTrabalho.update({ data: { ativo }, where: { id } });
            await transaction.quadroNecessidade.update({
              data: { quantidade: { increment: ativo ? 1 : -1 } },
              where: { id: current.quadroNecessidadeId },
            });
            return loadPosition(transaction, id);
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
    },
  };
}
