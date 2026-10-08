CREATE TABLE "configuracao_sistema" (
    "chave" VARCHAR(100) NOT NULL,
    "valor_booleano" BOOLEAN NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "configuracao_sistema_pkey" PRIMARY KEY ("chave")
);

INSERT INTO "configuracao_sistema" ("chave", "valor_booleano")
VALUES ('ATRIBUICAO_MANUAL_HABILITADA', TRUE);
