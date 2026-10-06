-- Etapa 6: cargo da sessão, snapshot de filhos e congelamento da fila.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "evento") THEN
    RAISE EXCEPTION
      'Não é possível aplicar a Etapa 6: existem eventos legados sem cargo/função determinável.';
  END IF;
END
$$;

ALTER TABLE "evento"
ADD COLUMN "cargo_funcao_id" UUID NOT NULL;

CREATE INDEX "evento_cargo_funcao_idx"
ON "evento"("cargo_funcao_id");

ALTER TABLE "evento"
ADD CONSTRAINT "evento_cargo_funcao_id_fkey"
FOREIGN KEY ("cargo_funcao_id") REFERENCES "cargo_funcao"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evento_participante"
ADD COLUMN "numero_filhos_snapshot" INTEGER,
ADD CONSTRAINT "evento_participante_numero_filhos_snapshot_check"
CHECK ("numero_filhos_snapshot" IS NULL OR "numero_filhos_snapshot" >= 0);

CREATE OR REPLACE FUNCTION proteger_evento_estrutural_congelado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" <> 'RASCUNHO' AND NEW."status" = 'RASCUNHO' THEN
    RAISE EXCEPTION 'Um evento iniciado não pode voltar para RASCUNHO.'
      USING ERRCODE = '23514', CONSTRAINT = 'evento_status_reabertura_check';
  END IF;

  IF (OLD."status" <> 'RASCUNHO' OR NEW."status" <> 'RASCUNHO') AND (
    NEW."tipo" IS DISTINCT FROM OLD."tipo"
    OR NEW."ano" IS DISTINCT FROM OLD."ano"
    OR NEW."cargo_funcao_id" IS DISTINCT FROM OLD."cargo_funcao_id"
  ) THEN
    RAISE EXCEPTION 'A estrutura de um evento iniciado está congelada.'
      USING ERRCODE = '23514', CONSTRAINT = 'evento_estrutura_congelada_check';
  END IF;

  IF OLD."status" <> 'RASCUNHO' AND (
    NEW."iniciado_por_usuario_id" IS DISTINCT FROM OLD."iniciado_por_usuario_id"
    OR NEW."data_inicio" IS DISTINCT FROM OLD."data_inicio"
  ) THEN
    RAISE EXCEPTION 'Os dados de início de um evento iniciado estão congelados.'
      USING ERRCODE = '23514', CONSTRAINT = 'evento_inicio_congelado_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER evento_estrutura_congelada_trigger
BEFORE UPDATE ON "evento"
FOR EACH ROW
EXECUTE FUNCTION proteger_evento_estrutural_congelado();

CREATE OR REPLACE FUNCTION proteger_evento_participante_congelado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  evento_status_anterior "status_evento";
  evento_status_novo "status_evento";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT "status"
    INTO evento_status_anterior
    FROM "evento"
    WHERE "id" = OLD."evento_id";
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT "status"
    INTO evento_status_novo
    FROM "evento"
    WHERE "id" = NEW."evento_id";
  END IF;

  IF (TG_OP <> 'INSERT' AND evento_status_anterior IS NULL)
    OR (TG_OP <> 'DELETE' AND evento_status_novo IS NULL)
  THEN
    RAISE EXCEPTION 'Evento do participante não encontrado.';
  END IF;

  IF evento_status_anterior <> 'RASCUNHO' OR evento_status_novo <> 'RASCUNHO' THEN
    IF TG_OP IN ('INSERT', 'DELETE') THEN
      RAISE EXCEPTION 'A lista de participantes de um evento iniciado está congelada.'
        USING ERRCODE = '23514', CONSTRAINT = 'evento_participante_lista_congelada_check';
    END IF;

    IF NEW."evento_id" IS DISTINCT FROM OLD."evento_id"
      OR NEW."profissional_id" IS DISTINCT FROM OLD."profissional_id"
      OR NEW."pontuacao_snapshot" IS DISTINCT FROM OLD."pontuacao_snapshot"
      OR NEW."data_entrada_snapshot" IS DISTINCT FROM OLD."data_entrada_snapshot"
      OR NEW."data_nascimento_snapshot" IS DISTINCT FROM OLD."data_nascimento_snapshot"
      OR NEW."numero_filhos_snapshot" IS DISTINCT FROM OLD."numero_filhos_snapshot"
      OR NEW."posicao" IS DISTINCT FROM OLD."posicao"
    THEN
      RAISE EXCEPTION 'Os dados oficiais da fila de um evento iniciado estão congelados.'
        USING ERRCODE = '23514', CONSTRAINT = 'evento_participante_dados_congelados_check';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER evento_participante_congelado_trigger
BEFORE INSERT OR UPDATE OR DELETE ON "evento_participante"
FOR EACH ROW
EXECUTE FUNCTION proteger_evento_participante_congelado();

-- Regression hardening: acquire locks in the same professional -> role -> counter
-- order used by role changes, then read the current role after obtaining the
-- professional lock. This removes a stale-role race without changing the rule.
CREATE OR REPLACE FUNCTION sincronizar_limite_exercicio_profissional_ativo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cargo_atual_id UUID;
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

  IF TG_OP = 'UPDATE' AND NEW."data_fim" IS NOT NULL THEN
    IF OLD."data_fim" IS NULL THEN
      PERFORM ajustar_limite_exercicio_profissional_ativo(OLD."profissional_id", -1);
    END IF;
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM "profissional"
  WHERE "id" = NEW."profissional_id"
  FOR SHARE;

  SELECT "cargo_funcao_id"
  INTO cargo_atual_id
  FROM "profissional"
  WHERE "id" = NEW."profissional_id";

  SELECT "permite_multiplos_exercicios"
  INTO permite_multiplos
  FROM "cargo_funcao"
  WHERE "id" = cargo_atual_id
  FOR SHARE;

  IF TG_OP = 'UPDATE' AND OLD."data_fim" IS NULL THEN
    PERFORM ajustar_limite_exercicio_profissional_ativo(OLD."profissional_id", -1);
  END IF;

  total_ativos := ajustar_limite_exercicio_profissional_ativo(NEW."profissional_id", 1);

  IF NOT permite_multiplos AND total_ativos > 1 THEN
    RAISE EXCEPTION 'O cargo do profissional não permite múltiplos exercícios ativos.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'exercicio_profissional_multiplos_ativos_check';
  END IF;

  RETURN NEW;
END;
$$;
