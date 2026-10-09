import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Pool, type PoolClient } from 'pg';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeDatabase = databaseTestUrl ? describe : describe.skip;
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

const domainTables = [
  'auditoria',
  'movimentacao_item',
  'movimentacao',
  'evento_participante',
  'evento',
  'sessao_usuario',
  'usuario_identificador',
  'usuario_unidade',
  'usuario',
  'afastamento_profissional',
  'exercicio_profissional_limite_ativo',
  'exercicio_profissional',
  'lotacao_sede',
  'posto_trabalho',
  'quadro_necessidade',
  'profissional_telefone',
  'profissional',
  'segmento_ensino',
  'unidade_telefone',
  'unidade',
] as const;

interface BaseGraph {
  cargoId: string;
  periodoId: string;
  postoIds: [string, string];
  quadroId: string;
  segmentoId: string;
  tipoUnidadeId: string;
  unidadeId: string;
}

interface PostgresError extends Error {
  code?: string;
  column?: string;
  constraint?: string;
}

function assertSafeTestDatabase(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  const isNamedAsTest = parsed.pathname.toLowerCase().includes('test');
  const explicitlyAllowed = process.env.DATABASE_TEST_ALLOW_RESET === 'true';
  const safeByConvention = isLocal && isNamedAsTest;

  if (!safeByConvention && !explicitlyAllowed) {
    throw new Error(
      'Refusing to use DATABASE_TEST_URL. Use a local database named as test or set DATABASE_TEST_ALLOW_RESET=true explicitly.',
    );
  }
}

async function expectConstraint(
  operation: Promise<unknown>,
  constraint: string,
  code = '23505',
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected PostgreSQL constraint ${constraint} to reject the operation.`);
  } catch (error) {
    expect(error as PostgresError).toMatchObject({ code, constraint });
  }
}

describe('database test reset protection', () => {
  const originalAllowReset = process.env.DATABASE_TEST_ALLOW_RESET;

  afterEach(() => {
    if (originalAllowReset === undefined) {
      delete process.env.DATABASE_TEST_ALLOW_RESET;
    } else {
      process.env.DATABASE_TEST_ALLOW_RESET = originalAllowReset;
    }
  });

  it('allows a local database named as test by convention', () => {
    delete process.env.DATABASE_TEST_ALLOW_RESET;

    expect(() =>
      assertSafeTestDatabase('postgresql://user:pass@localhost:5432/seduc_test'),
    ).not.toThrow();
  });

  it('rejects a database outside the safe convention without explicit override', () => {
    delete process.env.DATABASE_TEST_ALLOW_RESET;

    expect(() => assertSafeTestDatabase('postgresql://user:pass@database:5432/seduc_test')).toThrow(
      'Refusing to use DATABASE_TEST_URL',
    );
  });

  it('allows an explicit reset override for Docker or CI', () => {
    process.env.DATABASE_TEST_ALLOW_RESET = 'true';

    expect(() =>
      assertSafeTestDatabase('postgresql://user:pass@database:5432/seduc_integration'),
    ).not.toThrow();
  });
});

describeDatabase('Etapa 1 database schema', () => {
  let pool: Pool;

  beforeAll(async () => {
    if (!databaseTestUrl) {
      throw new Error('DATABASE_TEST_URL is required for database integration tests.');
    }

    assertSafeTestDatabase(databaseTestUrl);

    const maintenancePool = new Pool({
      connectionString: databaseTestUrl,
      max: 1,
    });

    try {
      await maintenancePool.query('DROP SCHEMA public CASCADE');
      await maintenancePool.query('CREATE SCHEMA public');
    } finally {
      await maintenancePool.end();
    }

    const prismaCli = fileURLToPath(
      new URL('../../node_modules/prisma/build/index.js', import.meta.url),
    );

    execFileSync(
      process.execPath,
      [prismaCli, 'migrate', 'deploy', '--config', 'prisma7.config.ts'],
      {
        cwd: packageRoot,
        env: {
          ...process.env,
          DATABASE_URL: databaseTestUrl,
        },
        stdio: 'pipe',
      },
    );

    pool = new Pool({
      connectionString: databaseTestUrl,
      max: 3,
    });
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    const quotedTables = domainTables.map((table) => `"${table}"`).join(', ');
    await pool.query(`TRUNCATE TABLE ${quotedTables} CASCADE`);
  });

  async function createBaseGraph(cargoId = 'PEB1_FUNDAMENTAL'): Promise<BaseGraph> {
    const unidadeId = randomUUID();
    const tipoUnidadeId = 'EMEF';
    const periodoId = 'INTEGRAL';
    const segmentoId = randomUUID();
    const quadroId = randomUUID();
    const postoIds: [string, string] = [randomUUID(), randomUUID()];

    await pool.query(
      'INSERT INTO "unidade" ("id", "tipo_unidade_id", "nome") VALUES ($1, $2, $3)',
      [unidadeId, tipoUnidadeId, `Unidade ${unidadeId}`],
    );
    await pool.query('INSERT INTO "segmento_ensino" ("id", "nome") VALUES ($1, $2)', [
      segmentoId,
      `Segmento ${segmentoId}`,
    ]);
    await pool.query(
      `INSERT INTO "quadro_necessidade"
        ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "segmento_ensino_id", "quantidade")
       VALUES ($1, $2, 2027, $3, $4, $5, 2)`,
      [quadroId, unidadeId, cargoId, periodoId, segmentoId],
    );

    for (const [index, postoId] of postoIds.entries()) {
      await pool.query(
        `INSERT INTO "posto_trabalho"
          ("id", "quadro_necessidade_id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo", "codigo")
         VALUES ($1, $2, $3, $4, $5, 2027, $6)`,
        [postoId, quadroId, unidadeId, cargoId, periodoId, `P-${index + 1}`],
      );
    }

    return {
      cargoId,
      periodoId,
      postoIds,
      quadroId,
      segmentoId,
      tipoUnidadeId,
      unidadeId,
    };
  }

  async function createProfessional(
    cargoId: string,
    matricula: string,
    cpf = '12345678901',
  ): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO "profissional"
        ("id", "matricula", "nome_completo", "cpf", "cargo_funcao_id", "data_entrada_prefeitura", "data_nascimento")
       VALUES ($1, $2, $3, $4, $5, DATE '2020-02-03', DATE '1980-04-05')`,
      [id, matricula, `Profissional ${matricula}`, cpf, cargoId],
    );
    return id;
  }

  it('applies every migration to a clean PostgreSQL database', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const migratedTables = new Set(result.rows.map(({ table_name }) => table_name));

    for (const table of domainTables) {
      expect(migratedTables.has(table)).toBe(true);
    }
    for (const removedTable of ['tipo_unidade', 'cargo_funcao', 'cargo_tipo_unidade', 'periodo']) {
      expect(migratedTables.has(removedTable)).toBe(false);
    }
    expect(migratedTables.has('_prisma_migrations')).toBe(true);

    const migrations = await pool.query<{ migration_name: string }>(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    expect(migrations.rows.map(({ migration_name }) => migration_name)).toEqual(
      expect.arrayContaining([
        '20261001000000_banco_base',
        '20261001120000_autenticacao_sessoes',
        '20261001160000_usuario_identificador_unico',
        '20261002120000_diretor_multiplas_unidades',
        '20261005110000_quadro_quantidade_zero',
        '20261009110000_dominios_estruturais_codigo',
        '20261009111000_periodos_estruturais_codigo',
        '20261009112000_tipos_unidade_adicionais_codigo',
      ]),
    );
  });

  it('allows zero staffing quantity and rejects negative values', async () => {
    const graph = await createBaseGraph();
    await pool.query(
      `INSERT INTO "quadro_necessidade"
        ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "quantidade")
       VALUES ($1, $2, 2098, $3, $4, 0)`,
      [randomUUID(), graph.unidadeId, graph.cargoId, graph.periodoId],
    );

    await expectConstraint(
      pool.query(
        `INSERT INTO "quadro_necessidade"
          ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "quantidade")
         VALUES ($1, $2, 2099, $3, $4, -1)`,
        [randomUUID(), graph.unidadeId, graph.cargoId, graph.periodoId],
      ),
      'quadro_necessidade_quantidade_check',
      '23514',
    );
  });

  it('keeps login and email in one unique identifier namespace', async () => {
    await pool.query(
      `INSERT INTO "usuario" ("id", "nome", "login", "email", "senha_hash", "perfil")
       VALUES ($1, 'Usuário existente', 'identificador.login', 'identificador@email.test',
               '$2b$12$hash-de-teste', 'ADMINISTRADOR')`,
      [randomUUID()],
    );

    await expectConstraint(
      pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "email", "senha_hash", "perfil")
         VALUES ($1, 'Conflito pelo login', 'identificador@email.test', 'outro@email.test',
                 '$2b$12$hash-de-teste', 'ADMINISTRADOR')`,
        [randomUUID()],
      ),
      'usuario_identificador_namespace_key',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "email", "senha_hash", "perfil")
         VALUES ($1, 'Conflito pelo email', 'outro.login', 'identificador.login',
                 '$2b$12$hash-de-teste', 'ADMINISTRADOR')`,
        [randomUUID()],
      ),
      'usuario_identificador_namespace_key',
    );
  });

  it('rejects concurrent cross-field identifier conflicts', async () => {
    const results = await Promise.allSettled([
      pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "email", "senha_hash", "perfil")
         VALUES ($1, 'Concorrente A', 'concorrente-a', 'identificador-concorrente',
                 '$2b$12$hash-de-teste', 'ADMINISTRADOR')`,
        [randomUUID()],
      ),
      pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "email", "senha_hash", "perfil")
         VALUES ($1, 'Concorrente B', 'identificador-concorrente', 'concorrente-b@email.test',
                 '$2b$12$hash-de-teste', 'ADMINISTRADOR')`,
        [randomUUID()],
      ),
    ]);
    const fulfilled = results.filter(({ status }) => status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason as PostgresError).toMatchObject({
      code: '23505',
      constraint: 'usuario_identificador_namespace_key',
    });
  });

  it('requires password hashes and protects persisted sessions with unique tokens and foreign keys', async () => {
    const usuarioId = randomUUID();
    const tokenHash = 'a'.repeat(64);

    try {
      await pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "perfil")
         VALUES ($1, 'Sem senha', $2, 'ADMINISTRADOR')`,
        [randomUUID(), `sem-senha-${randomUUID()}`],
      );
      throw new Error('Expected usuario.senha_hash to reject NULL.');
    } catch (error) {
      expect(error as PostgresError).toMatchObject({ code: '23502', column: 'senha_hash' });
    }

    await pool.query(
      `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
       VALUES ($1, 'Administrador', $2, '$2b$12$hash-de-teste', 'ADMINISTRADOR')`,
      [usuarioId, `admin-${usuarioId}`],
    );
    await pool.query(
      `INSERT INTO "sessao_usuario" ("id", "usuario_id", "token_hash", "expira_em")
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
      [randomUUID(), usuarioId, tokenHash],
    );

    await expectConstraint(
      pool.query(
        `INSERT INTO "sessao_usuario" ("id", "usuario_id", "token_hash", "expira_em")
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
        [randomUUID(), usuarioId, tokenHash],
      ),
      'sessao_usuario_token_hash_key',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "sessao_usuario" ("id", "usuario_id", "token_hash", "expira_em")
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
        [randomUUID(), randomUUID(), 'b'.repeat(64)],
      ),
      'sessao_usuario_usuario_id_fkey',
      '23503',
    );
  });

  it('creates all active-record and staffing-scope partial unique indexes', async () => {
    const expectedIndexes = new Map([
      ['lotacao_sede_profissional_ativa_key', 'WHERE (data_fim IS NULL)'],
      ['lotacao_sede_posto_ativo_key', 'WHERE (data_fim IS NULL)'],
      ['exercicio_profissional_posto_ativo_key', 'WHERE (data_fim IS NULL)'],
      ['quadro_necessidade_escopo_com_segmento_key', 'WHERE (segmento_ensino_id IS NOT NULL)'],
      ['quadro_necessidade_escopo_sem_segmento_key', 'WHERE (segmento_ensino_id IS NULL)'],
    ]);
    const result = await pool.query<{ indexdef: string; indexname: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [[...expectedIndexes.keys()]],
    );

    expect(result.rows).toHaveLength(expectedIndexes.size);
    for (const index of result.rows) {
      expect(index.indexdef).toContain('UNIQUE INDEX');
      expect(index.indexdef).toContain(expectedIndexes.get(index.indexname));
    }

    const removedIndex = await pool.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'exercicio_profissional_profissional_ativo_key'`,
    );
    expect(removedIndex.rowCount).toBe(0);
  });

  it('uses DATE for civil dates and TIMESTAMPTZ for administrative timestamps', async () => {
    const result = await pool.query<{ column_name: string; data_type: string; table_name: string }>(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE (table_name = 'profissional' AND column_name IN ('data_nascimento', 'data_entrada_prefeitura'))
          OR (table_name = 'auditoria' AND column_name = 'data_hora')
          OR (table_name = 'lotacao_sede' AND column_name IN ('data_inicio', 'data_fim'))`,
    );
    const types = new Map(
      result.rows.map(({ table_name, column_name, data_type }) => [
        `${table_name}.${column_name}`,
        data_type,
      ]),
    );

    expect(types.get('profissional.data_nascimento')).toBe('date');
    expect(types.get('profissional.data_entrada_prefeitura')).toBe('date');
    expect(types.get('auditoria.data_hora')).toBe('timestamp with time zone');
    expect(types.get('lotacao_sede.data_inicio')).toBe('timestamp with time zone');
    expect(types.get('lotacao_sede.data_fim')).toBe('timestamp with time zone');
  });

  it('does not add current placement fields or an independent vacancy table', async () => {
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'profissional'`,
    );
    const names = columns.rows.map(({ column_name }) => column_name);
    const vacancyTable = await pool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'vaga'`,
    );

    expect(names).not.toContain('sede');
    expect(names).not.toContain('sede_anterior');
    expect(names).not.toContain('unidade_atual');
    expect(names).not.toContain('exercicio_atual');
    expect(vacancyTable.rowCount).toBe(0);
  });

  it('defaults score to zero and functional flags to false', async () => {
    const { cargoId } = await createBaseGraph();
    const profissionalId = await createProfessional(cargoId, 'MAT-DEFAULTS');
    const result = await pool.query<{
      permuta: boolean;
      pontuacao: string;
      remocao: boolean;
    }>('SELECT "pontuacao", "remocao", "permuta" FROM "profissional" WHERE "id" = $1', [
      profissionalId,
    ]);

    expect(Number(result.rows[0]?.pontuacao)).toBe(0);
    expect(result.rows[0]?.remocao).toBe(false);
    expect(result.rows[0]?.permuta).toBe(false);
  });

  it('enforces staffing-scope uniqueness with and without a segment', async () => {
    const graph = await createBaseGraph();

    await pool.query(
      `INSERT INTO "quadro_necessidade"
        ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "quantidade")
       VALUES ($1, $2, 2027, $3, $4, 1)`,
      [randomUUID(), graph.unidadeId, graph.cargoId, graph.periodoId],
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "quadro_necessidade"
          ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "quantidade")
         VALUES ($1, $2, 2027, $3, $4, 1)`,
        [randomUUID(), graph.unidadeId, graph.cargoId, graph.periodoId],
      ),
      'quadro_necessidade_escopo_sem_segmento_key',
    );

    await expectConstraint(
      pool.query(
        `INSERT INTO "quadro_necessidade"
          ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "segmento_ensino_id", "quantidade")
         VALUES ($1, $2, 2027, $3, $4, $5, 1)`,
        [randomUUID(), graph.unidadeId, graph.cargoId, graph.periodoId, graph.segmentoId],
      ),
      'quadro_necessidade_escopo_com_segmento_key',
    );

    const segundoSegmentoId = randomUUID();
    await pool.query('INSERT INTO "segmento_ensino" ("id", "nome") VALUES ($1, $2)', [
      segundoSegmentoId,
      `Segmento ${segundoSegmentoId}`,
    ]);
    await pool.query(
      `INSERT INTO "quadro_necessidade"
        ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "segmento_ensino_id", "quantidade")
       VALUES ($1, $2, 2027, $3, $4, $5, 1)`,
      [randomUUID(), graph.unidadeId, graph.cargoId, graph.periodoId, segundoSegmentoId],
    );

    const result = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM "quadro_necessidade"
       WHERE "unidade_id" = $1
         AND "ano_letivo" = 2027
         AND "cargo_funcao_id" = $2
         AND "periodo_id" = $3`,
      [graph.unidadeId, graph.cargoId, graph.periodoId],
    );
    expect(Number(result.rows[0]?.total)).toBe(3);
  });

  it('enforces structural codes, including CMEA and Centro de Inclusão', async () => {
    await pool.query(
      'INSERT INTO "unidade" ("id", "tipo_unidade_id", "nome") VALUES ($1, $2, $3), ($4, $5, $6)',
      [randomUUID(), 'CMEA', 'CMEA', randomUUID(), 'CENTRO_DE_INCLUSAO', 'Centro de Inclusão'],
    );
    await expectConstraint(
      pool.query('INSERT INTO "unidade" ("id", "tipo_unidade_id", "nome") VALUES ($1, $2, $3)', [
        randomUUID(),
        'TIPO_INEXISTENTE',
        'Inválida',
      ]),
      'unidade_tipo_unidade_codigo_check',
      '23514',
    );
    const graph = await createBaseGraph();
    await expectConstraint(
      pool.query(
        `INSERT INTO "quadro_necessidade"
          ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "quantidade")
         VALUES ($1, $2, 2088, 'CARGO_INEXISTENTE', $3, 0)`,
        [randomUUID(), graph.unidadeId, graph.periodoId],
      ),
      'quadro_necessidade_cargo_funcao_codigo_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "quadro_necessidade"
          ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "quantidade")
         VALUES ($1, $2, 2089, $3, 'PERIODO_INEXISTENTE', 0)`,
        [randomUUID(), graph.unidadeId, graph.cargoId],
      ),
      'quadro_necessidade_periodo_codigo_check',
      '23514',
    );
  });

  it('rejects an invalid CPF format', async () => {
    const { cargoId } = await createBaseGraph();

    await expectConstraint(
      createProfessional(cargoId, 'MAT-CPF-INVALIDO', '1234567890A'),
      'profissional_cpf_formato_check',
      '23514',
    );
  });

  it('rejects a negative number of children', async () => {
    const { cargoId } = await createBaseGraph();
    const profissionalId = await createProfessional(cargoId, 'MAT-FILHOS');

    await expectConstraint(
      pool.query('UPDATE "profissional" SET "numero_filhos" = -1 WHERE "id" = $1', [
        profissionalId,
      ]),
      'profissional_numero_filhos_check',
      '23514',
    );
  });

  it('rejects final dates that are not after their corresponding initial dates', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const profissionalId = await createProfessional(cargoId, 'MAT-DATAS');

    await expectConstraint(
      pool.query(
        `UPDATE "profissional"
         SET "data_desligamento" = DATE '2019-12-31'
         WHERE "id" = $1`,
        [profissionalId],
      ),
      'profissional_datas_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "lotacao_sede"
          ("id", "profissional_id", "posto_trabalho_id", "data_inicio", "data_fim")
         VALUES ($1, $2, $3, TIMESTAMPTZ '2027-02-02 12:00:00Z', TIMESTAMPTZ '2027-02-01 12:00:00Z')`,
        [randomUUID(), profissionalId, postoIds[0]],
      ),
      'lotacao_sede_periodo_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio", "data_inicio", "data_fim")
         VALUES ($1, $2, $3, 'SEDE', TIMESTAMPTZ '2027-02-02 12:00:00Z', TIMESTAMPTZ '2027-02-02 12:00:00Z')`,
        [randomUUID(), profissionalId, postoIds[0]],
      ),
      'exercicio_profissional_periodo_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "afastamento_profissional"
          ("id", "profissional_id", "tipo", "data_inicio", "data_fim")
         VALUES ($1, $2, 'LICENCA', TIMESTAMPTZ '2027-02-02 12:00:00Z', TIMESTAMPTZ '2027-02-01 12:00:00Z')`,
        [randomUUID(), profissionalId],
      ),
      'afastamento_profissional_periodo_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "evento"
          ("id", "tipo", "nome", "ano", "cargo_funcao_id", "data_inicio", "data_fim")
         VALUES ($1, 'REMOCAO', 'Evento com datas invalidas', 2027, $2,
                 TIMESTAMPTZ '2027-02-02 12:00:00Z', TIMESTAMPTZ '2027-02-01 12:00:00Z')`,
        [randomUUID(), cargoId],
      ),
      'evento_periodo_check',
      '23514',
    );
  });

  it('enforces unique functional registration', async () => {
    const { cargoId } = await createBaseGraph();
    await createProfessional(cargoId, 'MAT-UNICA', '11111111111');

    await expectConstraint(
      createProfessional(cargoId, 'MAT-UNICA', '22222222222'),
      'profissional_matricula_key',
    );
  });

  it('allows the same CPF in different functional registrations', async () => {
    const { cargoId } = await createBaseGraph();
    await createProfessional(cargoId, 'MAT-CPF-1', '33333333333');
    await createProfessional(cargoId, 'MAT-CPF-2', '33333333333');
    const result = await pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM "profissional" WHERE "cpf" = $1',
      ['33333333333'],
    );

    expect(Number(result.rows[0]?.total)).toBe(2);
  });

  it('requires a linked unit for directors and school secretaries', async () => {
    await expectConstraint(
      pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
         VALUES ($1, 'Diretor sem unidade', $2, '$2b$12$hash-de-teste', 'DIRETOR')`,
        [randomUUID(), `diretor-${randomUUID()}`],
      ),
      'usuario_unidade_cardinalidade_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
         VALUES ($1, 'Secretario sem unidade', $2, '$2b$12$hash-de-teste', 'SECRETARIO')`,
        [randomUUID(), `secretario-${randomUUID()}`],
      ),
      'usuario_unidade_cardinalidade_check',
      '23514',
    );
  });

  it('allows multiple units for directors and exactly one for school secretaries', async () => {
    const graph = await createBaseGraph();
    const secondUnitId = randomUUID();
    const directorId = randomUUID();
    const secretaryId = randomUUID();
    const client = await pool.connect();

    await pool.query(
      'INSERT INTO "unidade" ("id", "tipo_unidade_id", "nome") VALUES ($1, $2, $3)',
      [secondUnitId, graph.tipoUnidadeId, `Unidade ${secondUnitId}`],
    );

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
         VALUES ($1, 'Diretor multiunidade', $2, '$2b$12$hash-de-teste', 'DIRETOR')`,
        [directorId, `diretor-${directorId}`],
      );
      await client.query(
        `INSERT INTO "usuario_unidade" ("usuario_id", "unidade_id")
         VALUES ($1, $2), ($1, $3)`,
        [directorId, graph.unidadeId, secondUnitId],
      );
      await client.query('COMMIT');

      await client.query('BEGIN');
      await client.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
         VALUES ($1, 'Secretário unidade única', $2, '$2b$12$hash-de-teste', 'SECRETARIO')`,
        [secretaryId, `secretario-${secretaryId}`],
      );
      await client.query(
        `INSERT INTO "usuario_unidade" ("usuario_id", "unidade_id")
         VALUES ($1, $2)`,
        [secretaryId, graph.unidadeId],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const result = await pool.query<{ perfil: string; total: string }>(
      `SELECT usuario."perfil"::text AS perfil, COUNT(vinculo."unidade_id") AS total
       FROM "usuario" usuario
       LEFT JOIN "usuario_unidade" vinculo ON vinculo."usuario_id" = usuario."id"
       WHERE usuario."id" = ANY($1::uuid[])
       GROUP BY usuario."id", usuario."perfil"
       ORDER BY usuario."perfil"`,
      [[directorId, secretaryId]],
    );

    expect(result.rows).toEqual([
      { perfil: 'DIRETOR', total: '2' },
      { perfil: 'SECRETARIO', total: '1' },
    ]);
  });

  it('rejects zero or multiple units for a school secretary', async () => {
    const graph = await createBaseGraph();
    const secondUnitId = randomUUID();
    const secretaryId = randomUUID();
    const client = await pool.connect();

    await pool.query(
      'INSERT INTO "unidade" ("id", "tipo_unidade_id", "nome") VALUES ($1, $2, $3)',
      [secondUnitId, graph.tipoUnidadeId, `Unidade ${secondUnitId}`],
    );

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
         VALUES ($1, 'Secretário inválido', $2, '$2b$12$hash-de-teste', 'SECRETARIO')`,
        [secretaryId, `secretario-${secretaryId}`],
      );
      await client.query(
        `INSERT INTO "usuario_unidade" ("usuario_id", "unidade_id")
         VALUES ($1, $2), ($1, $3)`,
        [secretaryId, graph.unidadeId, secondUnitId],
      );
      await expectConstraint(
        client.query('COMMIT'),
        'usuario_unidade_cardinalidade_check',
        '23514',
      );
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('enforces one active official placement per professional and per work position', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const firstProfessional = await createProfessional(cargoId, 'MAT-SEDE-1', '44444444444');
    const secondProfessional = await createProfessional(cargoId, 'MAT-SEDE-2', '55555555555');

    await pool.query(
      'INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id") VALUES ($1, $2, $3)',
      [randomUUID(), firstProfessional, postoIds[0]],
    );
    await expectConstraint(
      pool.query(
        'INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id") VALUES ($1, $2, $3)',
        [randomUUID(), firstProfessional, postoIds[1]],
      ),
      'lotacao_sede_profissional_ativa_key',
    );
    await expectConstraint(
      pool.query(
        'INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id") VALUES ($1, $2, $3)',
        [randomUUID(), secondProfessional, postoIds[0]],
      ),
      'lotacao_sede_posto_ativo_key',
    );
  });

  it('enforces one active exercise for a common cargo and one active occupant per work position', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const firstProfessional = await createProfessional(cargoId, 'MAT-EXERCICIO-1', '66666666666');
    const secondProfessional = await createProfessional(cargoId, 'MAT-EXERCICIO-2', '77777777777');

    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [randomUUID(), firstProfessional, postoIds[0]],
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
         VALUES ($1, $2, $3, 'SEDE')`,
        [randomUUID(), firstProfessional, postoIds[1]],
      ),
      'exercicio_profissional_multiplos_ativos_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
         VALUES ($1, $2, $3, 'SEDE')`,
        [randomUUID(), secondProfessional, postoIds[0]],
      ),
      'exercicio_profissional_posto_ativo_key',
    );
  });

  it('allows multiple active exercises only for the structural DIRETOR code', async () => {
    const { cargoId, postoIds } = await createBaseGraph('DIRETOR');
    const directorId = await createProfessional(cargoId, 'MAT-DIRETOR-MULTI', '77888888888');
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE'), ($4, $2, $5, 'SEDE')`,
      [randomUUID(), directorId, postoIds[0], randomUUID(), postoIds[1]],
    );

    const result = await pool.query<{ quantidade_ativa: number; total: string }>(
      `SELECT COUNT(exercicio."id") AS total, controle."quantidade_ativa"
       FROM "exercicio_profissional" exercicio
       JOIN "exercicio_profissional_limite_ativo" controle
         ON controle."profissional_id" = exercicio."profissional_id"
       WHERE exercicio."profissional_id" = $1
         AND exercicio."data_fim" IS NULL
       GROUP BY controle."quantidade_ativa"`,
      [directorId],
    );

    expect(Number(result.rows[0]?.total)).toBe(2);
    expect(result.rows[0]?.quantidade_ativa).toBe(2);
  });

  it('serializes concurrent active exercises for a common cargo', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const professionalId = await createProfessional(
      cargoId,
      'MAT-EXERCICIO-CONCORRENTE',
      '77999999999',
    );
    const firstClient = await pool.connect();
    const secondClient = await pool.connect();

    try {
      await firstClient.query('BEGIN');
      await secondClient.query('BEGIN');
      await firstClient.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
         VALUES ($1, $2, $3, 'SEDE')`,
        [randomUUID(), professionalId, postoIds[0]],
      );

      const secondInsert = secondClient.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
         VALUES ($1, $2, $3, 'SEDE')`,
        [randomUUID(), professionalId, postoIds[1]],
      );

      await firstClient.query('COMMIT');
      await expectConstraint(
        secondInsert,
        'exercicio_profissional_multiplos_ativos_check',
        '23514',
      );
      await secondClient.query('ROLLBACK');
    } finally {
      firstClient.release();
      secondClient.release();
    }

    const result = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM "exercicio_profissional"
       WHERE "profissional_id" = $1 AND "data_fim" IS NULL`,
      [professionalId],
    );
    expect(Number(result.rows[0]?.total)).toBe(1);
  });

  it('rejects a cargo change incompatible with multiple active exercises', async () => {
    const { cargoId, postoIds } = await createBaseGraph('DIRETOR');
    const commonCargoId = 'PEB1_FUNDAMENTAL';
    const professionalId = await createProfessional(
      cargoId,
      'MAT-TROCA-CARGO-MULTI',
      '78010101010',
    );

    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE'), ($4, $2, $5, 'SEDE')`,
      [randomUUID(), professionalId, postoIds[0], randomUUID(), postoIds[1]],
    );

    await expectConstraint(
      pool.query('UPDATE "profissional" SET "cargo_funcao_id" = $1 WHERE "id" = $2', [
        commonCargoId,
        professionalId,
      ]),
      'profissional_cargo_multiplos_exercicios_check',
      '23514',
    );
  });

  it.skip('tornou a capacidade de múltiplos exercícios um atributo estrutural do código', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const professionalId = await createProfessional(
      cargoId,
      'MAT-DESATIVA-CAPACIDADE',
      '78111111111',
    );

    await pool.query(
      'UPDATE "cargo_funcao" SET "permite_multiplos_exercicios" = true WHERE "id" = $1',
      [cargoId],
    );
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE'), ($4, $2, $5, 'SEDE')`,
      [randomUUID(), professionalId, postoIds[0], randomUUID(), postoIds[1]],
    );

    await expectConstraint(
      pool.query(
        'UPDATE "cargo_funcao" SET "permite_multiplos_exercicios" = false WHERE "id" = $1',
        [cargoId],
      ),
      'cargo_funcao_multiplos_exercicios_check',
      '23514',
    );
  });

  it.skip('não permite alterar concorrente a capacidade estrutural de um cargo', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const professionalId = await createProfessional(
      cargoId,
      'MAT-CONCORRE-CAPACIDADE',
      '78333333333',
    );
    const capabilityClient = await pool.connect();
    const exerciseClient = await pool.connect();

    await pool.query(
      'UPDATE "cargo_funcao" SET "permite_multiplos_exercicios" = true WHERE "id" = $1',
      [cargoId],
    );
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [randomUUID(), professionalId, postoIds[0]],
    );

    try {
      await capabilityClient.query('BEGIN');
      await exerciseClient.query('BEGIN');
      await capabilityClient.query(
        'UPDATE "cargo_funcao" SET "permite_multiplos_exercicios" = false WHERE "id" = $1',
        [cargoId],
      );
      const concurrentExercise = exerciseClient.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
         VALUES ($1, $2, $3, 'SEDE')`,
        [randomUUID(), professionalId, postoIds[1]],
      );

      await capabilityClient.query('COMMIT');
      await expectConstraint(
        concurrentExercise,
        'exercicio_profissional_multiplos_ativos_check',
        '23514',
      );
      await exerciseClient.query('ROLLBACK');
    } finally {
      capabilityClient.release();
      exerciseClient.release();
    }

    const result = await pool.query<{
      permite_multiplos_exercicios: boolean;
      quantidade_ativa: number;
    }>(
      `SELECT cargo."permite_multiplos_exercicios", controle."quantidade_ativa"
       FROM "profissional" profissional
       JOIN "cargo_funcao" cargo ON cargo."id" = profissional."cargo_funcao_id"
       JOIN "exercicio_profissional_limite_ativo" controle
         ON controle."profissional_id" = profissional."id"
       WHERE profissional."id" = $1`,
      [professionalId],
    );
    expect(result.rows[0]).toEqual({
      permite_multiplos_exercicios: false,
      quantidade_ativa: 1,
    });
  });

  it.skip('substitui a alteração concorrente de catálogo por códigos estruturais imutáveis', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const commonCargoId = randomUUID();
    const professionalId = await createProfessional(
      cargoId,
      'MAT-CONCORRE-TROCA-CARGO',
      '78444444444',
    );
    const cargoClient = await pool.connect();
    const exerciseClient = await pool.connect();

    await pool.query(
      'UPDATE "cargo_funcao" SET "permite_multiplos_exercicios" = true WHERE "id" = $1',
      [cargoId],
    );
    await pool.query(
      `INSERT INTO "cargo_funcao" ("id", "nome", "eh_professor", "usa_pontuacao")
       VALUES ($1, $2, false, false)`,
      [commonCargoId, `Cargo comum ${commonCargoId}`],
    );
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [randomUUID(), professionalId, postoIds[0]],
    );

    try {
      await cargoClient.query('BEGIN');
      await exerciseClient.query('BEGIN');
      await cargoClient.query('UPDATE "profissional" SET "cargo_funcao_id" = $1 WHERE "id" = $2', [
        commonCargoId,
        professionalId,
      ]);
      const concurrentExercise = exerciseClient.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
         VALUES ($1, $2, $3, 'SEDE')`,
        [randomUUID(), professionalId, postoIds[1]],
      );

      await cargoClient.query('COMMIT');
      await expectConstraint(
        concurrentExercise,
        'exercicio_profissional_multiplos_ativos_check',
        '23514',
      );
      await exerciseClient.query('ROLLBACK');
    } finally {
      cargoClient.release();
      exerciseClient.release();
    }

    const result = await pool.query<{ cargo_funcao_id: string; quantidade_ativa: number }>(
      `SELECT profissional."cargo_funcao_id", controle."quantidade_ativa"
       FROM "profissional" profissional
       JOIN "exercicio_profissional_limite_ativo" controle
         ON controle."profissional_id" = profissional."id"
       WHERE profissional."id" = $1`,
      [professionalId],
    );
    expect(result.rows[0]).toEqual({
      cargo_funcao_id: commonCargoId,
      quantidade_ativa: 1,
    });
  });

  it('cleans the active-exercise counter after closing or deleting the active record', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const professionalId = await createProfessional(cargoId, 'MAT-CICLO-LIMITE', '78222222222');
    const firstExerciseId = randomUUID();
    const secondExerciseId = randomUUID();

    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [firstExerciseId, professionalId, postoIds[0]],
    );
    await pool.query('DELETE FROM "exercicio_profissional" WHERE "id" = $1', [firstExerciseId]);
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [secondExerciseId, professionalId, postoIds[1]],
    );
    await pool.query(
      `UPDATE "exercicio_profissional"
       SET "data_fim" = "data_inicio" + INTERVAL '1 day'
       WHERE "id" = $1`,
      [secondExerciseId],
    );

    const result = await pool.query<{ quantidade_ativa: number }>(
      `SELECT "quantidade_ativa"
       FROM "exercicio_profissional_limite_ativo"
       WHERE "profissional_id" = $1`,
      [professionalId],
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]?.quantidade_ativa).toBe(0);
  });

  it('accepts valid exercise substitution combinations', async () => {
    const firstGraph = await createBaseGraph();
    const sedeProfessional = await createProfessional(
      firstGraph.cargoId,
      'MAT-EXERCICIO-SEDE',
      '70111111111',
    );
    const replacementProfessional = await createProfessional(
      firstGraph.cargoId,
      'MAT-EXERCICIO-SUBSTITUICAO',
      '70222222222',
    );
    const replacedProfessional = await createProfessional(
      firstGraph.cargoId,
      'MAT-EXERCICIO-SUBSTITUIDO',
      '70333333333',
    );

    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [randomUUID(), sedeProfessional, firstGraph.postoIds[0]],
    );
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio", "substitui_profissional_id")
       VALUES ($1, $2, $3, 'SUBSTITUICAO', $4)`,
      [randomUUID(), replacementProfessional, firstGraph.postoIds[1], replacedProfessional],
    );

    const secondGraph = await createBaseGraph();
    const withoutSeatProfessional = await createProfessional(
      secondGraph.cargoId,
      'MAT-EXERCICIO-SEM-SEDE',
      '70444444444',
    );
    const secondReplacedProfessional = await createProfessional(
      secondGraph.cargoId,
      'MAT-EXERCICIO-SEGUNDO-SUBSTITUIDO',
      '70555555555',
    );
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio", "substitui_profissional_id")
       VALUES ($1, $2, $3, 'SEM_SEDE', $4)`,
      [randomUUID(), withoutSeatProfessional, secondGraph.postoIds[0], secondReplacedProfessional],
    );

    const result = await pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM "exercicio_profissional"',
    );
    expect(Number(result.rows[0]?.total)).toBe(3);
  });

  it('rejects inconsistent exercise substitution combinations and self-substitution', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const professional = await createProfessional(cargoId, 'MAT-EXERCICIO-REGRA', '70666666666');
    const replacedProfessional = await createProfessional(
      cargoId,
      'MAT-EXERCICIO-REGRA-SUBSTITUIDO',
      '70777777777',
    );

    await expectConstraint(
      pool.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio", "substitui_profissional_id")
         VALUES ($1, $2, $3, 'SEDE', $4)`,
        [randomUUID(), professional, postoIds[0], replacedProfessional],
      ),
      'exercicio_profissional_tipo_substituicao_check',
      '23514',
    );
    for (const tipoExercicio of ['SUBSTITUICAO', 'SEM_SEDE']) {
      await expectConstraint(
        pool.query(
          `INSERT INTO "exercicio_profissional"
            ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), professional, postoIds[0], tipoExercicio],
        ),
        'exercicio_profissional_tipo_substituicao_check',
        '23514',
      );
    }
    await expectConstraint(
      pool.query(
        `INSERT INTO "exercicio_profissional"
          ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio", "substitui_profissional_id")
         VALUES ($1, $2, $3, 'SUBSTITUICAO', $2)`,
        [randomUUID(), professional, postoIds[0]],
      ),
      'exercicio_profissional_auto_substituicao_check',
      '23514',
    );
  });

  it('accepts and rejects movement substitution combinations according to destination type', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const seatProfessional = await createProfessional(cargoId, 'MAT-MOV-SEDE', '70888888888');
    const withoutSeatProfessional = await createProfessional(
      cargoId,
      'MAT-MOV-SEM-SEDE',
      '70999999999',
    );
    const replacedProfessional = await createProfessional(
      cargoId,
      'MAT-MOV-SUBSTITUIDO',
      '71010101010',
    );
    const invalidProfessional = await createProfessional(
      cargoId,
      'MAT-MOV-INVALIDO',
      '71111111111',
    );
    const usuarioId = randomUUID();
    const eventoId = randomUUID();
    const movimentacaoId = randomUUID();

    await pool.query(
      `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
       VALUES ($1, 'Operador de teste', $2, '$2b$12$hash-de-teste', 'OPERADOR')`,
      [usuarioId, `operador-${usuarioId}`],
    );
    await pool.query(
      `INSERT INTO "evento" ("id", "tipo", "nome", "ano", "cargo_funcao_id")
       VALUES ($1, 'REMOCAO', 'Evento de teste', 2027, $2)`,
      [eventoId, cargoId],
    );
    await pool.query(
      `INSERT INTO "movimentacao" ("id", "evento_id", "usuario_id", "tipo")
       VALUES ($1, $2, $3, 'REMOCAO')`,
      [movimentacaoId, eventoId, usuarioId],
    );
    await pool.query(
      `INSERT INTO "movimentacao_item"
        ("id", "movimentacao_id", "profissional_id", "posto_destino_id", "tipo_destino")
       VALUES ($1, $2, $3, $4, 'SEDE')`,
      [randomUUID(), movimentacaoId, seatProfessional, postoIds[0]],
    );
    await pool.query(
      `INSERT INTO "movimentacao_item"
        ("id", "movimentacao_id", "profissional_id", "posto_destino_id", "tipo_destino", "substitui_profissional_id")
       VALUES ($1, $2, $3, $4, 'SEM_SEDE', $5)`,
      [randomUUID(), movimentacaoId, withoutSeatProfessional, postoIds[1], replacedProfessional],
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "movimentacao_item"
          ("id", "movimentacao_id", "profissional_id", "posto_destino_id", "tipo_destino", "substitui_profissional_id")
         VALUES ($1, $2, $3, $4, 'SEDE', $5)`,
        [randomUUID(), movimentacaoId, replacedProfessional, postoIds[0], invalidProfessional],
      ),
      'movimentacao_item_tipo_substituicao_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "movimentacao_item"
          ("id", "movimentacao_id", "profissional_id", "posto_destino_id", "tipo_destino")
         VALUES ($1, $2, $3, $4, 'SEM_SEDE')`,
        [randomUUID(), movimentacaoId, invalidProfessional, postoIds[0]],
      ),
      'movimentacao_item_tipo_substituicao_check',
      '23514',
    );

    const result = await pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM "movimentacao_item"',
    );
    expect(Number(result.rows[0]?.total)).toBe(2);
  });

  it('allows new placement and exercise records after the previous histories are closed', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const profissionalId = await createProfessional(cargoId, 'MAT-HISTORICO', '88888888888');

    await pool.query(
      'INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id") VALUES ($1, $2, $3)',
      [randomUUID(), profissionalId, postoIds[0]],
    );
    await pool.query(
      `UPDATE "lotacao_sede"
       SET "data_fim" = "data_inicio" + INTERVAL '1 day'
       WHERE "profissional_id" = $1 AND "data_fim" IS NULL`,
      [profissionalId],
    );
    await pool.query(
      'INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id") VALUES ($1, $2, $3)',
      [randomUUID(), profissionalId, postoIds[1]],
    );

    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [randomUUID(), profissionalId, postoIds[0]],
    );
    await pool.query(
      `UPDATE "exercicio_profissional"
       SET "data_fim" = "data_inicio" + INTERVAL '1 day'
       WHERE "profissional_id" = $1 AND "data_fim" IS NULL`,
      [profissionalId],
    );
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [randomUUID(), profissionalId, postoIds[1]],
    );

    const lotacoes = await pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM "lotacao_sede" WHERE "profissional_id" = $1',
      [profissionalId],
    );
    const exercicios = await pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM "exercicio_profissional" WHERE "profissional_id" = $1',
      [profissionalId],
    );
    expect(Number(lotacoes.rows[0]?.total)).toBe(2);
    expect(Number(exercicios.rows[0]?.total)).toBe(2);
  });

  it('keeps unit, code, period and work-position relations consistent', async () => {
    const graph = await createBaseGraph();
    const result = await pool.query<{
      ano_letivo: number;
      cargo_funcao_id: string;
      periodo_id: string;
      segmento_ensino_id: string;
      unidade_id: string;
    }>(
      `SELECT q."unidade_id", q."cargo_funcao_id", q."periodo_id", q."segmento_ensino_id", p."ano_letivo"
       FROM "posto_trabalho" p
       JOIN "quadro_necessidade" q ON q."id" = p."quadro_necessidade_id"
       WHERE p."id" = $1`,
      [graph.postoIds[0]],
    );

    expect(result.rows[0]).toMatchObject({
      ano_letivo: 2027,
      cargo_funcao_id: graph.cargoId,
      periodo_id: graph.periodoId,
      segmento_ensino_id: graph.segmentoId,
      unidade_id: graph.unidadeId,
    });

    await expectConstraint(
      pool.query(
        `INSERT INTO "posto_trabalho"
          ("id", "quadro_necessidade_id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo", "codigo")
         VALUES ($1, $2, $3, $4, $5, 2027, $6)`,
        [
          randomUUID(),
          graph.quadroId,
          randomUUID(),
          graph.cargoId,
          graph.periodoId,
          `INVALID-FK-${randomUUID()}`,
        ],
      ),
      'posto_trabalho_quadro_necessidade_id_unidade_id_cargo_func_fkey',
      '23503',
    );
  });

  it('does not rewrite the historical scope of linked work positions', async () => {
    const graph = await createBaseGraph();

    await expectConstraint(
      pool.query(
        `UPDATE "quadro_necessidade"
         SET "ano_letivo" = 2028
         WHERE "id" = $1`,
        [graph.quadroId],
      ),
      'posto_trabalho_quadro_necessidade_id_unidade_id_cargo_func_fkey',
      '23503',
    );

    const result = await pool.query<{ ano_letivo: number }>(
      'SELECT "ano_letivo" FROM "posto_trabalho" WHERE "id" = $1',
      [graph.postoIds[0]],
    );
    expect(result.rows[0]?.ano_letivo).toBe(2027);
  });

  it('rolls back the whole transaction when an active-placement constraint fails', async () => {
    const { cargoId, postoIds } = await createBaseGraph();
    const profissionalId = await createProfessional(cargoId, 'MAT-ROLLBACK', '99999999999');
    const client: PoolClient = await pool.connect();
    let totalAfterRollback: number | undefined;
    const lotacaoId = randomUUID();
    const lotacaoDuplicadaId = randomUUID();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id")
         VALUES ('${lotacaoId}', '${profissionalId}', '${postoIds[0]}')`,
      );
      await expectConstraint(
        client.query(
          `INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id")
           VALUES ('${lotacaoDuplicadaId}', '${profissionalId}', '${postoIds[1]}')`,
        ),
        'lotacao_sede_profissional_ativa_key',
      );
      await client.query('ROLLBACK');
      const result = await client.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM "lotacao_sede"
         WHERE "profissional_id" = '${profissionalId}'`,
      );
      totalAfterRollback = Number(result.rows[0]?.total);
    } finally {
      client.release();
    }

    expect(totalAfterRollback).toBe(0);
  });
});
