BEGIN;

CREATE TABLE IF NOT EXISTS periogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  dente INTEGER NOT NULL,
  condicoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  obs TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, dente),
  CHECK (dente BETWEEN 11 AND 85),
  CHECK (condicoes <@ '["tartaro", "retracao", "hipertrofia"]'::jsonb)
);

CREATE INDEX IF NOT EXISTS idx_periogramas_user_id ON periogramas(user_id);
CREATE INDEX IF NOT EXISTS idx_periogramas_paciente_id ON periogramas(paciente_id);

ALTER TABLE periogramas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_veem_seus_periogramas" ON periogramas;
CREATE POLICY "usuarios_veem_seus_periogramas" ON periogramas FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_criam_seus_periogramas" ON periogramas;
CREATE POLICY "usuarios_criam_seus_periogramas" ON periogramas FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = paciente_id AND pacientes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "usuarios_atualizam_seus_periogramas" ON periogramas;
CREATE POLICY "usuarios_atualizam_seus_periogramas" ON periogramas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_excluem_seus_periogramas" ON periogramas;
CREATE POLICY "usuarios_excluem_seus_periogramas" ON periogramas FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
