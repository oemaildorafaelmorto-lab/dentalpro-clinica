BEGIN;

CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  dentista TEXT NOT NULL,
  convenio_id TEXT,
  convenio_nome TEXT,
  tabela_preco_id UUID REFERENCES tabelas_preco(id) ON DELETE SET NULL,
  tabela_preco_nome TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON orcamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_paciente_id ON orcamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_data ON orcamentos(data DESC);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_veem_seus_orcamentos" ON orcamentos;
CREATE POLICY "usuarios_veem_seus_orcamentos"
  ON orcamentos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_criam_seus_orcamentos" ON orcamentos;
CREATE POLICY "usuarios_criam_seus_orcamentos"
  ON orcamentos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = paciente_id
        AND pacientes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "usuarios_atualizam_seus_orcamentos" ON orcamentos;
CREATE POLICY "usuarios_atualizam_seus_orcamentos"
  ON orcamentos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_excluem_seus_orcamentos" ON orcamentos;
CREATE POLICY "usuarios_excluem_seus_orcamentos"
  ON orcamentos FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
