BEGIN;

-- The conversion is deliberately explicit. A value outside these legacy and
-- official labels must be reviewed instead of being guessed by this migration.
DO $$
DECLARE
  invalid_types TEXT;
  invalid_positions TEXT;
BEGIN
  SELECT string_agg(nome, ', ' ORDER BY nome)
  INTO invalid_types
  FROM "tipo_unidade"
  WHERE nome NOT IN ('EMEI', 'EMEF', 'CIEP', 'Creche', 'CRECHE', 'Casa da Criança', 'CASA DA CRIANÇA');

  IF invalid_types IS NOT NULL THEN
    RAISE EXCEPTION 'Tipos de unidade sem código estrutural reconhecido: %', invalid_types
      USING ERRCODE = '23514', CONSTRAINT = 'tipo_unidade_codigo_reconhecido_check';
  END IF;

  SELECT string_agg(nome, ', ' ORDER BY nome)
  INTO invalid_positions
  FROM "cargo_funcao"
  WHERE nome NOT IN (
    'PEB 1 - Fundamental', 'PEB1 - Fundamental',
    'PEB 1 - Infantil', 'PEB1 - Infantil',
    'PEB 2 - Médio', 'PEB2 - Médio',
    'Escriturário', 'Escriturário(a)',
    'Servente',
    'Inspetor', 'Inspetor(a)',
    'Monitor', 'Monitora', 'Monitor(a)',
    'Diretor', 'Diretor(a)',
    'Vice-diretor', 'Vice-diretor(a)'
  );

  IF invalid_positions IS NOT NULL THEN
    RAISE EXCEPTION 'Cargos/funções sem código estrutural reconhecido: %', invalid_positions
      USING ERRCODE = '23514', CONSTRAINT = 'cargo_funcao_codigo_reconhecido_check';
  END IF;
END;
$$;

ALTER TABLE "unidade" ADD COLUMN "tipo_unidade_codigo" VARCHAR(40);
ALTER TABLE "profissional" ADD COLUMN "cargo_funcao_codigo" VARCHAR(40);
ALTER TABLE "quadro_necessidade" ADD COLUMN "cargo_funcao_codigo" VARCHAR(40);
ALTER TABLE "posto_trabalho" ADD COLUMN "cargo_funcao_codigo" VARCHAR(40);
ALTER TABLE "evento" ADD COLUMN "cargo_funcao_codigo" VARCHAR(40);

UPDATE "unidade" unidade
SET "tipo_unidade_codigo" = CASE tipo."nome"
  WHEN 'EMEI' THEN 'EMEI'
  WHEN 'EMEF' THEN 'EMEF'
  WHEN 'CIEP' THEN 'CIEP'
  WHEN 'Creche' THEN 'CRECHE'
  WHEN 'CRECHE' THEN 'CRECHE'
  WHEN 'Casa da Criança' THEN 'CASA_DA_CRIANCA'
  WHEN 'CASA DA CRIANÇA' THEN 'CASA_DA_CRIANCA'
END
FROM "tipo_unidade" tipo
WHERE tipo."id" = unidade."tipo_unidade_id";

UPDATE "profissional" profissional
SET "cargo_funcao_codigo" = CASE cargo."nome"
  WHEN 'PEB 1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB 1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB 2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'PEB2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'Escriturário' THEN 'ESCRITURARIO'
  WHEN 'Escriturário(a)' THEN 'ESCRITURARIO'
  WHEN 'Servente' THEN 'SERVENTE'
  WHEN 'Inspetor' THEN 'INSPETOR'
  WHEN 'Inspetor(a)' THEN 'INSPETOR'
  WHEN 'Monitor' THEN 'MONITOR'
  WHEN 'Monitora' THEN 'MONITOR'
  WHEN 'Monitor(a)' THEN 'MONITOR'
  WHEN 'Diretor' THEN 'DIRETOR'
  WHEN 'Diretor(a)' THEN 'DIRETOR'
  WHEN 'Vice-diretor' THEN 'VICE_DIRETOR'
  WHEN 'Vice-diretor(a)' THEN 'VICE_DIRETOR'
END
FROM "cargo_funcao" cargo
WHERE cargo."id" = profissional."cargo_funcao_id";

UPDATE "quadro_necessidade" quadro
SET "cargo_funcao_codigo" = CASE cargo."nome"
  WHEN 'PEB 1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB 1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB 2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'PEB2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'Escriturário' THEN 'ESCRITURARIO'
  WHEN 'Escriturário(a)' THEN 'ESCRITURARIO'
  WHEN 'Servente' THEN 'SERVENTE'
  WHEN 'Inspetor' THEN 'INSPETOR'
  WHEN 'Inspetor(a)' THEN 'INSPETOR'
  WHEN 'Monitor' THEN 'MONITOR'
  WHEN 'Monitora' THEN 'MONITOR'
  WHEN 'Monitor(a)' THEN 'MONITOR'
  WHEN 'Diretor' THEN 'DIRETOR'
  WHEN 'Diretor(a)' THEN 'DIRETOR'
  WHEN 'Vice-diretor' THEN 'VICE_DIRETOR'
  WHEN 'Vice-diretor(a)' THEN 'VICE_DIRETOR'
END
FROM "cargo_funcao" cargo
WHERE cargo."id" = quadro."cargo_funcao_id";

UPDATE "posto_trabalho" posto
SET "cargo_funcao_codigo" = CASE cargo."nome"
  WHEN 'PEB 1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB 1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB 2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'PEB2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'Escriturário' THEN 'ESCRITURARIO'
  WHEN 'Escriturário(a)' THEN 'ESCRITURARIO'
  WHEN 'Servente' THEN 'SERVENTE'
  WHEN 'Inspetor' THEN 'INSPETOR'
  WHEN 'Inspetor(a)' THEN 'INSPETOR'
  WHEN 'Monitor' THEN 'MONITOR'
  WHEN 'Monitora' THEN 'MONITOR'
  WHEN 'Monitor(a)' THEN 'MONITOR'
  WHEN 'Diretor' THEN 'DIRETOR'
  WHEN 'Diretor(a)' THEN 'DIRETOR'
  WHEN 'Vice-diretor' THEN 'VICE_DIRETOR'
  WHEN 'Vice-diretor(a)' THEN 'VICE_DIRETOR'
END
FROM "cargo_funcao" cargo
WHERE cargo."id" = posto."cargo_funcao_id";

UPDATE "evento" evento
SET "cargo_funcao_codigo" = CASE cargo."nome"
  WHEN 'PEB 1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB1 - Fundamental' THEN 'PEB1_FUNDAMENTAL'
  WHEN 'PEB 1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB1 - Infantil' THEN 'PEB1_INFANTIL'
  WHEN 'PEB 2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'PEB2 - Médio' THEN 'PEB2_MEDIO'
  WHEN 'Escriturário' THEN 'ESCRITURARIO'
  WHEN 'Escriturário(a)' THEN 'ESCRITURARIO'
  WHEN 'Servente' THEN 'SERVENTE'
  WHEN 'Inspetor' THEN 'INSPETOR'
  WHEN 'Inspetor(a)' THEN 'INSPETOR'
  WHEN 'Monitor' THEN 'MONITOR'
  WHEN 'Monitora' THEN 'MONITOR'
  WHEN 'Monitor(a)' THEN 'MONITOR'
  WHEN 'Diretor' THEN 'DIRETOR'
  WHEN 'Diretor(a)' THEN 'DIRETOR'
  WHEN 'Vice-diretor' THEN 'VICE_DIRETOR'
  WHEN 'Vice-diretor(a)' THEN 'VICE_DIRETOR'
END
FROM "cargo_funcao" cargo
WHERE cargo."id" = evento."cargo_funcao_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "unidade" WHERE "tipo_unidade_codigo" IS NULL)
     OR EXISTS (SELECT 1 FROM "profissional" WHERE "cargo_funcao_codigo" IS NULL)
     OR EXISTS (SELECT 1 FROM "quadro_necessidade" WHERE "cargo_funcao_codigo" IS NULL)
     OR EXISTS (SELECT 1 FROM "posto_trabalho" WHERE "cargo_funcao_codigo" IS NULL)
     OR EXISTS (SELECT 1 FROM "evento" WHERE "cargo_funcao_codigo" IS NULL) THEN
    RAISE EXCEPTION 'Não foi possível converter todas as referências de domínio para códigos.'
      USING ERRCODE = '23514', CONSTRAINT = 'dominio_estrutural_codigo_not_null';
  END IF;
END;
$$;

ALTER TABLE "unidade" ALTER COLUMN "tipo_unidade_codigo" SET NOT NULL;
ALTER TABLE "profissional" ALTER COLUMN "cargo_funcao_codigo" SET NOT NULL;
ALTER TABLE "quadro_necessidade" ALTER COLUMN "cargo_funcao_codigo" SET NOT NULL;
ALTER TABLE "posto_trabalho" ALTER COLUMN "cargo_funcao_codigo" SET NOT NULL;
ALTER TABLE "evento" ALTER COLUMN "cargo_funcao_codigo" SET NOT NULL;

DROP TRIGGER IF EXISTS "cargo_funcao_multiplos_exercicios_trigger" ON "cargo_funcao";
DROP FUNCTION IF EXISTS validar_capacidade_cargo_exercicios_ativos();
DROP TRIGGER IF EXISTS "profissional_cargo_multiplos_exercicios_trigger" ON "profissional";
DROP FUNCTION IF EXISTS validar_troca_cargo_exercicios_ativos();
DROP TRIGGER IF EXISTS "exercicio_profissional_limite_ativo_trigger" ON "exercicio_profissional";
DROP FUNCTION IF EXISTS sincronizar_limite_exercicio_profissional_ativo();

ALTER TABLE "unidade" DROP CONSTRAINT "unidade_tipo_unidade_id_fkey";
ALTER TABLE "profissional" DROP CONSTRAINT "profissional_cargo_funcao_id_fkey";
ALTER TABLE "quadro_necessidade" DROP CONSTRAINT "quadro_necessidade_cargo_funcao_id_fkey";
ALTER TABLE "posto_trabalho" DROP CONSTRAINT "posto_trabalho_quadro_necessidade_id_unidade_id_cargo_func_fkey";
ALTER TABLE "evento" DROP CONSTRAINT "evento_cargo_funcao_id_fkey";

DROP INDEX "unidade_tipo_unidade_idx";
DROP INDEX "profissional_cargo_ativo_idx";
DROP INDEX "quadro_necessidade_cargo_idx";
DROP INDEX "quadro_necessidade_posto_ref_key";
DROP INDEX "quadro_necessidade_escopo_com_segmento_key";
DROP INDEX "quadro_necessidade_escopo_sem_segmento_key";
DROP INDEX "evento_cargo_funcao_idx";

ALTER TABLE "unidade" DROP COLUMN "tipo_unidade_id";
ALTER TABLE "profissional" DROP COLUMN "cargo_funcao_id";
ALTER TABLE "quadro_necessidade" DROP COLUMN "cargo_funcao_id";
ALTER TABLE "posto_trabalho" DROP COLUMN "cargo_funcao_id";
ALTER TABLE "evento" DROP COLUMN "cargo_funcao_id";

ALTER TABLE "unidade" RENAME COLUMN "tipo_unidade_codigo" TO "tipo_unidade_id";
ALTER TABLE "profissional" RENAME COLUMN "cargo_funcao_codigo" TO "cargo_funcao_id";
ALTER TABLE "quadro_necessidade" RENAME COLUMN "cargo_funcao_codigo" TO "cargo_funcao_id";
ALTER TABLE "posto_trabalho" RENAME COLUMN "cargo_funcao_codigo" TO "cargo_funcao_id";
ALTER TABLE "evento" RENAME COLUMN "cargo_funcao_codigo" TO "cargo_funcao_id";

ALTER TABLE "unidade"
  ADD CONSTRAINT "unidade_tipo_unidade_codigo_check"
  CHECK ("tipo_unidade_id" IN ('EMEI', 'EMEF', 'CIEP', 'CRECHE', 'CASA_DA_CRIANCA'));
ALTER TABLE "profissional"
  ADD CONSTRAINT "profissional_cargo_funcao_codigo_check"
  CHECK ("cargo_funcao_id" IN ('PEB1_FUNDAMENTAL', 'PEB1_INFANTIL', 'PEB2_MEDIO', 'ESCRITURARIO', 'SERVENTE', 'INSPETOR', 'MONITOR', 'DIRETOR', 'VICE_DIRETOR'));
ALTER TABLE "quadro_necessidade"
  ADD CONSTRAINT "quadro_necessidade_cargo_funcao_codigo_check"
  CHECK ("cargo_funcao_id" IN ('PEB1_FUNDAMENTAL', 'PEB1_INFANTIL', 'PEB2_MEDIO', 'ESCRITURARIO', 'SERVENTE', 'INSPETOR', 'MONITOR', 'DIRETOR', 'VICE_DIRETOR'));
ALTER TABLE "posto_trabalho"
  ADD CONSTRAINT "posto_trabalho_cargo_funcao_codigo_check"
  CHECK ("cargo_funcao_id" IN ('PEB1_FUNDAMENTAL', 'PEB1_INFANTIL', 'PEB2_MEDIO', 'ESCRITURARIO', 'SERVENTE', 'INSPETOR', 'MONITOR', 'DIRETOR', 'VICE_DIRETOR'));
ALTER TABLE "evento"
  ADD CONSTRAINT "evento_cargo_funcao_codigo_check"
  CHECK ("cargo_funcao_id" IN ('PEB1_FUNDAMENTAL', 'PEB1_INFANTIL', 'PEB2_MEDIO', 'ESCRITURARIO', 'SERVENTE', 'INSPETOR', 'MONITOR', 'DIRETOR', 'VICE_DIRETOR'));

CREATE INDEX "unidade_tipo_unidade_idx" ON "unidade"("tipo_unidade_id");
CREATE INDEX "profissional_cargo_ativo_idx" ON "profissional"("cargo_funcao_id", "ativo");
CREATE INDEX "quadro_necessidade_cargo_idx" ON "quadro_necessidade"("cargo_funcao_id");
CREATE UNIQUE INDEX "quadro_necessidade_posto_ref_key"
ON "quadro_necessidade"("id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo");
CREATE UNIQUE INDEX "quadro_necessidade_escopo_com_segmento_key"
ON "quadro_necessidade"("unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "segmento_ensino_id")
WHERE "segmento_ensino_id" IS NOT NULL;
CREATE UNIQUE INDEX "quadro_necessidade_escopo_sem_segmento_key"
ON "quadro_necessidade"("unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id")
WHERE "segmento_ensino_id" IS NULL;
CREATE INDEX "evento_cargo_funcao_idx" ON "evento"("cargo_funcao_id");

ALTER TABLE "posto_trabalho"
  ADD CONSTRAINT "posto_trabalho_quadro_necessidade_id_unidade_id_cargo_func_fkey"
  FOREIGN KEY ("quadro_necessidade_id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo")
  REFERENCES "quadro_necessidade"("id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

DROP TABLE "cargo_tipo_unidade";
DROP TABLE "tipo_unidade";
DROP TABLE "cargo_funcao";

CREATE OR REPLACE FUNCTION sincronizar_limite_exercicio_profissional_ativo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  permite_multiplos BOOLEAN;
  total_ativos INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."data_fim" IS NULL THEN
      PERFORM ajustar_limite_exercicio_profissional_ativo(OLD."profissional_id", -1);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD."data_fim" IS NULL
     AND NEW."data_fim" IS NULL
     AND OLD."profissional_id" = NEW."profissional_id" THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."data_fim" IS NULL THEN
    PERFORM ajustar_limite_exercicio_profissional_ativo(OLD."profissional_id", -1);
  END IF;

  IF NEW."data_fim" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT profissional."cargo_funcao_id" = 'DIRETOR'
  INTO permite_multiplos
  FROM "profissional" profissional
  WHERE profissional."id" = NEW."profissional_id"
  FOR SHARE OF profissional;

  total_ativos := ajustar_limite_exercicio_profissional_ativo(NEW."profissional_id", 1);

  IF NOT permite_multiplos AND total_ativos > 1 THEN
    RAISE EXCEPTION 'O cargo do profissional não permite múltiplos exercícios ativos.'
      USING ERRCODE = '23514', CONSTRAINT = 'exercicio_profissional_multiplos_ativos_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "exercicio_profissional_limite_ativo_trigger"
AFTER INSERT OR UPDATE OF "profissional_id", "data_fim" OR DELETE
ON "exercicio_profissional"
FOR EACH ROW
EXECUTE FUNCTION sincronizar_limite_exercicio_profissional_ativo();

CREATE OR REPLACE FUNCTION validar_troca_cargo_exercicios_ativos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  permite_multiplos BOOLEAN;
  total_ativos INTEGER := 0;
BEGIN
  IF NEW."cargo_funcao_id" = OLD."cargo_funcao_id" THEN
    RETURN NEW;
  END IF;

  permite_multiplos := NEW."cargo_funcao_id" = 'DIRETOR';

  SELECT "quantidade_ativa"
  INTO total_ativos
  FROM "exercicio_profissional_limite_ativo"
  WHERE "profissional_id" = NEW."id"
  FOR UPDATE;

  IF NOT permite_multiplos AND COALESCE(total_ativos, 0) > 1 THEN
    RAISE EXCEPTION 'O novo cargo não permite os múltiplos exercícios ativos do profissional.'
      USING ERRCODE = '23514', CONSTRAINT = 'profissional_cargo_multiplos_exercicios_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "profissional_cargo_multiplos_exercicios_trigger"
BEFORE UPDATE OF "cargo_funcao_id"
ON "profissional"
FOR EACH ROW
EXECUTE FUNCTION validar_troca_cargo_exercicios_ativos();

COMMIT;
