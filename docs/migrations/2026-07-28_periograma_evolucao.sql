BEGIN;

CREATE TABLE IF NOT EXISTS periograma_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  titulo TEXT NOT NULL,
  obs TEXT NOT NULL DEFAULT '',
  dentes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_periograma_versoes_user_id
  ON periograma_versoes(user_id);
CREATE INDEX IF NOT EXISTS idx_periograma_versoes_paciente_data
  ON periograma_versoes(paciente_id, data DESC);

ALTER TABLE periograma_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_gerenciam_suas_versoes_periograma" ON periograma_versoes;
CREATE POLICY "usuarios_gerenciam_suas_versoes_periograma"
  ON periograma_versoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = paciente_id AND pacientes.user_id = auth.uid()
    )
  );

COMMIT;
