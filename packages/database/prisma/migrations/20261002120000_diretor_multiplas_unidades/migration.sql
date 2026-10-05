BEGIN;

ALTER TABLE "cargo_funcao"
ADD COLUMN "permite_multiplos_exercicios" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "usuario_unidade" (
    "usuario_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    CONSTRAINT "usuario_unidade_pkey" PRIMARY KEY ("usuario_id", "unidade_id")
);

CREATE INDEX "usuario_unidade_unidade_idx" ON "usuario_unidade"("unidade_id");

ALTER TABLE "usuario_unidade"
ADD CONSTRAINT "usuario_unidade_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usuario_unidade"
ADD CONSTRAINT "usuario_unidade_unidade_id_fkey"
FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "usuario"
    WHERE ("perfil" IN ('DIRETOR', 'SECRETARIO') AND "unidade_id" IS NULL)
       OR ("perfil" IN ('ADMINISTRADOR', 'OPERADOR') AND "unidade_id" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Existem vínculos legados de usuário incompatíveis com a migração.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'usuario_unidade_legado_cardinalidade_check';
  END IF;
END;
$$;

INSERT INTO "usuario_unidade" ("usuario_id", "unidade_id")
SELECT "id", "unidade_id"
FROM "usuario"
WHERE "perfil" IN ('DIRETOR', 'SECRETARIO')
  AND "unidade_id" IS NOT NULL;

ALTER TABLE "usuario" DROP CONSTRAINT "usuario_unidade_perfil_check";
ALTER TABLE "usuario" DROP CONSTRAINT "usuario_unidade_id_fkey";
DROP INDEX "usuario_unidade_idx";
ALTER TABLE "usuario" DROP COLUMN "unidade_id";

DROP INDEX "exercicio_profissional_profissional_ativo_key";

CREATE TABLE "exercicio_profissional_limite_ativo" (
    "profissional_id" UUID NOT NULL,
    "quantidade_ativa" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "exercicio_profissional_limite_ativo_pkey" PRIMARY KEY ("profissional_id"),
    CONSTRAINT "exercicio_profissional_limite_ativo_profissional_fkey"
      FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exercicio_profissional_limite_ativo_quantidade_check"
      CHECK ("quantidade_ativa" >= 0)
);

INSERT INTO "exercicio_profissional_limite_ativo" ("profissional_id", "quantidade_ativa")
SELECT profissional."id", COUNT(exercicio."id")::INTEGER
FROM "profissional" profissional
LEFT JOIN "exercicio_profissional" exercicio
  ON exercicio."profissional_id" = profissional."id"
 AND exercicio."data_fim" IS NULL
GROUP BY profissional."id";

CREATE OR REPLACE FUNCTION criar_limite_exercicio_profissional()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "exercicio_profissional_limite_ativo" ("profissional_id", "quantidade_ativa")
  VALUES (NEW."id", 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER "profissional_criar_limite_exercicio_trigger"
AFTER INSERT
ON "profissional"
FOR EACH ROW
EXECUTE FUNCTION criar_limite_exercicio_profissional();

CREATE OR REPLACE FUNCTION ajustar_limite_exercicio_profissional_ativo(
  alvo_profissional_id UUID,
  delta INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_ativos INTEGER;
BEGIN
  UPDATE "exercicio_profissional_limite_ativo"
  SET "quantidade_ativa" = "quantidade_ativa" + delta
  WHERE "profissional_id" = alvo_profissional_id
  RETURNING "quantidade_ativa" INTO total_ativos;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contador de exercícios ativos inconsistente.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'exercicio_profissional_limite_ativo_quantidade_check';
  END IF;

  RETURN total_ativos;
END;
$$;

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

  SELECT cargo."permite_multiplos_exercicios"
  INTO permite_multiplos
  FROM "profissional" profissional
  JOIN "cargo_funcao" cargo ON cargo."id" = profissional."cargo_funcao_id"
  WHERE profissional."id" = NEW."profissional_id"
  FOR SHARE OF profissional, cargo;

  total_ativos := ajustar_limite_exercicio_profissional_ativo(NEW."profissional_id", 1);

  IF NOT permite_multiplos AND total_ativos > 1 THEN
    RAISE EXCEPTION 'O cargo do profissional não permite múltiplos exercícios ativos.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'exercicio_profissional_multiplos_ativos_check';
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

  SELECT "permite_multiplos_exercicios"
  INTO permite_multiplos
  FROM "cargo_funcao"
  WHERE "id" = NEW."cargo_funcao_id"
  FOR SHARE;

  SELECT "quantidade_ativa"
  INTO total_ativos
  FROM "exercicio_profissional_limite_ativo"
  WHERE "profissional_id" = NEW."id"
  FOR UPDATE;

  IF NOT permite_multiplos AND COALESCE(total_ativos, 0) > 1 THEN
    RAISE EXCEPTION 'O novo cargo não permite os múltiplos exercícios ativos do profissional.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'profissional_cargo_multiplos_exercicios_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "profissional_cargo_multiplos_exercicios_trigger"
BEFORE UPDATE OF "cargo_funcao_id"
ON "profissional"
FOR EACH ROW
EXECUTE FUNCTION validar_troca_cargo_exercicios_ativos();

CREATE OR REPLACE FUNCTION validar_capacidade_cargo_exercicios_ativos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  limite RECORD;
BEGIN
  IF OLD."permite_multiplos_exercicios" = NEW."permite_multiplos_exercicios" THEN
    RETURN NEW;
  END IF;

  IF NOT NEW."permite_multiplos_exercicios" THEN
    FOR limite IN
      SELECT controle."quantidade_ativa"
      FROM "exercicio_profissional_limite_ativo" controle
      JOIN "profissional" profissional
        ON profissional."id" = controle."profissional_id"
      WHERE profissional."cargo_funcao_id" = NEW."id"
      FOR UPDATE OF controle
    LOOP
      IF limite."quantidade_ativa" > 1 THEN
        RAISE EXCEPTION 'Existem profissionais com múltiplos exercícios ativos neste cargo.'
          USING ERRCODE = '23514',
                CONSTRAINT = 'cargo_funcao_multiplos_exercicios_check';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "cargo_funcao_multiplos_exercicios_trigger"
BEFORE UPDATE OF "permite_multiplos_exercicios"
ON "cargo_funcao"
FOR EACH ROW
EXECUTE FUNCTION validar_capacidade_cargo_exercicios_ativos();

CREATE OR REPLACE FUNCTION validar_usuario_unidade_cardinalidade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  alvo_usuario_id UUID;
  perfil_usuario "perfil_usuario";
  total_unidades INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'usuario' THEN
    IF TG_OP = 'DELETE' THEN
      alvo_usuario_id := OLD."id";
    ELSE
      alvo_usuario_id := NEW."id";
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      alvo_usuario_id := OLD."usuario_id";
    ELSE
      alvo_usuario_id := NEW."usuario_id";
    END IF;
  END IF;

  SELECT "perfil"
  INTO perfil_usuario
  FROM "usuario"
  WHERE "id" = alvo_usuario_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)
  INTO total_unidades
  FROM "usuario_unidade"
  WHERE "usuario_id" = alvo_usuario_id;

  IF perfil_usuario = 'DIRETOR' AND total_unidades < 1 THEN
    RAISE EXCEPTION 'Diretor exige ao menos uma unidade vinculada.'
      USING ERRCODE = '23514', CONSTRAINT = 'usuario_unidade_cardinalidade_check';
  ELSIF perfil_usuario = 'SECRETARIO' AND total_unidades <> 1 THEN
    RAISE EXCEPTION 'Secretário exige exatamente uma unidade vinculada.'
      USING ERRCODE = '23514', CONSTRAINT = 'usuario_unidade_cardinalidade_check';
  ELSIF perfil_usuario IN ('ADMINISTRADOR', 'OPERADOR') AND total_unidades <> 0 THEN
    RAISE EXCEPTION 'Este perfil não utiliza vínculo administrativo de unidade.'
      USING ERRCODE = '23514', CONSTRAINT = 'usuario_unidade_cardinalidade_check';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "usuario_unidade_cardinalidade_usuario_trigger"
AFTER INSERT OR UPDATE OF "perfil"
ON "usuario"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validar_usuario_unidade_cardinalidade();

CREATE CONSTRAINT TRIGGER "usuario_unidade_cardinalidade_vinculo_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "usuario_unidade"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validar_usuario_unidade_cardinalidade();

COMMIT;
