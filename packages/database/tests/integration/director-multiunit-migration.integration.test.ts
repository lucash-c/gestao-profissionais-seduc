import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeDatabase = databaseTestUrl ? describe : describe.skip;
const legacyMigrations = [
  '20261001000000_banco_base',
  '20261001120000_autenticacao_sessoes',
  '20261001160000_usuario_identificador_unico',
] as const;
const correctionMigration = '20261002120000_diretor_multiplas_unidades';
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
}

function assertSafeTestDatabase(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  const isNamedAsTest = parsed.pathname.toLowerCase().includes('test');
  const explicitlyAllowed = process.env.DATABASE_TEST_ALLOW_RESET === 'true';

  if (!(isLocal && isNamedAsTest) && !explicitlyAllowed) {
    throw new Error('Refusing to reset a database that was not explicitly approved for tests.');
  }
}

function migrationSql(name: string): string {
  return readFileSync(
    new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url),
    'utf8',
  );
}

describeDatabase('Etapa 3 multiunit migration upgrade', () => {
  let pool: Pool;

  beforeAll(() => {
    if (!databaseTestUrl) throw new Error('DATABASE_TEST_URL is required.');
    assertSafeTestDatabase(databaseTestUrl);
    pool = new Pool({ connectionString: databaseTestUrl, max: 2 });
  });

  afterAll(async () => {
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      const prismaCli = fileURLToPath(
        new URL('../../node_modules/prisma/build/index.js', import.meta.url),
      );
      execFileSync(
        process.execPath,
        [prismaCli, 'migrate', 'deploy', '--config', 'prisma7.config.ts'],
        {
          cwd: packageRoot,
          env: { ...process.env, DATABASE_URL: databaseTestUrl },
          stdio: 'pipe',
        },
      );
    } finally {
      await pool?.end();
    }
  });

  beforeEach(async () => {
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    for (const migration of legacyMigrations) {
      await pool.query(migrationSql(migration));
    }
  }, 60_000);

  async function seedLegacyState(): Promise<{
    directorId: string;
    directorLogin: string;
    professionalId: string;
    secretaryId: string;
    sessionIds: string[];
    unitId: string;
  }> {
    const typeId = randomUUID();
    const unitId = randomUUID();
    const cargoId = randomUUID();
    const periodId = randomUUID();
    const staffingId = randomUUID();
    const workPositionId = randomUUID();
    const professionalId = randomUUID();
    const adminId = randomUUID();
    const operatorId = randomUUID();
    const directorId = randomUUID();
    const secretaryId = randomUUID();
    const directorLogin = `diretor-legado-${directorId}`;
    const sessionIds = [randomUUID(), randomUUID()];

    await pool.query('INSERT INTO "tipo_unidade" ("id", "nome") VALUES ($1, $2)', [
      typeId,
      `Tipo ${typeId}`,
    ]);
    await pool.query(
      'INSERT INTO "unidade" ("id", "tipo_unidade_id", "nome") VALUES ($1, $2, $3)',
      [unitId, typeId, `Unidade ${unitId}`],
    );
    await pool.query(
      `INSERT INTO "cargo_funcao" ("id", "nome", "eh_professor", "usa_pontuacao")
       VALUES ($1, $2, false, false)`,
      [cargoId, `Cargo ${cargoId}`],
    );
    await pool.query('INSERT INTO "periodo" ("id", "nome") VALUES ($1, $2)', [
      periodId,
      `Período ${periodId}`,
    ]);
    await pool.query(
      `INSERT INTO "quadro_necessidade"
        ("id", "unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "quantidade")
       VALUES ($1, $2, 2027, $3, $4, 1)`,
      [staffingId, unitId, cargoId, periodId],
    );
    await pool.query(
      `INSERT INTO "posto_trabalho"
        ("id", "quadro_necessidade_id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo")
       VALUES ($1, $2, $3, $4, $5, 2027)`,
      [workPositionId, staffingId, unitId, cargoId, periodId],
    );
    await pool.query(
      `INSERT INTO "profissional"
        ("id", "matricula", "nome_completo", "cpf", "cargo_funcao_id", "data_entrada_prefeitura", "data_nascimento")
       VALUES ($1, 'LEGADO-001', 'Profissional legado', '12345678901', $2,
               DATE '2020-01-02', DATE '1980-03-04')`,
      [professionalId, cargoId],
    );
    await pool.query(
      `INSERT INTO "lotacao_sede" ("id", "profissional_id", "posto_trabalho_id")
       VALUES ($1, $2, $3)`,
      [randomUUID(), professionalId, workPositionId],
    );
    await pool.query(
      `INSERT INTO "exercicio_profissional"
        ("id", "profissional_id", "posto_trabalho_id", "tipo_exercicio")
       VALUES ($1, $2, $3, 'SEDE')`,
      [randomUUID(), professionalId, workPositionId],
    );
    await pool.query(
      `INSERT INTO "usuario"
        ("id", "nome", "login", "senha_hash", "perfil", "unidade_id")
       VALUES
        ($1, 'Administrador legado', $2, '$2b$12$hash-de-teste', 'ADMINISTRADOR', NULL),
        ($3, 'Operador legado', $4, '$2b$12$hash-de-teste', 'OPERADOR', NULL),
        ($5, 'Diretor legado', $6, '$2b$12$hash-de-teste', 'DIRETOR', $9),
        ($7, 'Secretário legado', $8, '$2b$12$hash-de-teste', 'SECRETARIO', $9)`,
      [
        adminId,
        `admin-legado-${adminId}`,
        operatorId,
        `operador-legado-${operatorId}`,
        directorId,
        directorLogin,
        secretaryId,
        `secretario-legado-${secretaryId}`,
        unitId,
      ],
    );
    await pool.query(
      `INSERT INTO "sessao_usuario" ("id", "usuario_id", "token_hash", "expira_em")
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour'),
              ($4, $5, $6, NOW() + INTERVAL '1 hour')`,
      [sessionIds[0], adminId, 'a'.repeat(64), sessionIds[1], directorId, 'b'.repeat(64)],
    );

    return {
      directorId,
      directorLogin,
      professionalId,
      secretaryId,
      sessionIds,
      unitId,
    };
  }

  it('upgrades populated legacy data without losing users, sessions or staffing history', async () => {
    const seeded = await seedLegacyState();

    await pool.query(migrationSql(correctionMigration));

    const links = await pool.query<{ unidade_id: string; usuario_id: string }>(
      `SELECT "usuario_id", "unidade_id"
       FROM "usuario_unidade"
       ORDER BY "usuario_id"`,
    );
    expect(links.rows).toEqual(
      expect.arrayContaining([
        { usuario_id: seeded.directorId, unidade_id: seeded.unitId },
        { usuario_id: seeded.secretaryId, unidade_id: seeded.unitId },
      ]),
    );
    expect(links.rows).toHaveLength(2);

    const users = await pool.query<{ login: string; total: string }>(
      `SELECT COUNT(*) AS total,
              MAX("login") FILTER (WHERE "id" = $1) AS login
       FROM "usuario"`,
      [seeded.directorId],
    );
    expect(Number(users.rows[0]?.total)).toBe(4);
    expect(users.rows[0]?.login).toBe(seeded.directorLogin);

    const sessions = await pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM "sessao_usuario" WHERE "id" = ANY($1::uuid[])',
      [seeded.sessionIds],
    );
    expect(Number(sessions.rows[0]?.total)).toBe(2);

    const staffing = await pool.query<{ exercises: string; placements: string }>(
      `SELECT
         (SELECT COUNT(*) FROM "lotacao_sede" WHERE "profissional_id" = $1) AS placements,
         (SELECT COUNT(*) FROM "exercicio_profissional" WHERE "profissional_id" = $1) AS exercises`,
      [seeded.professionalId],
    );
    expect(Number(staffing.rows[0]?.placements)).toBe(1);
    expect(Number(staffing.rows[0]?.exercises)).toBe(1);

    const legacyColumn = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'usuario'
         AND column_name = 'unidade_id'`,
    );
    expect(legacyColumn.rowCount).toBe(0);
  });

  it('rolls back safely when legacy user cardinality is incompatible', async () => {
    const seeded = await seedLegacyState();
    const client = await pool.connect();

    await pool.query('ALTER TABLE "usuario" DROP CONSTRAINT "usuario_unidade_perfil_check"');
    await pool.query('UPDATE "usuario" SET "unidade_id" = NULL WHERE "id" = $1', [
      seeded.directorId,
    ]);

    try {
      await expect(client.query(migrationSql(correctionMigration))).rejects.toMatchObject({
        code: '23514',
        constraint: 'usuario_unidade_legado_cardinalidade_check',
      } satisfies Partial<PostgresError>);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const oldColumn = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'usuario'
         AND column_name = 'unidade_id'`,
    );
    const newColumn = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'cargo_funcao'
         AND column_name = 'permite_multiplos_exercicios'`,
    );
    expect(oldColumn.rowCount).toBe(1);
    expect(newColumn.rowCount).toBe(0);
  });
});
