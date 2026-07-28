BEGIN;

CREATE TABLE IF NOT EXISTS tabelas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'particular'
    CHECK (tipo IN ('particular', 'convenio', 'outro')),
  convenio_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  padrao BOOLEAN NOT NULL DEFAULT FALSE,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tabelas_preco_user_id
  ON tabelas_preco(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS tabelas_preco_padrao_por_usuario
  ON tabelas_preco(user_id)
  WHERE padrao = TRUE;

ALTER TABLE tabelas_preco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_veem_suas_tabelas_preco" ON tabelas_preco;
CREATE POLICY "usuarios_veem_suas_tabelas_preco"
  ON tabelas_preco FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_criam_suas_tabelas_preco" ON tabelas_preco;
CREATE POLICY "usuarios_criam_suas_tabelas_preco"
  ON tabelas_preco FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_atualizam_suas_tabelas_preco" ON tabelas_preco;
CREATE POLICY "usuarios_atualizam_suas_tabelas_preco"
  ON tabelas_preco FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "usuarios_excluem_suas_tabelas_preco" ON tabelas_preco;
CREATE POLICY "usuarios_excluem_suas_tabelas_preco"
  ON tabelas_preco FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
