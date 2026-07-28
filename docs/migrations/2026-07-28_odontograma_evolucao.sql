BEGIN;

CREATE TABLE IF NOT EXISTS odontograma_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  titulo TEXT NOT NULL,
  obs TEXT NOT NULL DEFAULT '',
  dentes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odontograma_versoes_user_id
  ON odontograma_versoes(user_id);
CREATE INDEX IF NOT EXISTS idx_odontograma_versoes_paciente_data
  ON odontograma_versoes(paciente_id, data DESC);

ALTER TABLE odontograma_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_gerenciam_suas_versoes_odontograma" ON odontograma_versoes;
CREATE POLICY "usuarios_gerenciam_suas_versoes_odontograma"
  ON odontograma_versoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = paciente_id AND pacientes.user_id = auth.uid()
    )
  );

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS odontograma_versao_id UUID
    REFERENCES odontograma_versoes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS odontograma_versao_titulo TEXT,
  ADD COLUMN IF NOT EXISTS odontograma_versao_data DATE;

CREATE INDEX IF NOT EXISTS idx_orcamentos_odontograma_versao
  ON orcamentos(odontograma_versao_id);

COMMIT;
