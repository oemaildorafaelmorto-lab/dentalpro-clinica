BEGIN;

CREATE TABLE IF NOT EXISTS odontogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  dente INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'higido',
  obs TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, dente)
);

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
  CHECK (condicoes <@ '["tartaro", "retracao", "hipertrofia"]'::jsonb)
);

CREATE TABLE IF NOT EXISTS estado_app (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odontogramas_user_id ON odontogramas(user_id);
CREATE INDEX IF NOT EXISTS idx_odontogramas_paciente_id ON odontogramas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_periogramas_user_id ON periogramas(user_id);
CREATE INDEX IF NOT EXISTS idx_periogramas_paciente_id ON periogramas(paciente_id);

ALTER TABLE odontogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE periogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_app ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_gerenciam_seus_odontogramas" ON odontogramas;
CREATE POLICY "usuarios_gerenciam_seus_odontogramas" ON odontogramas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = paciente_id AND pacientes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "usuarios_gerenciam_seus_periogramas" ON periogramas;
CREATE POLICY "usuarios_gerenciam_seus_periogramas" ON periogramas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = paciente_id AND pacientes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "usuarios_gerenciam_seu_estado_app" ON estado_app;
CREATE POLICY "usuarios_gerenciam_seu_estado_app" ON estado_app
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
