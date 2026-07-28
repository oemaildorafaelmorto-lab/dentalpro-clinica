BEGIN;

ALTER TABLE orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_status_check;

ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('pendente', 'parcialmente_aprovado', 'aprovado', 'cancelado'));

COMMIT;
