-- Corrige fichas repetidas e passa a gerar uma sequência por usuário.
-- O UUID em pacientes.id continua sendo o identificador técnico imutável.

BEGIN;

LOCK TABLE pacientes IN SHARE ROW EXCLUSIVE MODE;

WITH fichas_corrigidas AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY created_at, id
    )::integer AS nova_ficha
  FROM pacientes
)
UPDATE pacientes AS p
SET ficha = f.nova_ficha
FROM fichas_corrigidas AS f
WHERE p.id = f.id
  AND p.ficha IS DISTINCT FROM f.nova_ficha;

ALTER TABLE pacientes
  ALTER COLUMN ficha SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pacientes_user_id_ficha_key
  ON pacientes (user_id, ficha);

CREATE OR REPLACE FUNCTION definir_ficha_paciente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF NEW.ficha IS NULL THEN
    SELECT COALESCE(MAX(ficha), 0) + 1
      INTO NEW.ficha
      FROM pacientes
     WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pacientes_definir_ficha ON pacientes;

CREATE TRIGGER pacientes_definir_ficha
BEFORE INSERT ON pacientes
FOR EACH ROW
EXECUTE FUNCTION definir_ficha_paciente();

COMMIT;
