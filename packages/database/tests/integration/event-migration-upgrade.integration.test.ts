import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Pool, type PoolClient } from 'pg';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeDatabase = databaseTestUrl ? describe : describe.skip;
const migrationsRoot = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url));
const previousMigrations = [
  '20261001000000_banco_base',
  '20261001120000_autenticacao_sessoes',
  '20261001160000_usuario_identificador_unico',
  '20261002120000_diretor_multiplas_unidades',
  '20261005110000_quadro_quantidade_zero',
] as const;

async function migrationSql(name: string): Promise<string> {
  return readFile(`${migrationsRoot}${name}/migration.sql`, 'utf8');
}

async function applyStageFive(client: PoolClient): Promise<void> {
  for (const migration of previousMigrations) {
    await client.query(await migrationSql(migration));
  }
}

describeDatabase('upgrade aditivo da migration da Etapa 6', () => {
  if (!databaseTestUrl) return;
  const pool = new Pool({ connectionString: databaseTestUrl, max: 1 });

  afterAll(async () => {
    await pool.end();
  });

  it('aplica integralmente sobre um schema da Etapa 5 sem eventos', async () => {
    const schema = `e6_upgrade_${randomUUID().replaceAll('-', '')}`;
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await applyStageFive(client);
      await client.query(await migrationSql('20261006120000_eventos_preparacao_fila'));

      const result = await client.query<{ cargo_nullable: string; children_nullable: string }>(
        `SELECT
           (SELECT "is_nullable" FROM "information_schema"."columns"
            WHERE "table_schema" = $1 AND "table_name" = 'evento'
              AND "column_name" = 'cargo_funcao_id') AS "cargo_nullable",
           (SELECT "is_nullable" FROM "information_schema"."columns"
            WHERE "table_schema" = $1 AND "table_name" = 'evento_participante'
              AND "column_name" = 'numero_filhos_snapshot') AS "children_nullable"`,
        [schema],
      );
      expect(result.rows[0]).toEqual({ cargo_nullable: 'NO', children_nullable: 'YES' });
    } finally {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  }, 30_000);

  it('falha explicitamente e sem inferência quando existem eventos legados', async () => {
    const schema = `e6_legacy_${randomUUID().replaceAll('-', '')}`;
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await applyStageFive(client);
      const cargoId = randomUUID();
      await client.query(`INSERT INTO "cargo_funcao" ("id", "nome") VALUES ($1, 'Cargo legado')`, [
        cargoId,
      ]);
      await client.query(
        `INSERT INTO "evento" ("id", "tipo", "nome", "ano")
         VALUES ($1, 'LISTAO', 'Evento legado', 2025)`,
        [randomUUID()],
      );

      await expect(
        client.query(await migrationSql('20261006120000_eventos_preparacao_fila')),
      ).rejects.toThrow('existem eventos legados sem cargo/função determinável');
      const column = await client.query(
        `SELECT 1 FROM "information_schema"."columns"
         WHERE "table_schema" = $1 AND "table_name" = 'evento'
           AND "column_name" = 'cargo_funcao_id'`,
        [schema],
      );
      expect(column.rowCount).toBe(0);
    } finally {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  }, 30_000);
});
