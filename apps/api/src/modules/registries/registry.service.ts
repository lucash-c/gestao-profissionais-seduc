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
import { assertUserIdentifiersAvailable } from '../users/user-identifier.service.js';
import type {
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
    tiposUnidade(): Promise<LookupRecord[]>;
    unidades(user: AuthenticatedUser): Promise<LookupRecord[]>;
  };
  professionals: {
    addPhone(id: string, input: PhoneInput, user: AuthenticatedUser): Promise<ProfessionalRecord>;
    create(input: ProfessionalCreateInput): Promise<ProfessionalRecord>;
    deletePhone(id: string, phoneId: string, user: AuthenticatedUser): Promise<void>;
    get(id: string, user: AuthenticatedUser): Promise<ProfessionalRecord>;
    list(
      query: ProfessionalQuery,
      user: AuthenticatedUser,
    ): Promise<PaginatedResponse<ProfessionalRecord>>;
    resourceUnitId(id: string): Promise<string | undefined>;
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
    updateScore(id: string, score: number): Promise<ProfessionalRecord>;
  };
  units: {
    addPhone(id: string, input: PhoneInput, user: AuthenticatedUser): Promise<UnitRecord>;
    create(input: UnitCreateInput): Promise<UnitRecord>;
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
    create(input: UserCreateInput): Promise<UserRecord>;
    list(query: UserQuery): Promise<PaginatedResponse<UserRecord>>;
    resetPassword(id: string, password: string): Promise<void>;
    update(id: string, input: UserUpdateInput): Promise<UserRecord>;
  };
}

const unitInclude = {
  telefones: { orderBy: { tipo: 'asc' as const } },
  tipoUnidade: { select: { ativo: true, id: true, nome: true } },
} as const;

const professionalInclude = {
  cargoFuncao: {
    select: { ativo: true, ehProfessor: true, id: true, nome: true, usaPontuacao: true },
  },
  exercicios: {
    include: { postoTrabalho: { include: { quadroNecessidade: { include: { unidade: true } } } } },
    take: 1,
    where: { dataFim: null },
  },
  lotacoesSede: {
    include: { postoTrabalho: { include: { quadroNecessidade: { include: { unidade: true } } } } },
    take: 1,
    where: { dataFim: null },
  },
  telefones: { orderBy: { tipo: 'asc' as const } },
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
  const activeExercise = professional.exercicios[0];
  const placementUnit = activePlacement?.postoTrabalho.quadroNecessidade.unidade;
  const exerciseUnit = activeExercise?.postoTrabalho.quadroNecessidade.unidade;

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
    exercicioAtual:
      activeExercise && exerciseUnit
        ? {
            postoId: activeExercise.postoTrabalhoId,
            tipo: activeExercise.tipoExercicio,
            unidadeId: exerciseUnit.id,
            unidadeNome: exerciseUnit.nome,
          }
        : null,
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
  unidade: { id: string; nome: string } | null;
  unidadeId: string | null;
}): UserRecord {
  return { ...user, perfil: user.perfil as UserRecord['perfil'] };
}

function scopedUnitId(user: AuthenticatedUser): string | undefined {
  return user.perfil === 'DIRETOR' || user.perfil === 'SECRETARIO' ? user.unidade?.id : undefined;
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

function handleDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'CONFLICT', 'Já existe um registro com os dados informados.');
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      throw new HttpError(404, 'NOT_FOUND', 'Registro relacionado não encontrado.');
    }
  }
  throw error;
}

export function createPrismaRegistryServices(database: DatabaseConnection): RegistryServices {
  const { client } = database;

  async function getUnit(id: string, user: AuthenticatedUser): Promise<UnitRecord> {
    const scopeId = scopedUnitId(user);
    if (scopeId && scopeId !== id) {
      throw new HttpError(404, 'NOT_FOUND', 'Unidade não encontrada.');
    }
    const unit = await client.unidade.findFirst({
      include: unitInclude,
      where: { id },
    });
    if (!unit) throw new HttpError(404, 'NOT_FOUND', 'Unidade não encontrada.');
    return mapUnit(unit);
  }

  async function professionalUnitId(id: string): Promise<string | undefined> {
    const record = await client.lotacaoSede.findFirst({
      select: { postoTrabalho: { select: { unidadeId: true } } },
      where: { dataFim: null, profissionalId: id },
    });
    return record?.postoTrabalho.unidadeId;
  }

  function professionalScope(user: AuthenticatedUser): Prisma.ProfissionalWhereInput {
    const unitId = scopedUnitId(user);
    return unitId
      ? { lotacoesSede: { some: { dataFim: null, postoTrabalho: { unidadeId: unitId } } } }
      : {};
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
      include: { unidade: { select: { id: true, nome: true } } },
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
      async tiposUnidade() {
        return client.tipoUnidade.findMany({
          orderBy: { nome: 'asc' },
          select: { ativo: true, id: true, nome: true },
          where: { ativo: true },
        });
      },
      async unidades(user) {
        const unitId = scopedUnitId(user);
        return client.unidade.findMany({
          orderBy: { nome: 'asc' },
          select: { ativo: true, id: true, nome: true },
          where: { ativo: true, ...(unitId ? { id: unitId } : {}) },
        });
      },
    },
    professionals: {
      async addPhone(id, input, user) {
        await getProfessional(id, user);
        await client.profissionalTelefone.create({ data: { ...input, profissionalId: id } });
        return getProfessional(id, user);
      },
      async create(input) {
        const { telefones, ...fields } = input;
        try {
          const professional = await client.profissional.create({
            data: {
              ...fields,
              dataDesligamento: fields.dataDesligamento ? asDate(fields.dataDesligamento) : null,
              dataEntradaPrefeitura: asDate(fields.dataEntradaPrefeitura),
              dataNascimento: asDate(fields.dataNascimento),
              telefones: { create: telefones },
            },
            include: professionalInclude,
          });
          return mapProfessional(professional);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async deletePhone(id, phoneId, user) {
        await getProfessional(id, user);
        const result = await client.profissionalTelefone.deleteMany({
          where: { id: phoneId, profissionalId: id },
        });
        if (result.count === 0) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
      },
      get: getProfessional,
      async list(query, user) {
        const unitId = scopedUnitId(user) ?? query.unidadeId;
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
          ...(unitId
            ? {
                lotacoesSede: {
                  some: { dataFim: null, postoTrabalho: { unidadeId: unitId } },
                },
              }
            : {}),
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
      resourceUnitId: professionalUnitId,
      async update(id, input, user) {
        await getProfessional(id, user);
        const { dataDesligamento, dataEntradaPrefeitura, dataNascimento, ...otherFields } = input;
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
          await client.profissional.update({
            data,
            where: { id },
          });
          return getProfessional(id, user);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async updatePhone(id, phoneId, input, user) {
        await getProfessional(id, user);
        const result = await client.profissionalTelefone.updateMany({
          data: input,
          where: { id: phoneId, profissionalId: id },
        });
        if (result.count === 0) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
        return getProfessional(id, user);
      },
      async updateScore(id, score) {
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
        await client.profissional.update({ data: { pontuacao: score }, where: { id } });
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
        await client.unidadeTelefone.create({ data: { ...input, unidadeId: id } });
        return getUnit(id, user);
      },
      async create(input) {
        const { telefones, ...fields } = input;
        try {
          return mapUnit(
            await client.unidade.create({
              data: { ...fields, telefones: { create: telefones } },
              include: unitInclude,
            }),
          );
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async deletePhone(id, phoneId, user) {
        await getUnit(id, user);
        const result = await client.unidadeTelefone.deleteMany({
          where: { id: phoneId, unidadeId: id },
        });
        if (result.count === 0) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
      },
      get: getUnit,
      async list(query, user) {
        const unitId = scopedUnitId(user);
        const where: Prisma.UnidadeWhereInput = {
          ...(unitId ? { id: unitId } : {}),
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
        try {
          await client.unidade.update({
            data: compact(input) as Prisma.UnidadeUncheckedUpdateInput,
            where: { id },
          });
          return getUnit(id, user);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
      async updatePhone(id, phoneId, input, user) {
        await getUnit(id, user);
        const result = await client.unidadeTelefone.updateMany({
          data: input,
          where: { id: phoneId, unidadeId: id },
        });
        if (result.count === 0) throw new HttpError(404, 'NOT_FOUND', 'Telefone não encontrado.');
        return getUnit(id, user);
      },
    },
    users: {
      async create(input) {
        await assertIdentifiers(input);
        try {
          const user = await client.usuario.create({
            data: {
              ativo: input.ativo,
              email: input.email,
              login: input.login,
              nome: input.nome,
              perfil: input.perfil,
              senhaHash: await hashPassword(input.senha),
              unidadeId: input.unidadeId,
            },
            include: { unidade: { select: { id: true, nome: true } } },
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
            include: { unidade: { select: { id: true, nome: true } } },
            orderBy: { nome: 'asc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          client.usuario.count({ where }),
        ]);
        return pagination(items.map(mapUser), query.page, query.pageSize, total);
      },
      async resetPassword(id, password) {
        const exists = await client.usuario.findUnique({ select: { id: true }, where: { id } });
        if (!exists) throw new HttpError(404, 'NOT_FOUND', 'Usuário não encontrado.');
        await client.$transaction([
          client.usuario.update({
            data: { senhaHash: await hashPassword(password) },
            where: { id },
          }),
          client.sessaoUsuario.deleteMany({ where: { usuarioId: id } }),
        ]);
      },
      async update(id, input) {
        const current = await client.usuario.findUnique({ where: { id } });
        if (!current) throw new HttpError(404, 'NOT_FOUND', 'Usuário não encontrado.');
        const perfil = input.perfil ?? current.perfil;
        const unidadeId = input.unidadeId === undefined ? current.unidadeId : input.unidadeId;
        if ((perfil === 'DIRETOR' || perfil === 'SECRETARIO') && !unidadeId) {
          throw new HttpError(
            400,
            'UNIT_REQUIRED',
            'Diretor e Secretário exigem unidade vinculada.',
          );
        }
        const login = input.login ?? current.login;
        const email = input.email === undefined ? current.email : input.email;
        await assertIdentifiers({ email, login }, id);
        try {
          await client.usuario.update({
            data: compact(input) as Prisma.UsuarioUncheckedUpdateInput,
            where: { id },
          });
          return getUser(id);
        } catch (error) {
          handleDatabaseError(error);
        }
      },
    },
  };
}
