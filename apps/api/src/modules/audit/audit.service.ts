import type { AuditRecord, PaginatedResponse } from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import type { AuditQuery } from './audit.schemas.js';

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

/** Normal administrative CRUD by ADMINISTRADOR is intentionally not audit history. */
export async function writeCrudAudit(
  transaction: Prisma.TransactionClient,
  input: Parameters<typeof writeAudit>[1],
): Promise<void> {
  const actor = await transaction.usuario.findUnique({
    select: { perfil: true },
    where: { id: input.usuarioId },
  });
  if (actor?.perfil === 'ADMINISTRADOR') return;
  await writeAudit(transaction, input);
}

export interface AuditServices {
  history: {
    list(query: AuditQuery): Promise<PaginatedResponse<AuditRecord>>;
  };
}

type AuditPayload = Prisma.AuditoriaGetPayload<{
  include: { usuario: { select: { id: true; login: true; nome: true } } };
}>;

function mapAudit(value: AuditPayload): AuditRecord {
  return { ...value, dataHora: value.dataHora.toISOString() } as AuditRecord;
}

export function createPrismaAuditServices(database: DatabaseConnection): AuditServices {
  const { client } = database;

  return {
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
