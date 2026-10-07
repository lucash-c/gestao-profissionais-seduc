ALTER TABLE "auditoria"
  ADD COLUMN "unidade_id" UUID,
  ADD COLUMN "profissional_id" UUID;

CREATE INDEX "auditoria_unidade_data_idx"
  ON "auditoria"("unidade_id", "data_hora");

CREATE INDEX "auditoria_profissional_data_idx"
  ON "auditoria"("profissional_id", "data_hora");
