-- Login and email share one logical identifier namespace across user accounts.
-- A dedicated registry gives PostgreSQL a single unique key for both source columns.

CREATE TABLE "usuario_identificador" (
    "identificador" VARCHAR(254) NOT NULL,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "usuario_identificador_namespace_key" PRIMARY KEY ("identificador")
);

CREATE INDEX "usuario_identificador_usuario_idx"
ON "usuario_identificador"("usuario_id");

ALTER TABLE "usuario_identificador"
ADD CONSTRAINT "usuario_identificador_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- This initial population also refuses migration when legacy accounts are ambiguous.
INSERT INTO "usuario_identificador" ("identificador", "usuario_id")
SELECT DISTINCT identificador, "id"
FROM "usuario"
CROSS JOIN LATERAL unnest(ARRAY["login"::TEXT, "email"::TEXT]) AS valores(identificador)
WHERE identificador IS NOT NULL;

CREATE FUNCTION "sincronizar_usuario_identificadores"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM "usuario_identificador"
        WHERE "usuario_id" = NEW."id";
    END IF;

    INSERT INTO "usuario_identificador" ("identificador", "usuario_id")
    SELECT DISTINCT identificador, NEW."id"
    FROM unnest(ARRAY[NEW."login"::TEXT, NEW."email"::TEXT]) AS valores(identificador)
    WHERE identificador IS NOT NULL;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "usuario_identificador_unico_trigger"
AFTER INSERT OR UPDATE OF "login", "email" ON "usuario"
FOR EACH ROW
EXECUTE FUNCTION "sincronizar_usuario_identificadores"();
