BEGIN;

ALTER TABLE "quadro_necessidade"
DROP CONSTRAINT "quadro_necessidade_quantidade_check";

ALTER TABLE "quadro_necessidade"
ADD CONSTRAINT "quadro_necessidade_quantidade_check"
CHECK ("quantidade" >= 0);

COMMIT;
