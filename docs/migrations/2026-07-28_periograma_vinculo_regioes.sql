BEGIN;

ALTER TABLE periograma_versoes
  ADD COLUMN IF NOT EXISTS divisao TEXT NOT NULL DEFAULT 'sextantes',
  ADD COLUMN IF NOT EXISTS odontograma_versao_id UUID
    REFERENCES odontograma_versoes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS odontograma_versao_titulo TEXT,
  ADD COLUMN IF NOT EXISTS odontograma_versao_data DATE;

ALTER TABLE periograma_versoes
  DROP CONSTRAINT IF EXISTS periograma_versoes_divisao_check;
ALTER TABLE periograma_versoes
  ADD CONSTRAINT periograma_versoes_divisao_check
  CHECK (divisao IN ('sextantes', 'quadrantes'));

CREATE INDEX IF NOT EXISTS idx_periograma_versoes_odontograma
  ON periograma_versoes(odontograma_versao_id);

COMMIT;
