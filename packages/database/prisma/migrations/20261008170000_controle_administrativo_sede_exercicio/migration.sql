ALTER TABLE "posto_trabalho"
ADD COLUMN "reservado_para_evento" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "posto_trabalho_reservado_para_evento_idx"
ON "posto_trabalho"("reservado_para_evento")
WHERE "reservado_para_evento" = TRUE;
