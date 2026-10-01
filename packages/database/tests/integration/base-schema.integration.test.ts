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
  'usuario',
  'afastamento_profissional',
  'exercicio_profissional',
  'lotacao_sede',
  'posto_trabalho',
  'quadro_necessidade',
  'profissional_telefone',
  'profissional',
  'segmento_ensino',
  'periodo',
  'cargo_tipo_unidade',
  'cargo_funcao',
  'unidade_telefone',
  'unidade',
  'tipo_unidade',
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

  async function createBaseGraph(): Promise<BaseGraph> {
    const tipoUnidadeId = randomUUID();
    const unidadeId = randomUUID();
    const cargoId = randomUUID();
    const periodoId = randomUUID();
    const segmentoId = randomUUID();
    const quadroId = randomUUID();
    const postoIds: [string, string] = [randomUUID(), randomUUID()];

    await pool.query('INSERT INTO "tipo_unidade" ("id", "nome") VALUES ($1, $2)', [
      tipoUnidadeId,
      `Tipo ${tipoUnidadeId}`,
    ]);
    await pool.query(
      'INSERT INTO "unidade" ("id", "tipo_unidade_id", "nome") VALUES ($1, $2, $3)',
      [unidadeId, tipoUnidadeId, `Unidade ${unidadeId}`],
    );
    await pool.query(
      'INSERT INTO "cargo_funcao" ("id", "nome", "eh_professor", "usa_pontuacao") VALUES ($1, $2, true, true)',
      [cargoId, `Cargo ${cargoId}`],
    );
    await pool.query(
      'INSERT INTO "cargo_tipo_unidade" ("cargo_funcao_id", "tipo_unidade_id") VALUES ($1, $2)',
      [cargoId, tipoUnidadeId],
    );
    await pool.query('INSERT INTO "periodo" ("id", "nome") VALUES ($1, $2)', [
      periodoId,
      `Periodo ${periodoId}`,
    ]);
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

  it('applies the initial migration to a clean PostgreSQL database', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const migratedTables = new Set(result.rows.map(({ table_name }) => table_name));

    for (const table of domainTables) {
      expect(migratedTables.has(table)).toBe(true);
    }
    expect(migratedTables.has('_prisma_migrations')).toBe(true);
  });

  it('creates all active-record and staffing-scope partial unique indexes', async () => {
    const expectedIndexes = new Map([
      ['lotacao_sede_profissional_ativa_key', 'WHERE (data_fim IS NULL)'],
      ['lotacao_sede_posto_ativo_key', 'WHERE (data_fim IS NULL)'],
      ['exercicio_profissional_profissional_ativo_key', 'WHERE (data_fim IS NULL)'],
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

  it('defaults score to zero and remocao/permuta to false', async () => {
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

  it('allows score usage only for roles marked as teachers', async () => {
    const allowedRoleId = randomUUID();
    const regularRoleId = randomUUID();

    await pool.query(
      `INSERT INTO "cargo_funcao" ("id", "nome", "eh_professor", "usa_pontuacao")
       VALUES ($1, $2, true, true), ($3, $4, false, false)`,
      [allowedRoleId, `Professor ${allowedRoleId}`, regularRoleId, `Cargo ${regularRoleId}`],
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "cargo_funcao" ("id", "nome", "eh_professor", "usa_pontuacao")
         VALUES ($1, $2, false, true)`,
        [randomUUID(), `Cargo invalido ${randomUUID()}`],
      ),
      'cargo_funcao_pontuacao_professor_check',
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
          ("id", "tipo", "nome", "ano", "data_inicio", "data_fim")
         VALUES ($1, 'REMOCAO', 'Evento com datas invalidas', 2027,
                 TIMESTAMPTZ '2027-02-02 12:00:00Z', TIMESTAMPTZ '2027-02-01 12:00:00Z')`,
        [randomUUID()],
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
        `INSERT INTO "usuario" ("id", "nome", "login", "perfil")
         VALUES ($1, 'Diretor sem unidade', $2, 'DIRETOR')`,
        [randomUUID(), `diretor-${randomUUID()}`],
      ),
      'usuario_unidade_perfil_check',
      '23514',
    );
    await expectConstraint(
      pool.query(
        `INSERT INTO "usuario" ("id", "nome", "login", "perfil")
         VALUES ($1, 'Secretario sem unidade', $2, 'SECRETARIO')`,
        [randomUUID(), `secretario-${randomUUID()}`],
      ),
      'usuario_unidade_perfil_check',
      '23514',
    );
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

  it('enforces one active exercise per professional and one active occupant per work position', async () => {
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
      'exercicio_profissional_profissional_ativo_key',
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
      `INSERT INTO "usuario" ("id", "nome", "login", "perfil")
       VALUES ($1, 'Operador de teste', $2, 'OPERADOR')`,
      [usuarioId, `operador-${usuarioId}`],
    );
    await pool.query(
      `INSERT INTO "evento" ("id", "tipo", "nome", "ano")
       VALUES ($1, 'REMOCAO', 'Evento de teste', 2027)`,
      [eventoId],
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

  it('keeps unit, role, period and work-position relations consistent', async () => {
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
       JOIN "cargo_tipo_unidade" ctu
         ON ctu."cargo_funcao_id" = q."cargo_funcao_id"
        AND ctu."tipo_unidade_id" = $1
       WHERE p."id" = $2`,
      [graph.tipoUnidadeId, graph.postoIds[0]],
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
          ("id", "quadro_necessidade_id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo")
         VALUES ($1, $2, $3, $4, $5, 2027)`,
        [randomUUID(), graph.quadroId, randomUUID(), graph.cargoId, graph.periodoId],
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
