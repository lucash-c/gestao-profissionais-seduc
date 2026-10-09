BEGIN;

DO $$
DECLARE
  invalid_periods TEXT;
BEGIN
  SELECT string_agg(nome, ', ' ORDER BY nome)
  INTO invalid_periods
  FROM "periodo"
  WHERE nome NOT IN ('Integral', 'INTEGRAL', 'Manhã', 'MANHA', 'Tarde', 'TARDE', 'Noite', 'NOITE');

  IF invalid_periods IS NOT NULL THEN
    RAISE EXCEPTION 'Períodos sem código estrutural reconhecido: %', invalid_periods
      USING ERRCODE = '23514', CONSTRAINT = 'periodo_codigo_reconhecido_check';
  END IF;
END;
$$;

ALTER TABLE "quadro_necessidade" ADD COLUMN "periodo_codigo" VARCHAR(40);
ALTER TABLE "posto_trabalho" ADD COLUMN "periodo_codigo" VARCHAR(40);

UPDATE "quadro_necessidade" quadro
SET "periodo_codigo" = CASE periodo."nome"
  WHEN 'Integral' THEN 'INTEGRAL'
  WHEN 'INTEGRAL' THEN 'INTEGRAL'
  WHEN 'Manhã' THEN 'MANHA'
  WHEN 'MANHA' THEN 'MANHA'
  WHEN 'Tarde' THEN 'TARDE'
  WHEN 'TARDE' THEN 'TARDE'
  WHEN 'Noite' THEN 'NOITE'
  WHEN 'NOITE' THEN 'NOITE'
END
FROM "periodo" periodo
WHERE periodo."id" = quadro."periodo_id";

UPDATE "posto_trabalho" posto
SET "periodo_codigo" = CASE periodo."nome"
  WHEN 'Integral' THEN 'INTEGRAL'
  WHEN 'INTEGRAL' THEN 'INTEGRAL'
  WHEN 'Manhã' THEN 'MANHA'
  WHEN 'MANHA' THEN 'MANHA'
  WHEN 'Tarde' THEN 'TARDE'
  WHEN 'TARDE' THEN 'TARDE'
  WHEN 'Noite' THEN 'NOITE'
  WHEN 'NOITE' THEN 'NOITE'
END
FROM "periodo" periodo
WHERE periodo."id" = posto."periodo_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quadro_necessidade" WHERE "periodo_codigo" IS NULL)
     OR EXISTS (SELECT 1 FROM "posto_trabalho" WHERE "periodo_codigo" IS NULL) THEN
    RAISE EXCEPTION 'Não foi possível converter todas as referências de período para códigos.'
      USING ERRCODE = '23514', CONSTRAINT = 'periodo_estrutural_codigo_not_null';
  END IF;
END;
$$;

ALTER TABLE "quadro_necessidade" ALTER COLUMN "periodo_codigo" SET NOT NULL;
ALTER TABLE "posto_trabalho" ALTER COLUMN "periodo_codigo" SET NOT NULL;

ALTER TABLE "quadro_necessidade" DROP CONSTRAINT "quadro_necessidade_periodo_id_fkey";
ALTER TABLE "posto_trabalho" DROP CONSTRAINT "posto_trabalho_quadro_necessidade_id_unidade_id_cargo_func_fkey";

DROP INDEX "quadro_necessidade_posto_ref_key";
DROP INDEX "quadro_necessidade_escopo_com_segmento_key";
DROP INDEX "quadro_necessidade_escopo_sem_segmento_key";
DROP INDEX "quadro_necessidade_periodo_idx";

ALTER TABLE "quadro_necessidade" DROP COLUMN "periodo_id";
ALTER TABLE "posto_trabalho" DROP COLUMN "periodo_id";

ALTER TABLE "quadro_necessidade" RENAME COLUMN "periodo_codigo" TO "periodo_id";
ALTER TABLE "posto_trabalho" RENAME COLUMN "periodo_codigo" TO "periodo_id";

ALTER TABLE "quadro_necessidade"
  ADD CONSTRAINT "quadro_necessidade_periodo_codigo_check"
  CHECK ("periodo_id" IN ('INTEGRAL', 'MANHA', 'TARDE', 'NOITE'));
ALTER TABLE "posto_trabalho"
  ADD CONSTRAINT "posto_trabalho_periodo_codigo_check"
  CHECK ("periodo_id" IN ('INTEGRAL', 'MANHA', 'TARDE', 'NOITE'));

CREATE UNIQUE INDEX "quadro_necessidade_posto_ref_key"
ON "quadro_necessidade"("id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo");
CREATE UNIQUE INDEX "quadro_necessidade_escopo_com_segmento_key"
ON "quadro_necessidade"("unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "segmento_ensino_id")
WHERE "segmento_ensino_id" IS NOT NULL;
CREATE UNIQUE INDEX "quadro_necessidade_escopo_sem_segmento_key"
ON "quadro_necessidade"("unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id")
WHERE "segmento_ensino_id" IS NULL;
CREATE INDEX "quadro_necessidade_periodo_idx" ON "quadro_necessidade"("periodo_id");

ALTER TABLE "posto_trabalho"
  ADD CONSTRAINT "posto_trabalho_quadro_necessidade_id_unidade_id_cargo_func_fkey"
  FOREIGN KEY ("quadro_necessidade_id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo")
  REFERENCES "quadro_necessidade"("id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

DROP TABLE "periodo";

COMMIT;
