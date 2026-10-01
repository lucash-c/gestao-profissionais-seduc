-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "perfil_usuario" AS ENUM ('ADMINISTRADOR', 'OPERADOR', 'DIRETOR', 'SECRETARIO');

-- CreateEnum
CREATE TYPE "tipo_exercicio" AS ENUM ('SEDE', 'SUBSTITUICAO', 'SEM_SEDE');

-- CreateEnum
CREATE TYPE "tipo_evento" AS ENUM ('REMOCAO', 'PERMUTA', 'LISTAO');

-- CreateEnum
CREATE TYPE "status_evento" AS ENUM ('RASCUNHO', 'ATIVO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "status_evento_participante" AS ENUM ('SELECIONADO', 'AGUARDANDO', 'ATENDIDO', 'EMPATE_PENDENTE');

-- CreateEnum
CREATE TYPE "tipo_movimentacao" AS ENUM ('REMOCAO', 'PERMUTA', 'LISTAO');

-- CreateEnum
CREATE TYPE "tipo_destino_movimentacao" AS ENUM ('SEDE', 'SEM_SEDE');

-- CreateEnum
CREATE TYPE "acao_auditoria" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "tipo_unidade" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipo_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade" (
    "id" UUID NOT NULL,
    "tipo_unidade_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "endereco" VARCHAR(200),
    "numero" VARCHAR(20),
    "complemento" VARCHAR(120),
    "bairro" VARCHAR(120),
    "cidade" VARCHAR(120),
    "cep" VARCHAR(8),
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "codigo_inep" VARCHAR(20),
    "polo_regiao" VARCHAR(120),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade_telefone" (
    "id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "numero" VARCHAR(30) NOT NULL,

    CONSTRAINT "unidade_telefone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_funcao" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "eh_professor" BOOLEAN NOT NULL DEFAULT false,
    "usa_pontuacao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_funcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_tipo_unidade" (
    "cargo_funcao_id" UUID NOT NULL,
    "tipo_unidade_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_tipo_unidade_pkey" PRIMARY KEY ("cargo_funcao_id","tipo_unidade_id")
);

-- CreateTable
CREATE TABLE "periodo" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segmento_ensino" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segmento_ensino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional" (
    "id" UUID NOT NULL,
    "matricula" VARCHAR(50) NOT NULL,
    "nome_completo" VARCHAR(200) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "cargo_funcao_id" UUID NOT NULL,
    "pontuacao" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remocao" BOOLEAN NOT NULL DEFAULT false,
    "permuta" BOOLEAN NOT NULL DEFAULT false,
    "data_entrada_prefeitura" DATE NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "email" VARCHAR(254),
    "data_desligamento" DATE,
    "endereco" VARCHAR(200),
    "numero" VARCHAR(20),
    "complemento" VARCHAR(120),
    "bairro" VARCHAR(120),
    "cidade" VARCHAR(120),
    "cep" VARCHAR(8),
    "numero_filhos" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional_telefone" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "numero" VARCHAR(30) NOT NULL,

    CONSTRAINT "profissional_telefone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quadro_necessidade" (
    "id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "cargo_funcao_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "segmento_ensino_id" UUID,
    "quantidade" INTEGER NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quadro_necessidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posto_trabalho" (
    "id" UUID NOT NULL,
    "quadro_necessidade_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "cargo_funcao_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "ano_letivo" INTEGER NOT NULL,
    "codigo" VARCHAR(80),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posto_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotacao_sede" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "posto_trabalho_id" UUID NOT NULL,
    "data_inicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMPTZ(3),
    "motivo_fim" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotacao_sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercicio_profissional" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "posto_trabalho_id" UUID NOT NULL,
    "tipo_exercicio" "tipo_exercicio" NOT NULL,
    "substitui_profissional_id" UUID,
    "data_inicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMPTZ(3),
    "observacoes" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercicio_profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "afastamento_profissional" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "tipo" VARCHAR(120) NOT NULL,
    "data_inicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMPTZ(3),
    "observacoes" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "afastamento_profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "login" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254),
    "senha_hash" VARCHAR(255),
    "perfil" "perfil_usuario" NOT NULL,
    "unidade_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento" (
    "id" UUID NOT NULL,
    "tipo" "tipo_evento" NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "ano" INTEGER NOT NULL,
    "status" "status_evento" NOT NULL DEFAULT 'RASCUNHO',
    "iniciado_por_usuario_id" UUID,
    "data_inicio" TIMESTAMPTZ(3),
    "data_fim" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_participante" (
    "id" UUID NOT NULL,
    "evento_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "pontuacao_snapshot" DECIMAL(12,2),
    "data_entrada_snapshot" DATE,
    "data_nascimento_snapshot" DATE,
    "posicao" INTEGER,
    "status" "status_evento_participante" NOT NULL DEFAULT 'SELECIONADO',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_participante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacao" (
    "id" UUID NOT NULL,
    "evento_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "data_hora" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "tipo_movimentacao" NOT NULL,

    CONSTRAINT "movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacao_item" (
    "id" UUID NOT NULL,
    "movimentacao_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "posto_origem_id" UUID,
    "posto_destino_id" UUID NOT NULL,
    "tipo_destino" "tipo_destino_movimentacao" NOT NULL,
    "substitui_profissional_id" UUID,

    CONSTRAINT "movimentacao_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "entidade" VARCHAR(120) NOT NULL,
    "registro_id" VARCHAR(120) NOT NULL,
    "acao" "acao_auditoria" NOT NULL,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "data_hora" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_unidade_nome_key" ON "tipo_unidade"("nome");

-- CreateIndex
CREATE INDEX "unidade_tipo_unidade_idx" ON "unidade"("tipo_unidade_id");

-- CreateIndex
CREATE INDEX "unidade_nome_idx" ON "unidade"("nome");

-- CreateIndex
CREATE INDEX "unidade_ativo_idx" ON "unidade"("ativo");

-- CreateIndex
CREATE INDEX "unidade_telefone_unidade_idx" ON "unidade_telefone"("unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_funcao_nome_key" ON "cargo_funcao"("nome");

-- CreateIndex
CREATE INDEX "cargo_funcao_ativo_idx" ON "cargo_funcao"("ativo");

-- CreateIndex
CREATE INDEX "cargo_tipo_unidade_tipo_idx" ON "cargo_tipo_unidade"("tipo_unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_nome_key" ON "periodo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "segmento_ensino_nome_key" ON "segmento_ensino"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "profissional_matricula_key" ON "profissional"("matricula");

-- CreateIndex
CREATE INDEX "profissional_nome_completo_idx" ON "profissional"("nome_completo");

-- CreateIndex
CREATE INDEX "profissional_cpf_idx" ON "profissional"("cpf");

-- CreateIndex
CREATE INDEX "profissional_cargo_ativo_idx" ON "profissional"("cargo_funcao_id", "ativo");

-- CreateIndex
CREATE INDEX "profissional_telefone_profissional_idx" ON "profissional_telefone"("profissional_id");

-- CreateIndex
CREATE INDEX "quadro_necessidade_unidade_ano_idx" ON "quadro_necessidade"("unidade_id", "ano_letivo");

-- CreateIndex
CREATE INDEX "quadro_necessidade_cargo_idx" ON "quadro_necessidade"("cargo_funcao_id");

-- CreateIndex
CREATE INDEX "quadro_necessidade_periodo_idx" ON "quadro_necessidade"("periodo_id");

-- CreateIndex
CREATE INDEX "quadro_necessidade_segmento_idx" ON "quadro_necessidade"("segmento_ensino_id");

-- CreateIndex
CREATE UNIQUE INDEX "quadro_necessidade_posto_ref_key" ON "quadro_necessidade"("id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo");

-- CreateIndex
CREATE INDEX "posto_trabalho_escopo_idx" ON "posto_trabalho"("unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo");

-- CreateIndex
CREATE INDEX "posto_trabalho_quadro_idx" ON "posto_trabalho"("quadro_necessidade_id");

-- CreateIndex
CREATE INDEX "posto_trabalho_ativo_idx" ON "posto_trabalho"("ativo");

-- CreateIndex
CREATE INDEX "lotacao_sede_profissional_historico_idx" ON "lotacao_sede"("profissional_id", "data_fim");

-- CreateIndex
CREATE INDEX "lotacao_sede_posto_historico_idx" ON "lotacao_sede"("posto_trabalho_id", "data_fim");

-- CreateIndex
CREATE INDEX "exercicio_profissional_historico_idx" ON "exercicio_profissional"("profissional_id", "data_fim");

-- CreateIndex
CREATE INDEX "exercicio_posto_historico_idx" ON "exercicio_profissional"("posto_trabalho_id", "data_fim");

-- CreateIndex
CREATE INDEX "exercicio_substituido_idx" ON "exercicio_profissional"("substitui_profissional_id");

-- CreateIndex
CREATE INDEX "afastamento_profissional_historico_idx" ON "afastamento_profissional"("profissional_id", "data_fim");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_login_key" ON "usuario"("login");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_unidade_idx" ON "usuario"("unidade_id");

-- CreateIndex
CREATE INDEX "usuario_perfil_ativo_idx" ON "usuario"("perfil", "ativo");

-- CreateIndex
CREATE INDEX "evento_status_ano_idx" ON "evento"("status", "ano");

-- CreateIndex
CREATE INDEX "evento_iniciado_por_idx" ON "evento"("iniciado_por_usuario_id");

-- CreateIndex
CREATE INDEX "evento_participante_evento_status_idx" ON "evento_participante"("evento_id", "status");

-- CreateIndex
CREATE INDEX "evento_participante_profissional_idx" ON "evento_participante"("profissional_id");

-- CreateIndex
CREATE UNIQUE INDEX "evento_participante_evento_profissional_key" ON "evento_participante"("evento_id", "profissional_id");

-- CreateIndex
CREATE UNIQUE INDEX "evento_participante_evento_posicao_key" ON "evento_participante"("evento_id", "posicao");

-- CreateIndex
CREATE INDEX "movimentacao_evento_data_idx" ON "movimentacao"("evento_id", "data_hora");

-- CreateIndex
CREATE INDEX "movimentacao_usuario_idx" ON "movimentacao"("usuario_id");

-- CreateIndex
CREATE INDEX "movimentacao_item_posto_origem_idx" ON "movimentacao_item"("posto_origem_id");

-- CreateIndex
CREATE INDEX "movimentacao_item_posto_destino_idx" ON "movimentacao_item"("posto_destino_id");

-- CreateIndex
CREATE INDEX "movimentacao_item_substituido_idx" ON "movimentacao_item"("substitui_profissional_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimentacao_item_movimentacao_profissional_key" ON "movimentacao_item"("movimentacao_id", "profissional_id");

-- CreateIndex
CREATE INDEX "auditoria_usuario_data_idx" ON "auditoria"("usuario_id", "data_hora");

-- CreateIndex
CREATE INDEX "auditoria_registro_idx" ON "auditoria"("entidade", "registro_id");

-- CreateIndex
CREATE INDEX "auditoria_data_idx" ON "auditoria"("data_hora");

-- AddForeignKey
ALTER TABLE "unidade" ADD CONSTRAINT "unidade_tipo_unidade_id_fkey" FOREIGN KEY ("tipo_unidade_id") REFERENCES "tipo_unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidade_telefone" ADD CONSTRAINT "unidade_telefone_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_tipo_unidade" ADD CONSTRAINT "cargo_tipo_unidade_cargo_funcao_id_fkey" FOREIGN KEY ("cargo_funcao_id") REFERENCES "cargo_funcao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_tipo_unidade" ADD CONSTRAINT "cargo_tipo_unidade_tipo_unidade_id_fkey" FOREIGN KEY ("tipo_unidade_id") REFERENCES "tipo_unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional" ADD CONSTRAINT "profissional_cargo_funcao_id_fkey" FOREIGN KEY ("cargo_funcao_id") REFERENCES "cargo_funcao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional_telefone" ADD CONSTRAINT "profissional_telefone_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadro_necessidade" ADD CONSTRAINT "quadro_necessidade_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadro_necessidade" ADD CONSTRAINT "quadro_necessidade_cargo_funcao_id_fkey" FOREIGN KEY ("cargo_funcao_id") REFERENCES "cargo_funcao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadro_necessidade" ADD CONSTRAINT "quadro_necessidade_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadro_necessidade" ADD CONSTRAINT "quadro_necessidade_segmento_ensino_id_fkey" FOREIGN KEY ("segmento_ensino_id") REFERENCES "segmento_ensino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posto_trabalho" ADD CONSTRAINT "posto_trabalho_quadro_necessidade_id_unidade_id_cargo_func_fkey" FOREIGN KEY ("quadro_necessidade_id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo") REFERENCES "quadro_necessidade"("id", "unidade_id", "cargo_funcao_id", "periodo_id", "ano_letivo") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lotacao_sede" ADD CONSTRAINT "lotacao_sede_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotacao_sede" ADD CONSTRAINT "lotacao_sede_posto_trabalho_id_fkey" FOREIGN KEY ("posto_trabalho_id") REFERENCES "posto_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicio_profissional" ADD CONSTRAINT "exercicio_profissional_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicio_profissional" ADD CONSTRAINT "exercicio_profissional_posto_trabalho_id_fkey" FOREIGN KEY ("posto_trabalho_id") REFERENCES "posto_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicio_profissional" ADD CONSTRAINT "exercicio_profissional_substitui_profissional_id_fkey" FOREIGN KEY ("substitui_profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afastamento_profissional" ADD CONSTRAINT "afastamento_profissional_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_iniciado_por_usuario_id_fkey" FOREIGN KEY ("iniciado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_participante" ADD CONSTRAINT "evento_participante_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_participante" ADD CONSTRAINT "evento_participante_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao" ADD CONSTRAINT "movimentacao_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao" ADD CONSTRAINT "movimentacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_item" ADD CONSTRAINT "movimentacao_item_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_item" ADD CONSTRAINT "movimentacao_item_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_item" ADD CONSTRAINT "movimentacao_item_posto_origem_id_fkey" FOREIGN KEY ("posto_origem_id") REFERENCES "posto_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_item" ADD CONSTRAINT "movimentacao_item_posto_destino_id_fkey" FOREIGN KEY ("posto_destino_id") REFERENCES "posto_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_item" ADD CONSTRAINT "movimentacao_item_substitui_profissional_id_fkey" FOREIGN KEY ("substitui_profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual PostgreSQL constraints
-- Prisma does not currently represent partial unique indexes in schema.prisma.

-- A staffing scope with a segment cannot be duplicated.
CREATE UNIQUE INDEX "quadro_necessidade_escopo_com_segmento_key"
ON "quadro_necessidade"("unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id", "segmento_ensino_id")
WHERE "segmento_ensino_id" IS NOT NULL;

-- A staffing scope without a segment cannot be duplicated either.
CREATE UNIQUE INDEX "quadro_necessidade_escopo_sem_segmento_key"
ON "quadro_necessidade"("unidade_id", "ano_letivo", "cargo_funcao_id", "periodo_id")
WHERE "segmento_ensino_id" IS NULL;

-- A professional can have at most one active official placement.
CREATE UNIQUE INDEX "lotacao_sede_profissional_ativa_key"
ON "lotacao_sede"("profissional_id")
WHERE "data_fim" IS NULL;

-- A work position can have at most one active official holder.
CREATE UNIQUE INDEX "lotacao_sede_posto_ativo_key"
ON "lotacao_sede"("posto_trabalho_id")
WHERE "data_fim" IS NULL;

-- A professional can have at most one active exercise record.
CREATE UNIQUE INDEX "exercicio_profissional_profissional_ativo_key"
ON "exercicio_profissional"("profissional_id")
WHERE "data_fim" IS NULL;

-- A work position can have at most one active occupant.
CREATE UNIQUE INDEX "exercicio_profissional_posto_ativo_key"
ON "exercicio_profissional"("posto_trabalho_id")
WHERE "data_fim" IS NULL;

ALTER TABLE "cargo_funcao"
ADD CONSTRAINT "cargo_funcao_pontuacao_professor_check"
CHECK (NOT "usa_pontuacao" OR "eh_professor");

ALTER TABLE "profissional"
ADD CONSTRAINT "profissional_cpf_formato_check"
CHECK ("cpf" ~ '^[0-9]{11}$'),
ADD CONSTRAINT "profissional_numero_filhos_check"
CHECK ("numero_filhos" >= 0),
ADD CONSTRAINT "profissional_datas_check"
CHECK ("data_desligamento" IS NULL OR "data_desligamento" >= "data_entrada_prefeitura");

ALTER TABLE "quadro_necessidade"
ADD CONSTRAINT "quadro_necessidade_ano_check"
CHECK ("ano_letivo" > 0),
ADD CONSTRAINT "quadro_necessidade_quantidade_check"
CHECK ("quantidade" > 0);

ALTER TABLE "posto_trabalho"
ADD CONSTRAINT "posto_trabalho_ano_check"
CHECK ("ano_letivo" > 0);

ALTER TABLE "lotacao_sede"
ADD CONSTRAINT "lotacao_sede_periodo_check"
CHECK ("data_fim" IS NULL OR "data_fim" > "data_inicio");

ALTER TABLE "exercicio_profissional"
ADD CONSTRAINT "exercicio_profissional_periodo_check"
CHECK ("data_fim" IS NULL OR "data_fim" > "data_inicio"),
ADD CONSTRAINT "exercicio_profissional_tipo_substituicao_check"
CHECK (
  ("tipo_exercicio" = 'SEDE' AND "substitui_profissional_id" IS NULL)
  OR
  ("tipo_exercicio" IN ('SUBSTITUICAO', 'SEM_SEDE') AND "substitui_profissional_id" IS NOT NULL)
),
ADD CONSTRAINT "exercicio_profissional_auto_substituicao_check"
CHECK ("substitui_profissional_id" IS NULL OR "substitui_profissional_id" <> "profissional_id");

ALTER TABLE "afastamento_profissional"
ADD CONSTRAINT "afastamento_profissional_periodo_check"
CHECK ("data_fim" IS NULL OR "data_fim" > "data_inicio");

ALTER TABLE "usuario"
ADD CONSTRAINT "usuario_unidade_perfil_check"
CHECK ("perfil" NOT IN ('DIRETOR', 'SECRETARIO') OR "unidade_id" IS NOT NULL);

ALTER TABLE "evento"
ADD CONSTRAINT "evento_ano_check"
CHECK ("ano" > 0),
ADD CONSTRAINT "evento_periodo_check"
CHECK ("data_fim" IS NULL OR "data_inicio" IS NULL OR "data_fim" > "data_inicio");

ALTER TABLE "evento_participante"
ADD CONSTRAINT "evento_participante_posicao_check"
CHECK ("posicao" IS NULL OR "posicao" > 0);

ALTER TABLE "movimentacao_item"
ADD CONSTRAINT "movimentacao_item_tipo_substituicao_check"
CHECK (
  ("tipo_destino" = 'SEDE' AND "substitui_profissional_id" IS NULL)
  OR
  ("tipo_destino" = 'SEM_SEDE' AND "substitui_profissional_id" IS NOT NULL)
);
