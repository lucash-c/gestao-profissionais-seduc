-- Etapa 2: authentication sessions and mandatory password hashes.

ALTER TABLE "usuario"
ALTER COLUMN "senha_hash" SET NOT NULL;

CREATE TABLE "sessao_usuario" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessao_usuario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessao_usuario_token_hash_key"
ON "sessao_usuario"("token_hash");

CREATE INDEX "sessao_usuario_usuario_idx"
ON "sessao_usuario"("usuario_id");

CREATE INDEX "sessao_usuario_expira_em_idx"
ON "sessao_usuario"("expira_em");

ALTER TABLE "sessao_usuario"
ADD CONSTRAINT "sessao_usuario_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
