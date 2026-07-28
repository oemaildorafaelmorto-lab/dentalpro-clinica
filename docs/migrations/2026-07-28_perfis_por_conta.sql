BEGIN;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT,
  role TEXT NOT NULL DEFAULT 'administrativo'
    CHECK (role IN ('admin', 'administrativo', 'dentista_contratado')),
  dentista_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_le_seu_proprio_perfil" ON profiles;
CREATE POLICY "usuario_le_seu_proprio_perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- O tier é alterado diretamente pelo SQL Editor/Supabase.
-- Não existe policy de UPDATE para o aplicativo.

INSERT INTO profiles (id, email, nome, role)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'nome', split_part(email, '@', 1)),
  CASE
    WHEN lower(email) = 'contato@clinicacf.com.br'
      OR (lower(email) LIKE '%isaias%' AND lower(email) LIKE '%game%' AND lower(email) LIKE '%dev%')
      THEN 'admin'
    ELSE 'administrativo'
  END
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = CASE
      WHEN lower(EXCLUDED.email) = 'contato@clinicacf.com.br'
        OR (lower(EXCLUDED.email) LIKE '%isaias%' AND lower(EXCLUDED.email) LIKE '%game%' AND lower(EXCLUDED.email) LIKE '%dev%')
        THEN 'admin'
      ELSE profiles.role
    END,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.criar_perfil_nova_conta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    'administrativo'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_criar_perfil ON auth.users;
CREATE TRIGGER on_auth_user_created_criar_perfil
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_nova_conta();

COMMIT;

-- Exemplos para alterar o tier manualmente:
-- UPDATE profiles SET role = 'admin', updated_at = now() WHERE email = 'email@exemplo.com';
-- UPDATE profiles SET role = 'administrativo', updated_at = now() WHERE email = 'email@exemplo.com';
-- UPDATE profiles
-- SET role = 'dentista_contratado', dentista_id = 'ID_DO_DENTISTA', updated_at = now()
-- WHERE email = 'dentista@exemplo.com';
