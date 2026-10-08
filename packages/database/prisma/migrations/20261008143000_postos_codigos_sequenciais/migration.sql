-- Contador transacional por prefixo para códigos amigáveis dos postos.
CREATE TABLE IF NOT EXISTS "posto_codigo_contador" (
    "prefixo" VARCHAR(4) NOT NULL,
    "ultimo_valor" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "posto_codigo_contador_pkey" PRIMARY KEY ("prefixo"),
    CONSTRAINT "posto_codigo_contador_ultimo_valor_check"
      CHECK ("ultimo_valor" >= 0 AND "ultimo_valor" <= 9999999999)
);

-- Somente códigos ausentes ou inequivocamente automáticos são saneados.
WITH candidatos AS (
  SELECT
    p."id",
    COALESCE(
      NULLIF(
        LEFT(
          REGEXP_REPLACE(
            UPPER(TRANSLATE(
              c."nome",
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
              'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
            )),
            '[^A-Z0-9]',
            '',
            'g'
          ),
          4
        ),
        ''
      ),
      'POST'
    ) AS prefixo,
    p."criado_em"
  FROM "posto_trabalho" p
  JOIN "cargo_funcao" c ON c."id" = p."cargo_funcao_id"
  WHERE p."codigo" IS NULL OR p."codigo" ~* '^Posto [0-9a-f]{8}$'
), existentes AS (
  SELECT
    SPLIT_PART("codigo", '-', 1) AS prefixo,
    MAX(RIGHT("codigo", 10)::BIGINT) AS maior
  FROM "posto_trabalho"
  WHERE "codigo" ~ '^[A-Z0-9]{1,4}-[0-9]{10}$'
  GROUP BY SPLIT_PART("codigo", '-', 1)
), ordenados AS (
  SELECT
    candidatos."id",
    candidatos.prefixo,
    ROW_NUMBER() OVER (
      PARTITION BY candidatos.prefixo
      ORDER BY candidatos."criado_em", candidatos."id"
    ) AS numero
  FROM candidatos
)
UPDATE "posto_trabalho" p
SET "codigo" = ordenados.prefixo || '-' ||
  LPAD((COALESCE(existentes.maior, 0) + ordenados.numero)::TEXT, 10, '0')
FROM ordenados
LEFT JOIN existentes ON existentes.prefixo = ordenados.prefixo
WHERE p."id" = ordenados."id";

INSERT INTO "posto_codigo_contador" ("prefixo", "ultimo_valor")
SELECT
  SPLIT_PART("codigo", '-', 1),
  MAX(RIGHT("codigo", 10)::BIGINT)
FROM "posto_trabalho"
WHERE "codigo" ~ '^[A-Z0-9]{1,4}-[0-9]{10}$'
GROUP BY SPLIT_PART("codigo", '-', 1)
ON CONFLICT ("prefixo") DO UPDATE
SET "ultimo_valor" = GREATEST(
  "posto_codigo_contador"."ultimo_valor",
  EXCLUDED."ultimo_valor"
);

ALTER TABLE "posto_trabalho" ALTER COLUMN "codigo" SET NOT NULL;
CREATE UNIQUE INDEX "posto_trabalho_codigo_novo_key"
ON "posto_trabalho"("codigo")
WHERE "codigo" ~ '^[A-Z0-9]{1,4}-[0-9]{10}$';
