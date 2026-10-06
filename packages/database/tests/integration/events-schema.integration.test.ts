import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeDatabase = databaseTestUrl ? describe : describe.skip;

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
}

async function expectConstraint(
  operation: Promise<unknown>,
  constraint: string,
  code = '23514',
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected PostgreSQL constraint ${constraint} to reject the operation.`);
  } catch (error) {
    expect(error as PostgresError).toMatchObject({ code, constraint });
  }
}

describeDatabase('Etapa 6 migration e congelamento da fila', () => {
  if (!databaseTestUrl) return;
  const pool = new Pool({ connectionString: databaseTestUrl, max: 3 });
  const suffix = randomUUID();
  const cargoId = randomUUID();
  const professionalId = randomUUID();
  const secondProfessionalId = randomUUID();
  const userId = randomUUID();
  const eventId = randomUUID();
  let participantId: string;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO "cargo_funcao" ("id", "nome", "eh_professor", "usa_pontuacao")
       VALUES ($1, $2, TRUE, TRUE)`,
      [cargoId, `Cargo evento schema ${suffix}`],
    );
    await pool.query(
      `INSERT INTO "profissional"
        ("id", "matricula", "nome_completo", "cpf", "cargo_funcao_id", "pontuacao",
         "data_entrada_prefeitura", "data_nascimento", "numero_filhos")
       VALUES
        ($1, $2, 'Profissional fila', '12345678901', $3, 10, DATE '2010-01-01', DATE '1980-01-01', 2),
        ($4, $5, 'Profissional fila 2', '12345678902', $3, 9, DATE '2011-01-01', DATE '1981-01-01', 1)`,
      [professionalId, `M-E6-${suffix}`, cargoId, secondProfessionalId, `M-E6B-${suffix}`],
    );
    await pool.query(
      `INSERT INTO "usuario" ("id", "nome", "login", "senha_hash", "perfil")
       VALUES ($1, 'Operador schema', $2, 'hash-de-teste', 'OPERADOR')`,
      [userId, `operador.schema.${suffix}`],
    );
    await pool.query(
      `INSERT INTO "evento" ("id", "tipo", "nome", "ano", "cargo_funcao_id")
       VALUES ($1, 'LISTAO', 'Evento schema', 2026, $2)`,
      [eventId, cargoId],
    );
    participantId = randomUUID();
    await pool.query(
      `INSERT INTO "evento_participante" ("id", "evento_id", "profissional_id")
       VALUES ($1, $2, $3)`,
      [participantId, eventId, professionalId],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('cria cargo obrigatório, snapshot de filhos, índice e FK RESTRICT/CASCADE', async () => {
    const columns = await pool.query<{ column_name: string; is_nullable: string }>(
      `SELECT "column_name", "is_nullable"
       FROM "information_schema"."columns"
       WHERE "table_schema" = 'public'
         AND ("table_name", "column_name") IN (
           ('evento', 'cargo_funcao_id'),
           ('evento_participante', 'numero_filhos_snapshot')
         )
       ORDER BY "column_name"`,
    );
    expect(columns.rows).toEqual([
      { column_name: 'cargo_funcao_id', is_nullable: 'NO' },
      { column_name: 'numero_filhos_snapshot', is_nullable: 'YES' },
    ]);
    const index = await pool.query(
      `SELECT 1 FROM "pg_indexes"
       WHERE "schemaname" = 'public' AND "indexname" = 'evento_cargo_funcao_idx'`,
    );
    expect(index.rowCount).toBe(1);
    const foreignKey = await pool.query<{ confdeltype: string; confupdtype: string }>(
      `SELECT "confdeltype", "confupdtype"
       FROM "pg_constraint"
       WHERE "conname" = 'evento_cargo_funcao_id_fkey'`,
    );
    expect(foreignKey.rows[0]).toEqual({ confdeltype: 'r', confupdtype: 'c' });
  });

  it('rejeita numero_filhos_snapshot negativo', async () => {
    await expectConstraint(
      pool.query(`UPDATE "evento_participante" SET "numero_filhos_snapshot" = -1 WHERE "id" = $1`, [
        participantId,
      ]),
      'evento_participante_numero_filhos_snapshot_check',
    );
  });

  it('congela INSERT, DELETE e campos oficiais depois de ATIVO', async () => {
    await pool.query(
      `UPDATE "evento_participante"
       SET "pontuacao_snapshot" = 10,
           "data_entrada_snapshot" = DATE '2010-01-01',
           "data_nascimento_snapshot" = DATE '1980-01-01',
           "numero_filhos_snapshot" = 2,
           "posicao" = 1,
           "status" = 'AGUARDANDO'
       WHERE "id" = $1`,
      [participantId],
    );
    await pool.query(
      `UPDATE "evento"
       SET "status" = 'ATIVO', "iniciado_por_usuario_id" = $1, "data_inicio" = NOW()
       WHERE "id" = $2`,
      [userId, eventId],
    );

    await expectConstraint(
      pool.query(
        `INSERT INTO "evento_participante" ("id", "evento_id", "profissional_id")
         VALUES ($1, $2, $3)`,
        [randomUUID(), eventId, secondProfessionalId],
      ),
      'evento_participante_lista_congelada_check',
    );
    await expectConstraint(
      pool.query('DELETE FROM "evento_participante" WHERE "id" = $1', [participantId]),
      'evento_participante_lista_congelada_check',
    );
    await expectConstraint(
      pool.query('UPDATE "evento_participante" SET "posicao" = 2 WHERE "id" = $1', [participantId]),
      'evento_participante_dados_congelados_check',
    );
    const draftEventId = randomUUID();
    await pool.query(
      `INSERT INTO "evento" ("id", "tipo", "nome", "ano", "cargo_funcao_id")
       VALUES ($1, 'LISTAO', 'Outro evento', 2026, $2)`,
      [draftEventId, cargoId],
    );
    await expectConstraint(
      pool.query('UPDATE "evento_participante" SET "evento_id" = $1 WHERE "id" = $2', [
        draftEventId,
        participantId,
      ]),
      'evento_participante_dados_congelados_check',
    );
  });

  it('permite evolução somente do status do participante e congela estrutura do evento', async () => {
    const status = await pool.query<{ status: string }>(
      `UPDATE "evento_participante" SET "status" = 'ATENDIDO' WHERE "id" = $1 RETURNING "status"`,
      [participantId],
    );
    expect(status.rows[0]?.status).toBe('ATENDIDO');
    await expectConstraint(
      pool.query('UPDATE "evento" SET "ano" = 2027 WHERE "id" = $1', [eventId]),
      'evento_estrutura_congelada_check',
    );
    await expectConstraint(
      pool.query(`UPDATE "evento" SET "status" = 'RASCUNHO' WHERE "id" = $1`, [eventId]),
      'evento_status_reabertura_check',
    );
  });
});
