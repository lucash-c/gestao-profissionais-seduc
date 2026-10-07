import type {
  AuthenticatedUser,
  LookupRecord,
  PaginatedResponse,
  ProfessionalRecord,
  UnitRecord,
  UserRecord,
} from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import { HttpError } from '../../http/http-error.js';
import { hashPassword } from '../auth/auth.crypto.js';
import { writeAudit } from '../audit/audit.service.js';
import { assertUserIdentifiersAvailable } from '../users/user-identifier.service.js';
import type {
  PhoneCollectionInput,
  PhoneInput,
  ProfessionalCreateInput,
  ProfessionalQuery,
  ProfessionalUpdateInput,
  UnitCreateInput,
  UnitQuery,
  UnitUpdateInput,
  UserCreateInput,
  UserQuery,
  UserUpdateInput,
} from './registry.schemas.js';

export interface RegistryServices {
  lookups: {
    cargos(): Promise<LookupRecord[]>;
    periodos(): Promise<LookupRecord[]>;
    segmentos(): Promise<LookupRecord[]>;
    tiposUnidade(): Promise<LookupRecord[]>;
    unidades(user: AuthenticatedUser): Promise<LookupRecord[]>;
  };
  professionals: {
    addPhone(id: string, input: PhoneInput, user: AuthenticatedUser): Promise<ProfessionalRecord>;
    create(input: ProfessionalCreateInput, user: AuthenticatedUser): Promise<ProfessionalRecord>;
    deletePhone(id: string, phoneId: string, user: AuthenticatedUser): Promise<void>;
    get(id: string, user: AuthenticatedUser): Promise<ProfessionalRecord>;
    list(
      query: ProfessionalQuery,
      user: AuthenticatedUser,
    ): Promise<PaginatedResponse<ProfessionalRecord>>;
    administrativeUnitIds(id: string): Promise<string[]>;
    update(
      id: string,
      input: ProfessionalUpdateInput,
      user: AuthenticatedUser,
    ): Promise<ProfessionalRecord>;
    updatePhone(
      id: string,
      phoneId: string,
      input: PhoneInput,
      user: AuthenticatedUser,
    ): Promise<ProfessionalRecord>;
    updateScore(id: string, score: number, user: AuthenticatedUser): Promise<ProfessionalRecord>;
  };
  units: {
    addPhone(id: string, input: PhoneInput, user: AuthenticatedUser): Promise<UnitRecord>;
    create(input: UnitCreateInput, user: AuthenticatedUser): Promise<UnitRecord>;
    deletePhone(id: string, phoneId: string, user: AuthenticatedUser): Promise<void>;
    get(id: string, user: AuthenticatedUser): Promise<UnitRecord>;
    list(query: UnitQuery, user: AuthenticatedUser): Promise<PaginatedResponse<UnitRecord>>;
    update(id: string, input: UnitUpdateInput, user: AuthenticatedUser): Promise<UnitRecord>;
    updatePhone(
      id: string,
      phoneId: string,
      input: PhoneInput,
      user: AuthenticatedUser,
    ): Promise<UnitRecord>;
  };
  users: {
    create(input: UserCreateInput, actor: AuthenticatedUser): Promise<UserRecord>;
    list(query: UserQuery): Promise<PaginatedResponse<UserRecord>>;
    resetPassword(id: string, password: string, actor: AuthenticatedUser): Promise<void>;
    update(id: string, input: UserUpdateInput, actor: AuthenticatedUser): Promise<UserRecord>;
  };
}

const unitInclude = {
  telefones: { orderBy: { tipo: 'asc' as const } },
  tipoUnidade: { select: { ativo: true, id: true, nome: true } },
} as const;

const professionalInclude = {
  cargoFuncao: {
    select: {
      ativo: true,
      ehProfessor: true,
      id: true,
      nome: true,
      permiteMultiplosExercicios: true,
      usaPontuacao: true,
    },
  },
  exercicios: {
    include: {
      postoTrabalho: { include: { quadroNecessidade: { include: { unidade: true } } } },
      substituiProfissional: { select: { id: true, matricula: true, nomeCompleto: true } },
    },
    orderBy: { criadoEm: 'asc' as const },
    where: { dataFim: null },
  },
  lotacoesSede: {
    include: { postoTrabalho: { include: { quadroNecessidade: { include: { unidade: true } } } } },
    take: 1,
    where: { dataFim: null },
  },
  telefones: { orderBy: { tipo: 'asc' as const } },
} as const;

const userInclude = {
  unidades: {
    include: { unidade: { select: { id: true, nome: true } } },
    orderBy: { unidade: { nome: 'asc' as const } },
  },
} as const;

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function mapUnit(unit: Prisma.UnidadeGetPayload<{ include: typeof unitInclude }>): UnitRecord {
  return {
    ativo: unit.ativo,
    bairro: unit.bairro,
    cep: unit.cep,
    cidade: unit.cidade,
    codigoInep: unit.codigoInep,
    complemento: unit.complemento,
    endereco: unit.endereco,
    id: unit.id,
    nome: unit.nome,
    numero: unit.numero,
    observacoes: unit.observacoes,
    poloRegiao: unit.poloRegiao,
    telefones: unit.telefones,
    tipoUnidade: unit.tipoUnidade,
    tipoUnidadeId: unit.tipoUnidadeId,
  };
}

function mapProfessional(
  professional: Prisma.ProfissionalGetPayload<{ include: typeof professionalInclude }>,
): ProfessionalRecord {
  const activePlacement = professional.lotacoesSede[0];
  const placementUnit = activePlacement?.postoTrabalho.quadroNecessidade.unidade;

  return {
    ativo: professional.ativo,
    bairro: professional.bairro,
    cargoFuncao: professional.cargoFuncao,
    cargoFuncaoId: professional.cargoFuncaoId,
    cep: professional.cep,
    cidade: professional.cidade,
    complemento: professional.complemento,
    cpf: professional.cpf,
    dataDesligamento: dateOnly(professional.dataDesligamento),
    dataEntradaPrefeitura: dateOnly(professional.dataEntradaPrefeitura)!,
    dataNascimento: dateOnly(professional.dataNascimento)!,
    email: professional.email,
    endereco: professional.endereco,
    exerciciosAtuais: professional.exercicios.map((exercise) => {
      const unit = exercise.postoTrabalho.quadroNecessidade.unidade;
      return {
        id: exercise.id,
        postoId: exercise.postoTrabalhoId,
        substituiProfissional: exercise.substituiProfissional,
        tipo: exercise.tipoExercicio,
        unidadeId: unit.id,
        unidadeNome: unit.nome,
      };
    }),
    id: professional.id,
    matricula: professional.matricula,
    nomeCompleto: professional.nomeCompleto,
    numero: professional.numero,
    numeroFilhos: professional.numeroFilhos,
    observacoes: professional.observacoes,
    permuta: professional.permuta,
    pontuacao: professional.pontuacao.toString(),
    remocao: professional.remocao,
    sedeAtual:
      activePlacement && placementUnit
        ? {
            postoId: activePlacement.postoTrabalhoId,
            unidadeId: placementUnit.id,
            unidadeNome: placementUnit.nome,
          }
        : null,
    telefones: professional.telefones,
  };
}

function mapUser(user: {
  ativo: boolean;
  email: string | null;
  id: string;
  login: string;
  nome: string;
  perfil: string;
  unidades: { unidade: { id: string; nome: string } }[];
}): UserRecord {
  return {
    ativo: user.ativo,
    email: user.email,
    id: user.id,
    login: user.login,
    nome: user.nome,
    perfil: user.perfil as UserRecord['perfil'],
    unidadeIds: user.unidades.map(({ unidade }) => unidade.id),
    unidades: user.unidades.map(({ unidade }) => unidade),
  };
}

function scopedUnitIds(user: AuthenticatedUser): string[] | undefined {
  return user.perfil === 'DIRETOR' || user.perfil === 'SECRETARIO'
    ? user.unidades.map((unit) => unit.id)
    : undefined;
}

function pagination<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResponse<T> {
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function compact(input: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

const expectedDatabaseRuleMessages = [
  'O cargo do profissional não permite múltiplos exercícios ativos.',
  'O novo cargo não permite os múltiplos exercícios ativos do profissional.',
  'Existem profissionais com múltiplos exercícios ativos neste cargo.',
  'Contador de exercícios ativos inconsistente.',
  'Diretor exige ao menos uma unidade vinculada.',
  'Secretário exige exatamente uma unidade vinculada.',
  'Este perfil não utiliza vínculo administrativo de unidade.',
] as const;

function handleDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'CONFLICT', 'Já existe um registro com os dados informados.');
    }
    if (error.code === 'P2004') {
      throw new HttpError(
        409,
        'BUSINESS_RULE_CONFLICT',
        'A alteração viola uma regra de integridade do cadastro.',
      );
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      throw new HttpError(404, 'NOT_FOUND', 'Registro relacionado não encontrado.');
    }
  }
  if (
    error instanceof Error &&
    expectedDatabaseRuleMessages.some((message) => error.message.includes(message))
  ) {
    throw new HttpError(
      409,
      'BUSINESS_RULE_CONFLICT',
      'A alteração viola uma regra de integridade do cadastro.',
    );
  }
  throw error;
}

function assertUserUnitCardinality(profile: UserRecord['perfil'], unitIds: string[]): void {
  if (profile === 'DIRETOR' && unitIds.length < 1) {
    throw new HttpError(400, 'UNIT_REQUIRED', 'Diretor exige ao menos uma unidade vinculada.');
  }
  if (profile === 'SECRETARIO' && unitIds.length !== 1) {
    throw new HttpError(
      400,
      'UNIT_CARDINALITY',
      'Secretário exige exatamente uma unidade vinculada.',
    );
  }
  if ((profile === 'ADMINISTRADOR' || profile === 'OPERADOR') && unitIds.length !== 0) {
    throw new HttpError(400, 'UNIT_NOT_ALLOWED', 'Este perfil não utiliza vínculo de unidade.');
  }
}

async function syncProfessionalPhones(
  transaction: Prisma.TransactionClient,
  professionalId: string,
  phones: PhoneCollectionInput[],
): Promise<void> {
  const existing = phones.filter((phone): phone is PhoneCollectionInput & { id: string } =>
    Boolean(phone.id),
  );
  for (const { id, ...phone } of existing) {
    const result = await transaction.profissionalTelefone.updateMany({
      data: phone,
      where: { id, profissionalId: professionalId },
    });
    if (result.count === 0) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
  }
  await transaction.profissionalTelefone.deleteMany({
    where: {
      profissionalId: professionalId,
      ...(existing.length ? { id: { notIn: existing.map((phone) => phone.id) } } : {}),
    },
  });
  const additions = phones
    .filter((phone) => !phone.id)
    .map(({ numero, tipo }) => ({ numero, tipo }));
  if (additions.length) {
    await transaction.profissionalTelefone.createMany({
      data: additions.map((phone) => ({ ...phone, profissionalId: professionalId })),
    });
  }
}

async function syncUnitPhones(
  transaction: Prisma.TransactionClient,
  unitId: string,
  phones: PhoneCollectionInput[],
): Promise<void> {
  const existing = phones.filter((phone): phone is PhoneCollectionInput & { id: string } =>
    Boolean(phone.id),
  );
  for (const { id, ...phone } of existing) {
    const result = await transaction.unidadeTelefone.updateMany({
      data: phone,
      where: { id, unidadeId: unitId },
    });
    if (result.count === 0) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
  }
  await transaction.unidadeTelefone.deleteMany({
    where: {
      unidadeId: unitId,
      ...(existing.length ? { id: { notIn: existing.map((phone) => phone.id) } } : {}),
    },
  });
  const additions = phones
    .filter((phone) => !phone.id)
    .map(({ numero, tipo }) => ({ numero, tipo }));
  if (additions.length) {
    await transaction.unidadeTelefone.createMany({
      data: additions.map((phone) => ({ ...phone, unidadeId: unitId })),
    });
  }
}

export function createPrismaRegistryServices(database: DatabaseConnection): RegistryServices {
  const { client } = database;

  async function getUnit(id: string, user: AuthenticatedUser): Promise<UnitRecord> {
    const scopeIds = scopedUnitIds(user);
    if (scopeIds && !scopeIds.includes(id)) {
      throw new HttpError(404, 'NOT_FOUND', 'Unidade não encontrada.');
    }
    const unit = await client.unidade.findFirst({
      include: unitInclude,
      where: { id },
    });
    if (!unit) throw new HttpError(404, 'NOT_FOUND', 'Unidade não encontrada.');
    return mapUnit(unit);
  }

  async function professionalAdministrativeUnitIds(id: string): Promise<string[]> {
    const exercises = await client.exercicioProfissional.findMany({
      select: { postoTrabalho: { select: { unidadeId: true } } },
      where: { dataFim: null, profissionalId: id },
    });
    if (exercises.length) {
      return [...new Set(exercises.map((exercise) => exercise.postoTrabalho.unidadeId))];
    }

    const placement = await client.lotacaoSede.findFirst({
      select: { postoTrabalho: { select: { unidadeId: true } } },
      where: { dataFim: null, profissionalId: id },
    });
    return placement ? [placement.postoTrabalho.unidadeId] : [];
  }

  function administrativeUnitScope(unitIds: string[]): Prisma.ProfissionalWhereInput {
    return {
      OR: [
        { exercicios: { some: { dataFim: null, postoTrabalho: { unidadeId: { in: unitIds } } } } },
        {
          exercicios: { none: { dataFim: null } },
          lotacoesSede: {
            some: { dataFim: null, postoTrabalho: { unidadeId: { in: unitIds } } },
          },
        },
      ],
    };
  }

  function professionalScope(user: AuthenticatedUser): Prisma.ProfissionalWhereInput {
    const unitIds = scopedUnitIds(user);
    return unitIds ? administrativeUnitScope(unitIds) : {};
  }

  async function getProfessional(id: string, user: AuthenticatedUser): Promise<ProfessionalRecord> {
    const professional = await client.profissional.findFirst({
      include: professionalInclude,
      where: { id, ...professionalScope(user) },
    });
    if (!professional) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
    return mapProfessional(professional);
  }

  async function getUser(id: string): Promise<UserRecord> {
    const user = await client.usuario.findUnique({
      include: userInclude,
      where: { id },
    });
    if (!user) throw new HttpError(404, 'NOT_FOUND', 'Usuário não encontrado.');
    return mapUser(user);
  }

  async function assertIdentifiers(
    input: { email: string | null; login: string },
    allowedOwnerId?: string,
  ): Promise<void> {
    await assertUserIdentifiersAvailable(
      {
        async findByIdentifiers(identifiers) {
          return client.usuario.findMany({
            select: { email: true, id: true, login: true },
            where: {
              OR: [{ login: { in: [...identifiers] } }, { email: { in: [...identifiers] } }],
            },
          });
        },
      },
      input,
      allowedOwnerId,
    ).catch(() => {
      throw new HttpError(409, 'IDENTIFIER_CONFLICT', 'Login ou e-mail já está em uso.');
    });
  }

  return {
    lookups: {
      async cargos() {
        return client.cargoFuncao.findMany({
          orderBy: { nome: 'asc' },
          select: { ativo: true, id: true, nome: true },
          where: { ativo: true },
        });
      },
      async periodos() {
        return client.periodo.findMany({
          orderBy: { nome: 'asc' },
          select: { ativo: true, id: true, nome: true },
          where: { ativo: true },
        });
      },
      async segmentos() {
        return client.segmentoEnsino.findMany({
          orderBy: { nome: 'asc' },
          select: { ativo: true, id: true, nome: true },
          where: { ativo: true },
        });
      },
      async tiposUnidade() {
        return client.tipoUnidade.findMany({
          orderBy: { nome: 'asc' },
          select: { ativo: true, id: true, nome: true },
          where: { ativo: true },
        });
      },
      async unidades(user) {
        const unitIds = scopedUnitIds(user);
        return client.unidade.findMany({
          orderBy: { nome: 'asc' },
          select: { ativo: true, id: true, nome: true },
          where: { ativo: true, ...(unitIds ? { id: { in: unitIds } } : {}) },
        });
      },
    },
    professionals: {
      async addPhone(id, input, user) {
        await getProfessional(id, user);
        await client.$transaction(async (transaction) => {
          const phone = await transaction.profissionalTelefone.create({
            data: { ...input, profissionalId: id },
          });
          await writeAudit(transaction, {
            acao: 'CREATE',
            after: phone,
            entidade: 'PROFISSIONAL_TELEFONE',
            profissionalId: id,
            registroId: phone.id,
            usuarioId: user.id,
          });
        });
        return getProfessional(id, user);
      },
      async create(input, user) {
        const { telefones, ...fields } = input;
        try {
          const professional = await client.$transaction(async (transaction) => {
            const created = await transaction.profissional.create({
              data: {
                ...fields,
                dataDesligamento: fields.dataDesligamento ? asDate(fields.dataDesligamento) : null,
                dataEntradaPrefeitura: asDate(fields.dataEntradaPrefeitura),
                dataNascimento: asDate(fields.dataNascimento),
                telefones: { create: telefones },
              },
              include: professionalInclude,
            });
            const mapped = mapProfessional(created);
            await writeAudit(transaction, {
              acao: 'CREATE',
              after: mapped,
              entidade: 'PROFISSIONAL',
              profissionalId: created.id,
              registroId: created.id,
              usuarioId: user.id,
            });
            return created;
          });
          return mapProfessional(professional);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async deletePhone(id, phoneId, user) {
        await getProfessional(id, user);
        const found = await client.$transaction(async (transaction) => {
          const before = await transaction.profissionalTelefone.findFirst({
            where: { id: phoneId, profissionalId: id },
          });
          if (!before) return false;
          await transaction.profissionalTelefone.delete({ where: { id: phoneId } });
          await writeAudit(transaction, {
            acao: 'DELETE',
            before,
            entidade: 'PROFISSIONAL_TELEFONE',
            profissionalId: id,
            registroId: phoneId,
            usuarioId: user.id,
          });
          return true;
        });
        if (!found) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
      },
      get: getProfessional,
      async list(query, user) {
        const unitIds = scopedUnitIds(user) ?? (query.unidadeId ? [query.unidadeId] : undefined);
        const where: Prisma.ProfissionalWhereInput = {
          ...professionalScope(user),
          ...(query.ativo === undefined ? {} : { ativo: query.ativo }),
          ...(query.cargoFuncaoId ? { cargoFuncaoId: query.cargoFuncaoId } : {}),
          ...(query.matricula
            ? { matricula: { contains: query.matricula, mode: 'insensitive' } }
            : {}),
          ...(query.nome ? { nomeCompleto: { contains: query.nome, mode: 'insensitive' } } : {}),
          ...(query.permuta === undefined ? {} : { permuta: query.permuta }),
          ...(query.remocao === undefined ? {} : { remocao: query.remocao }),
          ...(query.usaPontuacao === undefined
            ? {}
            : {
                cargoFuncao: { ehProfessor: query.usaPontuacao, usaPontuacao: query.usaPontuacao },
              }),
          ...(unitIds ? administrativeUnitScope(unitIds) : {}),
        };
        const [items, total] = await client.$transaction([
          client.profissional.findMany({
            include: professionalInclude,
            orderBy: [{ nomeCompleto: 'asc' }, { matricula: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          client.profissional.count({ where }),
        ]);
        return pagination(items.map(mapProfessional), query.page, query.pageSize, total);
      },
      administrativeUnitIds: professionalAdministrativeUnitIds,
      async update(id, input, user) {
        await getProfessional(id, user);
        const {
          dataDesligamento,
          dataEntradaPrefeitura,
          dataNascimento,
          telefones,
          ...otherFields
        } = input;
        const data = {
          ...compact(otherFields),
          ...(dataDesligamento === undefined
            ? {}
            : { dataDesligamento: dataDesligamento ? asDate(dataDesligamento) : null }),
          ...(dataEntradaPrefeitura
            ? { dataEntradaPrefeitura: asDate(dataEntradaPrefeitura) }
            : {}),
          ...(dataNascimento ? { dataNascimento: asDate(dataNascimento) } : {}),
        } as Prisma.ProfissionalUncheckedUpdateInput;
        try {
          await client.$transaction(async (transaction) => {
            const before = mapProfessional(
              await transaction.profissional.findUniqueOrThrow({
                include: professionalInclude,
                where: { id },
              }),
            );
            if (Object.keys(data).length) {
              await transaction.profissional.update({ data, where: { id } });
            }
            if (telefones) await syncProfessionalPhones(transaction, id, telefones);
            const after = mapProfessional(
              await transaction.profissional.findUniqueOrThrow({
                include: professionalInclude,
                where: { id },
              }),
            );
            await writeAudit(transaction, {
              acao: 'UPDATE',
              after,
              before,
              entidade: 'PROFISSIONAL',
              profissionalId: id,
              registroId: id,
              usuarioId: user.id,
            });
          });
          return getProfessional(id, user);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async updatePhone(id, phoneId, input, user) {
        await getProfessional(id, user);
        const found = await client.$transaction(async (transaction) => {
          const before = await transaction.profissionalTelefone.findFirst({
            where: { id: phoneId, profissionalId: id },
          });
          if (!before) return false;
          const after = await transaction.profissionalTelefone.update({
            data: input,
            where: { id: phoneId },
          });
          await writeAudit(transaction, {
            acao: 'UPDATE',
            after,
            before,
            entidade: 'PROFISSIONAL_TELEFONE',
            profissionalId: id,
            registroId: phoneId,
            usuarioId: user.id,
          });
          return true;
        });
        if (!found) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
        return getProfessional(id, user);
      },
      async updateScore(id, score, user) {
        const target = await client.profissional.findUnique({
          select: { cargoFuncao: { select: { ehProfessor: true, usaPontuacao: true } } },
          where: { id },
        });
        if (!target) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
        if (!target.cargoFuncao.ehProfessor || !target.cargoFuncao.usaPontuacao) {
          throw new HttpError(
            409,
            'SCORE_NOT_APPLICABLE',
            'O cargo deste profissional não utiliza pontuação.',
          );
        }
        await client.$transaction(async (transaction) => {
          const before = await transaction.profissional.findUniqueOrThrow({
            select: { id: true, pontuacao: true },
            where: { id },
          });
          const after = await transaction.profissional.update({
            data: { pontuacao: score },
            select: { id: true, pontuacao: true },
            where: { id },
          });
          await writeAudit(transaction, {
            acao: 'UPDATE',
            after,
            before,
            entidade: 'PROFISSIONAL_PONTUACAO',
            profissionalId: id,
            registroId: id,
            usuarioId: user.id,
          });
        });
        const professional = await client.profissional.findUniqueOrThrow({
          include: professionalInclude,
          where: { id },
        });
        return mapProfessional(professional);
      },
    },
    units: {
      async addPhone(id, input, user) {
        await getUnit(id, user);
        await client.$transaction(async (transaction) => {
          const phone = await transaction.unidadeTelefone.create({
            data: { ...input, unidadeId: id },
          });
          await writeAudit(transaction, {
            acao: 'CREATE',
            after: phone,
            entidade: 'UNIDADE_TELEFONE',
            registroId: phone.id,
            unidadeId: id,
            usuarioId: user.id,
          });
        });
        return getUnit(id, user);
      },
      async create(input, user) {
        const { telefones, ...fields } = input;
        try {
          return await client.$transaction(async (transaction) => {
            const created = await transaction.unidade.create({
              data: { ...fields, telefones: { create: telefones } },
              include: unitInclude,
            });
            const mapped = mapUnit(created);
            await writeAudit(transaction, {
              acao: 'CREATE',
              after: mapped,
              entidade: 'UNIDADE',
              registroId: created.id,
              unidadeId: created.id,
              usuarioId: user.id,
            });
            return mapped;
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async deletePhone(id, phoneId, user) {
        await getUnit(id, user);
        const found = await client.$transaction(async (transaction) => {
          const before = await transaction.unidadeTelefone.findFirst({
            where: { id: phoneId, unidadeId: id },
          });
          if (!before) return false;
          await transaction.unidadeTelefone.delete({ where: { id: phoneId } });
          await writeAudit(transaction, {
            acao: 'DELETE',
            before,
            entidade: 'UNIDADE_TELEFONE',
            registroId: phoneId,
            unidadeId: id,
            usuarioId: user.id,
          });
          return true;
        });
        if (!found) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
      },
      get: getUnit,
      async list(query, user) {
        const unitIds = scopedUnitIds(user);
        const where: Prisma.UnidadeWhereInput = {
          ...(unitIds ? { id: { in: unitIds } } : {}),
          ...(query.ativo === undefined ? {} : { ativo: query.ativo }),
          ...(query.nome ? { nome: { contains: query.nome, mode: 'insensitive' } } : {}),
          ...(query.tipoUnidadeId ? { tipoUnidadeId: query.tipoUnidadeId } : {}),
        };
        const [items, total] = await client.$transaction([
          client.unidade.findMany({
            include: unitInclude,
            orderBy: { nome: 'asc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          client.unidade.count({ where }),
        ]);
        return pagination(items.map(mapUnit), query.page, query.pageSize, total);
      },
      async update(id, input, user) {
        await getUnit(id, user);
        const { telefones, ...fields } = input;
        try {
          await client.$transaction(async (transaction) => {
            const before = mapUnit(
              await transaction.unidade.findUniqueOrThrow({ include: unitInclude, where: { id } }),
            );
            const data = compact(fields) as Prisma.UnidadeUncheckedUpdateInput;
            if (Object.keys(data).length) {
              await transaction.unidade.update({ data, where: { id } });
            }
            if (telefones) await syncUnitPhones(transaction, id, telefones);
            const after = mapUnit(
              await transaction.unidade.findUniqueOrThrow({ include: unitInclude, where: { id } }),
            );
            await writeAudit(transaction, {
              acao: 'UPDATE',
              after,
              before,
              entidade: 'UNIDADE',
              registroId: id,
              unidadeId: id,
              usuarioId: user.id,
            });
          });
          return getUnit(id, user);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async updatePhone(id, phoneId, input, user) {
        await getUnit(id, user);
        const found = await client.$transaction(async (transaction) => {
          const before = await transaction.unidadeTelefone.findFirst({
            where: { id: phoneId, unidadeId: id },
          });
          if (!before) return false;
          const after = await transaction.unidadeTelefone.update({
            data: input,
            where: { id: phoneId },
          });
          await writeAudit(transaction, {
            acao: 'UPDATE',
            after,
            before,
            entidade: 'UNIDADE_TELEFONE',
            registroId: phoneId,
            unidadeId: id,
            usuarioId: user.id,
          });
          return true;
        });
        if (!found) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
        return getUnit(id, user);
      },
    },
    users: {
      async create(input, actor) {
        await assertIdentifiers(input);
        assertUserUnitCardinality(input.perfil, input.unidadeIds);
        try {
          const senhaHash = await hashPassword(input.senha);
          const user = await client.$transaction(async (transaction) => {
            const created = await transaction.usuario.create({
              data: {
                ativo: input.ativo,
                email: input.email,
                login: input.login,
                nome: input.nome,
                perfil: input.perfil,
                senhaHash,
                unidades: {
                  create: input.unidadeIds.map((unidadeId) => ({ unidadeId })),
                },
              },
              include: userInclude,
            });
            const mapped = mapUser(created);
            await writeAudit(transaction, {
              acao: 'CREATE',
              after: mapped,
              entidade: 'USUARIO',
              registroId: created.id,
              usuarioId: actor.id,
            });
            return created;
          });
          return mapUser(user);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async list(query) {
        const where: Prisma.UsuarioWhereInput = {
          ...(query.ativo === undefined ? {} : { ativo: query.ativo }),
          ...(query.nome
            ? {
                OR: [
                  { nome: { contains: query.nome, mode: 'insensitive' } },
                  { login: { contains: query.nome, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(query.perfil ? { perfil: query.perfil } : {}),
        };
        const [items, total] = await client.$transaction([
          client.usuario.findMany({
            include: userInclude,
            orderBy: { nome: 'asc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          client.usuario.count({ where }),
        ]);
        return pagination(items.map(mapUser), query.page, query.pageSize, total);
      },
      async resetPassword(id, password, actor) {
        const exists = await client.usuario.findUnique({ select: { id: true }, where: { id } });
        if (!exists) throw new HttpError(404, 'NOT_FOUND', 'Usuário não encontrado.');
        await client.$transaction(async (transaction) => {
          await transaction.usuario.update({
            data: { senhaHash: await hashPassword(password) },
            where: { id },
          });
          await transaction.sessaoUsuario.deleteMany({ where: { usuarioId: id } });
          await writeAudit(transaction, {
            acao: 'UPDATE',
            after: { credencialAlterada: true, id },
            before: { credencialAlterada: false, id },
            entidade: 'USUARIO_CREDENCIAL',
            registroId: id,
            usuarioId: actor.id,
          });
        });
      },
      async update(id, input, actor) {
        const current = await client.usuario.findUnique({ include: userInclude, where: { id } });
        if (!current) throw new HttpError(404, 'NOT_FOUND', 'Usuário não encontrado.');
        const perfil = input.perfil ?? current.perfil;
        const currentUnitIds = current.unidades.map(({ unidade }) => unidade.id);
        const requestedUnitIds = input.unidadeIds ?? currentUnitIds;
        const unidadeIds =
          perfil === 'ADMINISTRADOR' || perfil === 'OPERADOR' ? [] : requestedUnitIds;
        if (input.unidadeIds && requestedUnitIds.length !== new Set(requestedUnitIds).size) {
          throw new HttpError(400, 'DUPLICATE_UNIT', 'Não repita unidades.');
        }
        assertUserUnitCardinality(perfil, unidadeIds);
        const login = input.login ?? current.login;
        const email = input.email === undefined ? current.email : input.email;
        await assertIdentifiers({ email, login }, id);
        const fields = Object.fromEntries(
          Object.entries(input).filter(([key]) => key !== 'unidadeIds'),
        );
        try {
          await client.$transaction(async (transaction) => {
            await transaction.usuario.update({
              data: compact(fields) as Prisma.UsuarioUncheckedUpdateInput,
              where: { id },
            });
            await transaction.usuarioUnidade.deleteMany({ where: { usuarioId: id } });
            if (unidadeIds.length) {
              await transaction.usuarioUnidade.createMany({
                data: unidadeIds.map((unidadeId) => ({ unidadeId, usuarioId: id })),
              });
            }
            const after = await transaction.usuario.findUniqueOrThrow({
              include: userInclude,
              where: { id },
            });
            await writeAudit(transaction, {
              acao: 'UPDATE',
              after: mapUser(after),
              before: mapUser(current),
              entidade: 'USUARIO',
              registroId: id,
              usuarioId: actor.id,
            });
          });
          return getUser(id);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
    },
  };
}
