BEGIN;

CREATE TABLE IF NOT EXISTS historico_clinico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'consulta'
    CHECK (tipo IN ('consulta', 'evolucao', 'anamnese', 'exame', 'anotacao')),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  dentista TEXT,
  texto TEXT NOT NULL,
  baixa_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_clinico_user_id
  ON historico_clinico(user_id);
CREATE INDEX IF NOT EXISTS idx_historico_clinico_paciente_id
  ON historico_clinico(paciente_id);
CREATE INDEX IF NOT EXISTS idx_historico_clinico_data
  ON historico_clinico(data DESC);

ALTER TABLE historico_clinico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_veem_seu_historico_clinico" ON historico_clinico;
CREATE POLICY "usuarios_veem_seu_historico_clinico"
  ON historico_clinico FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_criam_seu_historico_clinico" ON historico_clinico;
CREATE POLICY "usuarios_criam_seu_historico_clinico"
  ON historico_clinico FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = paciente_id
        AND pacientes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "usuarios_atualizam_seu_historico_clinico" ON historico_clinico;
CREATE POLICY "usuarios_atualizam_seu_historico_clinico"
  ON historico_clinico FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_excluem_seu_historico_clinico" ON historico_clinico;
CREATE POLICY "usuarios_excluem_seu_historico_clinico"
  ON historico_clinico FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
