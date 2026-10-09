ALTER TABLE "unidade"
  DROP CONSTRAINT "unidade_tipo_unidade_codigo_check";

ALTER TABLE "unidade"
  ADD CONSTRAINT "unidade_tipo_unidade_codigo_check"
  CHECK (
    "tipo_unidade_id" IN (
      'EMEI',
      'EMEF',
      'CIEP',
      'CRECHE',
      'CASA_DA_CRIANCA',
      'CMEA',
      'CENTRO_DE_INCLUSAO'
    )
  );
