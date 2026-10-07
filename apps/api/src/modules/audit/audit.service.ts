import type {
  AdministrativeCorrectionPreview,
  AuditRecord,
  PaginatedResponse,
} from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';
import { createHash } from 'node:crypto';

import { HttpError } from '../../http/http-error.js';
import type { AuditQuery, CorrectionApplyInput, CorrectionInput } from './audit.schemas.js';

const forbiddenKeys =
  /(?:senha|password|token|cookie|secret|credential|credencial|connection|string|hash)/i;

export function safeAuditJson(value: unknown): Prisma.InputJsonValue {
  const visit = (current: unknown): unknown => {
    if (current instanceof Date) return current.toISOString();
    if (Prisma.Decimal.isDecimal(current)) return current.toString();
    if (Array.isArray(current)) return current.map(visit);
    if (current && typeof current === 'object') {
      return Object.fromEntries(
        Object.entries(current)
          .filter(([key]) => !forbiddenKeys.test(key))
          .map(([key, item]) => [key, visit(item)]),
      );
    }
    if (typeof current === 'bigint') return current.toString();
    return current;
  };
  return visit(value) as Prisma.InputJsonValue;
}

export async function writeAudit(
  transaction: Prisma.TransactionClient,
  input: {
    acao: 'CREATE' | 'UPDATE' | 'DELETE';
    after?: unknown;
    before?: unknown;
    entidade: string;
    profissionalId?: string | null;
    registroId: string;
    unidadeId?: string | null;
    usuarioId: string;
  },
): Promise<void> {
  const before = input.before === undefined ? null : safeAuditJson(input.before);
  const after = input.after === undefined ? null : safeAuditJson(input.after);
  if (input.acao === 'UPDATE' && JSON.stringify(before) === JSON.stringify(after)) return;
  await transaction.auditoria.create({
    data: {
      acao: input.acao,
      dadosAnteriores: before === null ? Prisma.JsonNull : before,
      dadosNovos: after === null ? Prisma.JsonNull : after,
      entidade: input.entidade,
      profissionalId: input.profissionalId ?? null,
      registroId: input.registroId,
      unidadeId: input.unidadeId ?? null,
      usuarioId: input.usuarioId,
    },
  });
}

export interface AuditServices {
  corrections: {
    apply(input: CorrectionApplyInput): Promise<AdministrativeCorrectionPreview>;
    preview(input: CorrectionInput): Promise<AdministrativeCorrectionPreview>;
  };
  history: {
    list(query: AuditQuery): Promise<PaginatedResponse<AuditRecord>>;
  };
}

const correctionProfessionalSelect = {
  ativo: true,
  cpf: true,
  dataEntradaPrefeitura: true,
  dataNascimento: true,
  id: true,
  matricula: true,
  nomeCompleto: true,
  numeroFilhos: true,
  permuta: true,
  remocao: true,
} as const;
const correctionUnitSelect = { ativo: true, codigoInep: true, id: true, nome: true } as const;

function correctionValues(value: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      item instanceof Date ? item.toISOString().slice(0, 10) : item,
    ]),
  );
}

function correctionVersion(value: Record<string, unknown>, input: CorrectionInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        entidade: input.entidade,
        registroId: input.registroId,
        valores: input.valores,
        versaoRegistro: value,
      }),
    )
    .digest('hex');
}

function assertCorrectionVersion(
  current: Record<string, unknown>,
  input: CorrectionApplyInput,
): void {
  if (correctionVersion(current, input) !== input.versaoEsperada) {
    throw new HttpError(
      409,
      'CORRECTION_PREVIEW_STALE',
      'O registro ou os valores mudaram desde a prévia. Gere uma nova prévia antes de confirmar.',
    );
  }
}

type AuditPayload = Prisma.AuditoriaGetPayload<{
  include: { usuario: { select: { id: true; login: true; nome: true } } };
}>;

function mapAudit(value: AuditPayload): AuditRecord {
  return { ...value, dataHora: value.dataHora.toISOString() } as AuditRecord;
}

export function createPrismaAuditServices(database: DatabaseConnection): AuditServices {
  const { client } = database;

  async function preview(input: CorrectionInput): Promise<AdministrativeCorrectionPreview> {
    if (input.entidade === 'UNIDADE') {
      const current = await client.unidade.findUnique({
        select: correctionUnitSelect,
        where: { id: input.registroId },
      });
      if (!current) throw new HttpError(404, 'NOT_FOUND', 'Unidade não encontrada.');
      const antes = correctionValues(current);
      return {
        antes,
        depois: { ...antes, ...input.valores },
        entidade: input.entidade,
        registroId: input.registroId,
        versao: correctionVersion(antes, input),
      };
    }
    const current = await client.profissional.findUnique({
      select: correctionProfessionalSelect,
      where: { id: input.registroId },
    });
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
    const antes = correctionValues(current);
    return {
      antes,
      depois: { ...antes, ...input.valores },
      entidade: input.entidade,
      registroId: input.registroId,
      versao: correctionVersion(antes, input),
    };
  }

  return {
    corrections: {
      async apply(input) {
        try {
          return await client.$transaction(async (transaction) => {
            if (input.entidade === 'UNIDADE') {
              await transaction.$queryRaw(
                Prisma.sql`SELECT "id" FROM "unidade" WHERE "id" = ${input.registroId}::uuid FOR UPDATE`,
              );
              const before = await transaction.unidade.findUnique({
                select: correctionUnitSelect,
                where: { id: input.registroId },
              });
              if (!before) throw new HttpError(404, 'NOT_FOUND', 'Unidade não encontrada.');
              const beforeValues = correctionValues(before);
              assertCorrectionVersion(beforeValues, input);
              const after = await transaction.unidade.update({
                data: Object.fromEntries(
                  Object.entries(input.valores).filter(([, value]) => value !== undefined),
                ) as Prisma.UnidadeUncheckedUpdateInput,
                select: correctionUnitSelect,
                where: { id: input.registroId },
              });
              return {
                antes: beforeValues,
                depois: correctionValues(after),
                entidade: input.entidade,
                registroId: input.registroId,
                versao: correctionVersion(correctionValues(after), input),
              };
            }
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "profissional" WHERE "id" = ${input.registroId}::uuid FOR UPDATE`,
            );
            const before = await transaction.profissional.findUnique({
              select: correctionProfessionalSelect,
              where: { id: input.registroId },
            });
            if (!before) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
            const beforeValues = correctionValues(before);
            assertCorrectionVersion(beforeValues, input);
            const data = {
              ...Object.fromEntries(
                Object.entries(input.valores).filter(
                  ([key, value]) =>
                    value !== undefined &&
                    key !== 'dataEntradaPrefeitura' &&
                    key !== 'dataNascimento',
                ),
              ),
              ...(input.valores.dataEntradaPrefeitura
                ? {
                    dataEntradaPrefeitura: new Date(
                      `${input.valores.dataEntradaPrefeitura}T00:00:00.000Z`,
                    ),
                  }
                : {}),
              ...(input.valores.dataNascimento
                ? { dataNascimento: new Date(`${input.valores.dataNascimento}T00:00:00.000Z`) }
                : {}),
            } as Prisma.ProfissionalUncheckedUpdateInput;
            const after = await transaction.profissional.update({
              data,
              select: correctionProfessionalSelect,
              where: { id: input.registroId },
            });
            return {
              antes: beforeValues,
              depois: correctionValues(after),
              entidade: input.entidade,
              registroId: input.registroId,
              versao: correctionVersion(correctionValues(after), input),
            };
          });
        } catch (error) {
          if (error instanceof HttpError) throw error;
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            ['P2002', 'P2003', 'P2004'].includes(error.code)
          ) {
            throw new HttpError(
              409,
              'CORRECTION_CONFLICT',
              'A correção viola uma regra estrutural.',
            );
          }
          throw error;
        }
      },
      preview,
    },
    history: {
      async list(query) {
        const where: Prisma.AuditoriaWhereInput = {
          ...(query.acao ? { acao: query.acao } : {}),
          ...(query.entidade ? { entidade: query.entidade } : {}),
          ...(query.profissionalId ? { profissionalId: query.profissionalId } : {}),
          ...(query.registroId ? { registroId: query.registroId } : {}),
          ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
          ...(query.usuarioId ? { usuarioId: query.usuarioId } : {}),
          ...(query.dataInicio || query.dataFim
            ? {
                dataHora: {
                  ...(query.dataInicio ? { gte: query.dataInicio } : {}),
                  ...(query.dataFim ? { lte: query.dataFim } : {}),
                },
              }
            : {}),
        };
        const [items, total] = await client.$transaction([
          client.auditoria.findMany({
            include: { usuario: { select: { id: true, login: true, nome: true } } },
            orderBy: [{ dataHora: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          client.auditoria.count({ where }),
        ]);
        return {
          items: items.map(mapAudit),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        };
      },
    },
  };
}
