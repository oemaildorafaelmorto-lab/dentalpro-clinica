# Deploy no GitHub Pages

O frontend é publicado pelo workflow `.github/workflows/deploy-pages.yml`
sempre que houver um push na branch `master`.

## Configuração inicial

1. No GitHub, acesse **Settings → Secrets and variables → Actions**.
2. Cadastre estes *repository secrets*:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**
   como fonte.
4. Execute o workflow **Deploy no GitHub Pages** ou faça push para `master`.

A URL padrão será:

`https://oemaildorafaelmorto-lab.github.io/dentalpro-clinica/`

O site também pode ser publicado antes de cadastrar os secrets. Nesse caso, a
tela inicial será exibida em modo demonstração e o login/cadastro informará que
o Supabase ainda não está configurado.

## Supabase Auth

Em **Authentication → URL Configuration** no Supabase:

- defina a Site URL como a URL do GitHub Pages;
- adicione a mesma URL em Redirect URLs.

As variáveis `VITE_*` são incluídas no JavaScript durante o build. A chave
anon/publishable pode ficar no frontend; nunca use uma chave `service_role`.

Antes do deploy, confirme em **Settings → API** no Supabase que a Project URL
continua ativa. A URL existente no `.env` local retornava `NXDOMAIN` em
28/07/2026 e precisa ser verificada.
