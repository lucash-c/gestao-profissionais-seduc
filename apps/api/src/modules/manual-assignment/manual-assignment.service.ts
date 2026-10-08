import type {
  AuthenticatedUser,
  ManualAdministrativeExercise,
  ManualAdministrativePosition,
  ManualAssignmentConfiguration,
  ManualAssignmentProfessional,
  ManualAssignmentResult,
  ManualAssignmentSimulation,
  ManualExerciseEndSimulation,
  ManualSeatRemovalSimulation,
  PaginatedResponse,
  WorkPositionRecord,
} from '@seduc/contracts';
import { Prisma, type DatabaseConnection } from '@seduc/database';

import { HttpError } from '../../http/http-error.js';
import {
  loadPosition,
  lockPositions,
  lockProfessionals,
  mapWorkPosition,
  positionAvailabilityInclude,
  type PositionAvailabilityPayload,
} from '../assignments/assignment.service.js';
import { writeAudit } from '../audit/audit.service.js';
import { assertAuthorized, AUTHORIZATION_ACTIONS } from '../authorization/authorization.policy.js';
import type {
  ManualAssignmentInput,
  ManualExerciseEndInput,
  ManualAssignmentPositionQuery,
  ManualAssignmentProfessionalQuery,
  ManualSeatRemovalInput,
} from './manual-assignment.schemas.js';

const CONFIGURATION_KEY = 'ATRIBUICAO_MANUAL_HABILITADA';

const positionLinkInclude = {
  quadroNecessidade: { include: { unidade: true } },
} as const;

const professionalInclude = {
  afastamentos: { select: { id: true }, where: { dataFim: null } },
  cargoFuncao: { select: { ativo: true, id: true, nome: true } },
  exercicios: {
    include: {
      postoTrabalho: { include: positionLinkInclude },
      substituiProfissional: { select: { id: true, matricula: true, nomeCompleto: true } },
    },
    orderBy: { dataInicio: 'asc' as const },
    where: { dataFim: null },
  },
  lotacoesSede: {
    include: { postoTrabalho: { include: positionLinkInclude } },
    orderBy: { dataInicio: 'desc' as const },
    take: 1,
    where: { dataFim: null },
  },
} as const;

type ProfessionalPayload = Prisma.ProfissionalGetPayload<{ include: typeof professionalInclude }>;

type AdministrativeExerciseSource = {
  id: string;
  postoTrabalhoId: string;
  tipoExercicio: 'SEDE' | 'SEM_SEDE' | 'SUBSTITUICAO';
  postoTrabalho: {
    codigo: string;
    quadroNecessidade: { unidade: { id: string; nome: string } };
  };
};

type AdministrativeSeatSource = {
  id: string;
  postoTrabalhoId: string;
  postoTrabalho: {
    codigo: string;
    quadroNecessidade: { unidade: { id: string; nome: string } };
  };
};

export interface ManualAssignmentServices {
  configuration: {
    get(user: AuthenticatedUser): Promise<ManualAssignmentConfiguration>;
    update(habilitada: boolean, user: AuthenticatedUser): Promise<ManualAssignmentConfiguration>;
  };
  confirm(input: ManualAssignmentInput, user: AuthenticatedUser): Promise<ManualAssignmentResult>;
  listPositions(
    query: ManualAssignmentPositionQuery,
    user: AuthenticatedUser,
  ): Promise<WorkPositionRecord[]>;
  listProfessionals(
    query: ManualAssignmentProfessionalQuery,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<ManualAssignmentProfessional>>;
  simulateExerciseEnd(
    input: ManualExerciseEndInput,
    user: AuthenticatedUser,
  ): Promise<ManualExerciseEndSimulation>;
  simulateSeatRemoval(
    input: ManualSeatRemovalInput,
    user: AuthenticatedUser,
  ): Promise<ManualSeatRemovalSimulation>;
  simulate(
    input: ManualAssignmentInput,
    user: AuthenticatedUser,
  ): Promise<ManualAssignmentSimulation>;
  endExercise(input: ManualExerciseEndInput, user: AuthenticatedUser): Promise<void>;
  removeSeat(input: ManualSeatRemovalInput, user: AuthenticatedUser): Promise<void>;
}

function asIso(value: Date): string {
  return value.toISOString();
}

function mapProfessional(professional: ProfessionalPayload): ManualAssignmentProfessional {
  const placement = professional.lotacoesSede[0];
  return {
    afastado: professional.afastamentos.length > 0,
    ativo: professional.ativo,
    cargoFuncao: professional.cargoFuncao,
    cargoFuncaoId: professional.cargoFuncaoId,
    exerciciosAtuais: professional.exercicios.map((exercise) => ({
      dataFim: null,
      dataInicio: asIso(exercise.dataInicio),
      id: exercise.id,
      observacoes: exercise.observacoes,
      postoId: exercise.postoTrabalhoId,
      substituiProfissional: exercise.substituiProfissional,
      tipo: exercise.tipoExercicio,
      unidadeId: exercise.postoTrabalho.unidadeId,
      unidadeNome: exercise.postoTrabalho.quadroNecessidade.unidade.nome,
    })),
    id: professional.id,
    matricula: professional.matricula,
    nomeCompleto: professional.nomeCompleto,
    sedeAtual: placement
      ? {
          dataFim: null,
          dataInicio: asIso(placement.dataInicio),
          id: placement.id,
          motivoFim: placement.motivoFim,
          postoId: placement.postoTrabalhoId,
          unidadeId: placement.postoTrabalho.unidadeId,
          unidadeNome: placement.postoTrabalho.quadroNecessidade.unidade.nome,
        }
      : null,
  };
}

function mapAdministrativeProfessional(value: {
  id: string;
  matricula: string;
  nomeCompleto: string;
}) {
  return { id: value.id, matricula: value.matricula, nomeCompleto: value.nomeCompleto };
}

function mapAdministrativePosition(
  value: Pick<AdministrativeSeatSource, 'postoTrabalhoId' | 'postoTrabalho'>,
): ManualAdministrativePosition {
  const unit = value.postoTrabalho.quadroNecessidade.unidade;
  return {
    postoCodigo: value.postoTrabalho.codigo,
    postoId: value.postoTrabalhoId,
    unidadeId: unit.id,
    unidadeNome: unit.nome,
  };
}

function mapAdministrativeSeat(value: AdministrativeSeatSource) {
  return { lotacaoSedeId: value.id, ...mapAdministrativePosition(value) };
}

function mapAdministrativeExercise(
  value: AdministrativeExerciseSource,
): ManualAdministrativeExercise {
  return { id: value.id, tipo: value.tipoExercicio, ...mapAdministrativePosition(value) };
}

function assertManualRole(user: AuthenticatedUser): void {
  if (!['ADMINISTRADOR', 'DIRETOR'].includes(user.perfil)) {
    throw new HttpError(403, 'FORBIDDEN', 'Acesso não autorizado.');
  }
}

function assertAdministrativeRole(user: AuthenticatedUser): void {
  assertAuthorized({ action: AUTHORIZATION_ACTIONS.MANAGE_MANUAL_ASSIGNMENT_ADMINISTRATION, user });
}

async function configuration(
  client: Pick<Prisma.TransactionClient, 'configuracaoSistema'>,
): Promise<ManualAssignmentConfiguration> {
  const stored = await client.configuracaoSistema.findUnique({
    where: { chave: CONFIGURATION_KEY },
  });
  return { habilitada: stored?.valorBooleano ?? true };
}

async function assertAccessible(
  client: Pick<Prisma.TransactionClient, 'configuracaoSistema'>,
  user: AuthenticatedUser,
): Promise<ManualAssignmentConfiguration> {
  assertManualRole(user);
  const config = await configuration(client);
  if (user.perfil === 'DIRETOR' && !config.habilitada) {
    throw new HttpError(
      403,
      'MANUAL_ASSIGNMENT_DISABLED',
      'A Atribuição manual está desabilitada pelo Administrador.',
    );
  }
  return config;
}

async function assertEnabled(
  client: Pick<Prisma.TransactionClient, 'configuracaoSistema'>,
  user: AuthenticatedUser,
): Promise<void> {
  const config = await assertAccessible(client, user);
  if (!config.habilitada) {
    throw new HttpError(
      409,
      'MANUAL_ASSIGNMENT_DISABLED',
      'Ative a Atribuição manual antes de confirmar uma operação.',
    );
  }
}

async function loadProfessional(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<ProfessionalPayload> {
  const professional = await transaction.profissional.findUnique({
    include: professionalInclude,
    where: { id },
  });
  if (!professional) throw new HttpError(404, 'NOT_FOUND', 'Profissional não encontrado.');
  return professional;
}

function seatChanged(): never {
  throw new HttpError(
    409,
    'OFFICIAL_SEAT_CHANGED',
    'A sede oficial foi alterada desde a simulação. Atualize e tente novamente.',
  );
}

function exerciseChanged(): never {
  throw new HttpError(
    409,
    'CURRENT_EXERCISE_CHANGED',
    'O exercício atual foi alterado desde a simulação. Atualize e tente novamente.',
  );
}

async function lockActiveProfessionalExercises(
  transaction: Prisma.TransactionClient,
  professionalId: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "exercicio_profissional"
    WHERE "profissional_id" = ${professionalId}::uuid AND "data_fim" IS NULL
    ORDER BY "id" FOR UPDATE
  `);
}

async function lockActivePositionExercises(
  transaction: Prisma.TransactionClient,
  positionId: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "exercicio_profissional"
    WHERE "posto_trabalho_id" = ${positionId}::uuid AND "data_fim" IS NULL
    ORDER BY "id" FOR UPDATE
  `);
}

async function lockActiveProfessionalSeat(
  transaction: Prisma.TransactionClient,
  professionalId: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "lotacao_sede"
    WHERE "profissional_id" = ${professionalId}::uuid AND "data_fim" IS NULL
    ORDER BY "id" FOR UPDATE
  `);
}

async function loadSeatRemovalState(
  transaction: Prisma.TransactionClient,
  input: ManualSeatRemovalInput,
  lock: boolean,
): Promise<{
  placement: ProfessionalPayload['lotacoesSede'][number];
  position: PositionAvailabilityPayload;
  professional: ProfessionalPayload;
}> {
  if (lock) await lockProfessionals(transaction, [input.profissionalId]);
  let professional = await loadProfessional(transaction, input.profissionalId);
  let placement = professional.lotacoesSede.find(({ id }) => id === input.lotacaoSedeId);
  if (!placement) seatChanged();

  if (lock) {
    await lockActiveProfessionalSeat(transaction, input.profissionalId);
    await lockActiveProfessionalExercises(transaction, input.profissionalId);
    await lockPositions(transaction, [
      placement.postoTrabalhoId,
      ...professional.exercicios.map(({ postoTrabalhoId }) => postoTrabalhoId),
    ]);
    await lockActivePositionExercises(transaction, placement.postoTrabalhoId);
    professional = await loadProfessional(transaction, input.profissionalId);
    placement = professional.lotacoesSede.find(({ id }) => id === input.lotacaoSedeId);
    if (!placement) seatChanged();
  }

  const position = await loadPosition(transaction, placement.postoTrabalhoId);
  const occupantId = position.exercicios[0]?.profissionalId;
  if (lock && occupantId) await lockProfessionals(transaction, [occupantId]);
  return { placement, position, professional };
}

async function loadExerciseEndState(
  transaction: Prisma.TransactionClient,
  input: ManualExerciseEndInput,
  lock: boolean,
): Promise<{
  exercise: ProfessionalPayload['exercicios'][number];
  officialPosition: PositionAvailabilityPayload | null;
  placement: ProfessionalPayload['lotacoesSede'][number] | null;
  professional: ProfessionalPayload;
}> {
  if (lock) await lockProfessionals(transaction, [input.profissionalId]);
  let professional = await loadProfessional(transaction, input.profissionalId);
  let exercise = professional.exercicios.find(({ id }) => id === input.exercicioId);
  if (!exercise) exerciseChanged();

  if (lock) {
    await lockActiveProfessionalExercises(transaction, input.profissionalId);
    await lockActiveProfessionalSeat(transaction, input.profissionalId);
    professional = await loadProfessional(transaction, input.profissionalId);
    exercise = professional.exercicios.find(({ id }) => id === input.exercicioId);
    if (!exercise) exerciseChanged();
  }

  const placement = professional.lotacoesSede[0] ?? null;
  if (lock) {
    await lockPositions(transaction, [
      exercise.postoTrabalhoId,
      ...(placement ? [placement.postoTrabalhoId] : []),
    ]);
    if (placement) await lockActivePositionExercises(transaction, placement.postoTrabalhoId);
  }

  const officialPosition = placement
    ? await loadPosition(transaction, placement.postoTrabalhoId)
    : null;
  const occupantId = officialPosition?.exercicios[0]?.profissionalId;
  if (lock && occupantId && occupantId !== input.profissionalId) {
    await lockProfessionals(transaction, [occupantId]);
  }
  return { exercise, officialPosition, placement, professional };
}

function simulateSeatRemoval(input: {
  placement: ProfessionalPayload['lotacoesSede'][number];
  position: PositionAvailabilityPayload;
  professional: ProfessionalPayload;
}): ManualSeatRemovalSimulation {
  return {
    exercicioAtual: input.professional.exercicios[0]
      ? mapAdministrativeExercise(input.professional.exercicios[0] as AdministrativeExerciseSource)
      : null,
    ocupanteAtual: mapWorkPosition(input.position).ocupanteAtual,
    profissional: mapAdministrativeProfessional(input.professional),
    sedeAtual: mapAdministrativeSeat(input.placement as AdministrativeSeatSource),
  };
}

function simulateExerciseEnd(input: {
  exercise: ProfessionalPayload['exercicios'][number];
  officialPosition: PositionAvailabilityPayload | null;
  placement: ProfessionalPayload['lotacoesSede'][number] | null;
  professional: ProfessionalPayload;
}): ManualExerciseEndSimulation {
  const otherExternalExercises = input.professional.exercicios.filter(
    ({ id, postoTrabalhoId }) =>
      id !== input.exercise.id && postoTrabalhoId !== input.placement?.postoTrabalhoId,
  );
  const shouldReturnToSeat = Boolean(
    input.placement &&
    input.professional.afastamentos.length === 0 &&
    otherExternalExercises.length === 0,
  );
  const seatExercise = input.officialPosition?.exercicios[0];
  const seatOccupiedByAnotherProfessional = Boolean(
    shouldReturnToSeat &&
    seatExercise &&
    seatExercise.id !== input.exercise.id &&
    seatExercise.profissionalId !== input.professional.id,
  );
  const impedimento = seatOccupiedByAnotherProfessional
    ? 'Não é possível encerrar este exercício porque a sede oficial do profissional ainda está ocupada por outro profissional.'
    : null;
  const situacaoPrevista = !input.placement
    ? 'PERMANECE_SEM_SEDE'
    : input.professional.afastamentos.length > 0
      ? 'PERMANECE_AFASTADO'
      : otherExternalExercises.length > 0
        ? 'PERMANECE_EM_OUTRO_EXERCICIO'
        : 'RETORNA_A_PROPRIA_SEDE';
  return {
    exercicioAtual: mapAdministrativeExercise(input.exercise as AdministrativeExerciseSource),
    impedimento,
    podeConfirmar: !impedimento,
    postoOcupado: mapAdministrativePosition(input.exercise as AdministrativeExerciseSource),
    profissional: mapAdministrativeProfessional(input.professional),
    sedeAtual: input.placement
      ? mapAdministrativeSeat(input.placement as AdministrativeSeatSource)
      : null,
    situacaoPrevista,
  };
}

function assertEndAfterStart(end: Date, start: Date): void {
  if (end <= start) {
    throw new HttpError(
      409,
      'INVALID_ASSIGNMENT_DATE',
      'A data da atribuição deve ser posterior ao início do vínculo atual.',
    );
  }
}

async function analyze(
  transaction: Prisma.TransactionClient,
  input: ManualAssignmentInput,
  user: AuthenticatedUser,
): Promise<{
  destinationHolderId: string | null;
  professionalPayload: ProfessionalPayload;
  simulation: ManualAssignmentSimulation;
}> {
  const [professional, destinationPayload] = await Promise.all([
    loadProfessional(transaction, input.profissionalId),
    loadPosition(transaction, input.postoTrabalhoId),
  ]);
  assertAuthorized({
    action: AUTHORIZATION_ACTIONS.USE_MANUAL_ASSIGNMENT,
    resourceUnitIds: [destinationPayload.unidadeId],
    user,
  });
  if (!professional.ativo) {
    throw new HttpError(409, 'INACTIVE_PROFESSIONAL', 'O profissional está inativo.');
  }
  if (professional.cargoFuncaoId !== destinationPayload.cargoFuncaoId) {
    throw new HttpError(
      409,
      'INCOMPATIBLE_POSITION_CARGO',
      'O cargo do profissional é incompatível com o posto.',
    );
  }
  const destination = mapWorkPosition(destinationPayload);
  if (destinationPayload.reservadoParaEvento) {
    throw new HttpError(
      409,
      'POSITION_RESERVED_FOR_EVENT',
      'O posto está reservado para preenchimento em evento formal.',
    );
  }
  const expectedAvailability =
    input.tipoDestino === 'COM_SEDE' ? 'DISPONIVEL_COM_SEDE' : 'DISPONIVEL_SEM_SEDE';
  if (destination.disponibilidade !== expectedAvailability) {
    throw new HttpError(
      409,
      'POSITION_NO_LONGER_AVAILABLE',
      'O posto não está mais disponível para o tipo de vínculo selecionado.',
    );
  }
  if (input.tipoDestino === 'SEM_SEDE' && professional.afastamentos.length > 0) {
    throw new HttpError(
      409,
      'PROFESSIONAL_ON_ACTIVE_ABSENCE',
      'Profissional afastado não pode receber exercício temporário.',
    );
  }
  if (input.tipoDestino === 'COM_SEDE' && professional.lotacoesSede[0]) {
    const currentSeat = await loadPosition(
      transaction,
      professional.lotacoesSede[0].postoTrabalhoId,
    );
    if (currentSeat.exercicios.length > 0) {
      throw new HttpError(
        409,
        'PREVIOUS_SEAT_STILL_OCCUPIED',
        'A sede anterior ainda possui ocupante temporário.',
      );
    }
  }
  const destinationHolderId = destinationPayload.lotacoesSede[0]?.profissionalId ?? null;
  if (input.tipoDestino === 'SEM_SEDE' && !destinationHolderId) {
    throw new HttpError(
      409,
      'POSITION_NO_LONGER_AVAILABLE',
      'O posto não possui titular ativo para substituição.',
    );
  }
  return {
    destinationHolderId,
    professionalPayload: professional,
    simulation: {
      destino: destination,
      exerciciosEncerrados: mapProfessional(professional).exerciciosAtuais,
      profissional: mapProfessional(professional),
      sedeAnterior: mapProfessional(professional).sedeAtual,
      tipoDestino: input.tipoDestino,
    },
  };
}

function handleDatabaseError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P2002', 'P2004', 'P2034'].includes(error.code)) {
      throw new HttpError(
        409,
        'MANUAL_ASSIGNMENT_CONFLICT',
        'O estado funcional foi alterado por outra operação. Atualize e tente novamente.',
      );
    }
    if (['P2003', 'P2025'].includes(error.code)) {
      throw new HttpError(404, 'NOT_FOUND', 'Registro relacionado não encontrado.');
    }
  }
  throw error;
}

export function createPrismaManualAssignmentServices(
  database: DatabaseConnection,
  clock: () => Date = () => new Date(),
): ManualAssignmentServices {
  const { client } = database;
  return {
    configuration: {
      async get(user) {
        assertManualRole(user);
        return configuration(client);
      },
      async update(habilitada, user) {
        assertAuthorized({
          action: AUTHORIZATION_ACTIONS.MANAGE_MANUAL_ASSIGNMENT_CONFIG,
          user,
        });
        const stored = await client.configuracaoSistema.upsert({
          create: { chave: CONFIGURATION_KEY, valorBooleano: habilitada },
          update: { valorBooleano: habilitada },
          where: { chave: CONFIGURATION_KEY },
        });
        return { habilitada: stored.valorBooleano };
      },
    },
    async confirm(input, user) {
      try {
        return await client.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(Prisma.sql`
              SELECT "chave" FROM "configuracao_sistema"
              WHERE "chave" = ${CONFIGURATION_KEY} FOR UPDATE
            `);
            await assertEnabled(transaction, user);
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
              input.profissionalId,
              ...(initialHolderId ? [initialHolderId] : []),
            ]);
            const initialProfessional = await loadProfessional(transaction, input.profissionalId);
            await lockPositions(transaction, [
              input.postoTrabalhoId,
              ...initialProfessional.lotacoesSede.map(({ postoTrabalhoId }) => postoTrabalhoId),
              ...initialProfessional.exercicios.map(({ postoTrabalhoId }) => postoTrabalhoId),
            ]);
            const analysis = await analyze(transaction, input, user);
            if (
              input.tipoDestino === 'SEM_SEDE' &&
              analysis.destinationHolderId !== initialHolderId
            ) {
              throw new HttpError(
                409,
                'MANUAL_ASSIGNMENT_CONFLICT',
                'A titularidade do destino foi alterada.',
              );
            }
            const now = clock();
            for (const exercise of analysis.professionalPayload.exercicios) {
              assertEndAfterStart(now, exercise.dataInicio);
              await transaction.exercicioProfissional.update({
                data: { dataFim: now },
                where: { id: exercise.id },
              });
            }
            let recordId: string;
            if (input.tipoDestino === 'COM_SEDE') {
              const oldPlacement = analysis.professionalPayload.lotacoesSede[0];
              if (oldPlacement) {
                assertEndAfterStart(now, oldPlacement.dataInicio);
                await transaction.lotacaoSede.update({
                  data: { dataFim: now, motivoFim: 'Atribuição manual de implantação' },
                  where: { id: oldPlacement.id },
                });
              }
              const created = await transaction.lotacaoSede.create({
                data: {
                  dataInicio: now,
                  postoTrabalhoId: input.postoTrabalhoId,
                  profissionalId: input.profissionalId,
                },
              });
              recordId = created.id;
            } else {
              const created = await transaction.exercicioProfissional.create({
                data: {
                  dataInicio: now,
                  observacoes: 'Atribuição manual de implantação',
                  postoTrabalhoId: input.postoTrabalhoId,
                  profissionalId: input.profissionalId,
                  substituiProfissionalId: analysis.destinationHolderId,
                  tipoExercicio: analysis.professionalPayload.lotacoesSede.length
                    ? 'SUBSTITUICAO'
                    : 'SEM_SEDE',
                },
              });
              recordId = created.id;
            }
            const result = { ...analysis.simulation, confirmadoEm: asIso(now) };
            if (user.perfil === 'DIRETOR') {
              await writeAudit(transaction, {
                acao: 'CREATE',
                after: result,
                entidade: 'ATRIBUICAO_MANUAL',
                profissionalId: input.profissionalId,
                registroId: recordId,
                unidadeId: analysis.simulation.destino.unidadeId,
                usuarioId: user.id,
              });
            }
            return result;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    async endExercise(input, user) {
      try {
        await client.$transaction(
          async (transaction) => {
            assertAdministrativeRole(user);
            const state = await loadExerciseEndState(transaction, input, true);
            const simulation = simulateExerciseEnd(state);
            if (!simulation.podeConfirmar) {
              throw new HttpError(409, 'OFFICIAL_SEAT_STILL_OCCUPIED', simulation.impedimento!);
            }
            const now = clock();
            assertEndAfterStart(now, state.exercise.dataInicio);
            const ended = await transaction.exercicioProfissional.updateMany({
              data: { dataFim: now },
              where: { dataFim: null, id: input.exercicioId, profissionalId: input.profissionalId },
            });
            if (ended.count !== 1) exerciseChanged();
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    async listPositions(query, user) {
      return client.$transaction(async (transaction) => {
        await assertAccessible(transaction, user);
        const professional = await loadProfessional(transaction, query.profissionalId);
        const unitIds = user.perfil === 'DIRETOR' ? user.unidades.map(({ id }) => id) : undefined;
        const positions = await transaction.postoTrabalho.findMany({
          include: positionAvailabilityInclude,
          orderBy: [{ unidadeId: 'asc' }, { periodoId: 'asc' }, { codigo: 'asc' }, { id: 'asc' }],
          where: {
            ativo: true,
            cargoFuncaoId: professional.cargoFuncaoId,
            reservadoParaEvento: false,
            ...(unitIds ? { unidadeId: { in: unitIds } } : {}),
          },
        });
        return positions
          .map(mapWorkPosition)
          .filter(({ disponibilidade }) =>
            query.tipoDestino
              ? disponibilidade ===
                (query.tipoDestino === 'COM_SEDE' ? 'DISPONIVEL_COM_SEDE' : 'DISPONIVEL_SEM_SEDE')
              : ['DISPONIVEL_COM_SEDE', 'DISPONIVEL_SEM_SEDE'].includes(disponibilidade),
          );
      });
    },
    async listProfessionals(query, user) {
      return client.$transaction(async (transaction) => {
        await assertAccessible(transaction, user);
        const where: Prisma.ProfissionalWhereInput = query.busca
          ? {
              OR: [
                { nomeCompleto: { contains: query.busca, mode: 'insensitive' } },
                { matricula: { contains: query.busca, mode: 'insensitive' } },
                { cargoFuncao: { nome: { contains: query.busca, mode: 'insensitive' } } },
              ],
            }
          : {};
        const [professionals, total] = await Promise.all([
          transaction.profissional.findMany({
            include: professionalInclude,
            orderBy: [{ nomeCompleto: 'asc' }, { matricula: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          transaction.profissional.count({ where }),
        ]);
        return {
          items: professionals.map(mapProfessional),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        };
      });
    },
    async removeSeat(input, user) {
      try {
        await client.$transaction(
          async (transaction) => {
            assertAdministrativeRole(user);
            const state = await loadSeatRemovalState(transaction, input, true);
            const now = clock();
            assertEndAfterStart(now, state.placement.dataInicio);
            const ended = await transaction.lotacaoSede.updateMany({
              data: { dataFim: now, motivoFim: 'Sede retirada administrativamente' },
              where: {
                dataFim: null,
                id: input.lotacaoSedeId,
                profissionalId: input.profissionalId,
              },
            });
            if (ended.count !== 1) seatChanged();
            await transaction.postoTrabalho.update({
              data: { reservadoParaEvento: true },
              where: { id: state.placement.postoTrabalhoId },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        handleDatabaseError(error);
      }
    },
    async simulateExerciseEnd(input, user) {
      return client.$transaction(async (transaction) => {
        assertAdministrativeRole(user);
        return simulateExerciseEnd(await loadExerciseEndState(transaction, input, false));
      });
    },
    async simulateSeatRemoval(input, user) {
      return client.$transaction(async (transaction) => {
        assertAdministrativeRole(user);
        return simulateSeatRemoval(await loadSeatRemovalState(transaction, input, false));
      });
    },
    async simulate(input, user) {
      return client.$transaction(async (transaction) => {
        await assertEnabled(transaction, user);
        return (await analyze(transaction, input, user)).simulation;
      });
    },
  };
}
