# DentalPro — Agents Config

## Stack
- **Frontend:** Vite + React 19
- **Backend/DB:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** (a definir — Vercel recomendado)

## Convenções
- Commits em português, formato: `tipo: descrição curta`
- Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`
- Branches: `main` (produção), `dev` (desenvolvimento)
- Nunca commitar `.env` ou credenciais Supabase
- Versão controlada em `src/config/version.js`

## Estrutura
```
src/
  App.jsx          — Componente principal (monolítico, ~5.800 linhas)
  main.jsx         — Entry point React
  config/version.js — Versionamento do app
  lib/supabase.js  — Cliente Supabase
```

## Referências
- Task de setup: `docs/ReportAI/`
- Arquivo fonte original: `clinica-dental.jsx.txt`
