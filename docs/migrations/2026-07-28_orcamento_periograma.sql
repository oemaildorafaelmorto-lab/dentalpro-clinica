BEGIN;

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS periograma_versao_id UUID
    REFERENCES periograma_versoes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS periograma_versao_titulo TEXT,
  ADD COLUMN IF NOT EXISTS periograma_versao_data DATE;

CREATE INDEX IF NOT EXISTS idx_orcamentos_periograma_versao
  ON orcamentos(periograma_versao_id);

COMMIT;
