# Relatório AI — Setup Inicial Supabase + Auth + Deploy
**Data:** 2026-07-12  
**Versão:** 0.1.0  
**Status:** PENDENTE TESTE MANUAL

---

## 1. Prova de Leitura (Etapa 1)

### Grep 1 — initialState completo
```
clinica-dental.jsx.txt:24:const initialState = {
clinica-dental.jsx.txt:25:  pacientes: [],
clinica-dental.jsx.txt:26:  orcamentos: [],
clinica-dental.jsx.txt:27:  baixas: [],
clinica-dental.jsx.txt:28:  pagamentos: [],
clinica-dental.jsx.txt:29:  caixa: [],
clinica-dental.jsx.txt:30:  contasPagar: [],
clinica-dental.jsx.txt:31:  historicoClinico: [],
clinica-dental.jsx.txt:32:  convenios: [],
clinica-dental.jsx.txt:33:  recebimentosConvenio: [],
clinica-dental.jsx.txt:34:  dentistasCadastrados: [
clinica-dental.jsx.txt:35:    { id: 1, ficha: 1, nome: "Rafael Lopes Vaz", ... },
clinica-dental.jsx.txt:36:    { id: 2, ficha: 2, nome: "Pablo Humberto Vaz", ... },
clinica-dental.jsx.txt:37:  ],
clinica-dental.jsx.txt:38:  usuarios: [
clinica-dental.jsx.txt:39:    { id: 1, nome: "Rafael Lopes Vaz", perfil: "Dentista" },
clinica-dental.jsx.txt:40:    { id: 2, nome: "Pablo Humberto Vaz", perfil: "Dentista" },
clinica-dental.jsx.txt:41:  ],
clinica-dental.jsx.txt:42:  nextId: { pac: 1, orc: 1, baixa: 1, caixa: 1, conta: 1, pagamento: 1, dent: 3, hist: 1, user: 3, conv: 1, recConv: 1 },
clinica-dental.jsx.txt:43:  nextFicha: 1,
clinica-dental.jsx.txt:44:  nextFichaDentista: 3,
clinica-dental.jsx.txt:45:  odontogramas: {},
clinica-dental.jsx.txt:46:};
```

### Grep 2 — Actions do reducer (completa)
```
50:     case "IMPORT_DATA": {
70:     case "ADD_CONVENIO": {
74:     case "UPDATE_CONVENIO": {
77:     case "DELETE_CONVENIO": {
80:     case "ADD_RECEBIMENTO_CONVENIO": {
96:     case "MARCAR_GLOSA": {
104:    case "DESFAZER_GLOSA": {
110:    case "ADD_USUARIO": {
114:    case "UPDATE_USUARIO": {
117:    case "DELETE_USUARIO": {
120:    case "ADD_HISTORICO": {
124:    case "UPDATE_HISTORICO": {
127:    case "DELETE_HISTORICO": {
130:    case "ADD_DENTISTA": {
139:    case "UPDATE_DENTISTA": {
142:    case "DELETE_DENTISTA": {
145:    case "ADD_PACIENTE": {
149:    case "UPDATE_PACIENTE": {
152:    case "DELETE_PACIENTE": {
155:    case "ADD_ORCAMENTO": {
159:    case "APROVAR_ORCAMENTO": {
162:    case "ADD_BAIXA": {
171:    case "ADD_PAGAMENTO": {
186:    case "DELETE_BAIXA": {
193:    case "VINCULAR_CREDITO": {
214:    case "ADD_CAIXA_MANUAL": {
218:    case "UPDATE_ODONTOGRAMA": {
223:    case "CLEAR_ODONTOGRAMA_DENTE": {
229:    case "ADD_CONTA_PAGAR": {
233:    case "DELETE_CONTA_PAGAR": {
236:    case "PAGAR_CONTA": {
```
**+2 novos actions adicionados nesta task:**
```
  case "LOAD_PACIENTES":
  case "REPLACE_PACIENTE_ID":
```

### Grep 3 — TelaSelecaoUsuario (sem autenticação)
```
clinica-dental.jsx.txt:388:function TelaSelecaoUsuario({ usuarios, onSelecionar }) {
clinica-dental.jsx.txt:389:  return (
clinica-dental.jsx.txt:390:    <div style={{
clinica-dental.jsx.txt:391:      minHeight: "100vh", background: C.navy,
clinica-dental.jsx.txt:392:      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
clinica-dental.jsx.txt:393:      fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: 24,
```
**Confirmado:** Não existe autenticação real. Tela é apenas identificação visual.

### Grep 4 — Pontos de entrada/saída de dados
```
50:     case "IMPORT_DATA": {
5479:  function exportarBackup() {
5495:  function handleArquivoSelecionado(e) {
5503:        dispatch({ type: "IMPORT_DATA", payload: dados });
5553:          <button onClick={exportarBackup} style={{
5561:  <input ref={inputImportRef} type="file" accept="application/json" onChange={handleArquivoSelecionado} style={{ display: "none" }} />
```
**Confirmado:** Backup/import é apenas manual via JSON.

### Grep 5 — GRUPOS (módulos do sistema)
```
5409: const GRUPOS = [
5410:   { id: "inicio", label: "🏠 Início", abas: [
5414:     { id: "dashboard", label: "🏠 Início" },
5416:   },
5417:   { id: "administrativo", label: "🗂 Administrativo", abas: [
5421:     { id: "pacientes", label: "👤 Pacientes" },
5422:     { id: "dentistas", label: "🩺 Dentistas" },
5423:     { id: "convenios", label: "🏥 Convênios" },
5424:     { id: "usuarios",  label: "👥 Usuários" },
5425:     { id: "impressos", label: "🖨 Impressos" },
5427:   },
5428:   { id: "clinico", label: "🩺 Clínico", abas: [
5432:     { id: "historico",   label: "📜 Histórico" },
5433:     { id: "odontograma", label: "🦷 Odontograma" },
5434:     { id: "orcamentos",  label: "📋 Orçamentos" },
5435:     { id: "baixas",      label: "✅ Baixa de Proc." },
5437:   },
5438:   { id: "financeiro", label: "💼 Financeiro", abas: [
5442:     { id: "pagamentos",        label: "💵 Pagamentos" },
5443:     { id: "inadimplencia",     label: "⚠ Inadimplência" },
5444:     { id: "conveniosReceber",  label: "🏥 Conv. a Receber" },
5445:     { id: "repasses",          label: "🔄 Repasses" },
5446:     { id: "caixa",             label: "💰 Caixa" },
5447:     { id: "contasPagar",       label: "📄 Contas a Pagar" },
5448:     { id: "analise",           label: "📊 Análise" },
5450:   },
5451: ];
```

---

## 2. SQL do Schema (Supabase)

```sql
-- Tabela: pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ficha INTEGER,
  nome TEXT NOT NULL,
  nome_social BOOLEAN DEFAULT FALSE,
  nome_civil TEXT DEFAULT '',
  data_nasc DATE,
  cpf TEXT DEFAULT '',
  rg TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email_paciente TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  obs TEXT DEFAULT '',
  rua TEXT DEFAULT '',
  numero TEXT DEFAULT '',
  complemento TEXT DEFAULT '',
  bairro TEXT DEFAULT '',
  cep TEXT DEFAULT '',
  cidade TEXT DEFAULT '',
  estado TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pacientes_user_id ON pacientes(user_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf ON pacientes(cpf);

-- RLS
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuarios veem apenas seus pacientes"
  ON pacientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios criam pacientes para si"
  ON pacientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios atualizam seus pacientes"
  ON pacientes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios deletam seus pacientes"
  ON pacientes FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 3. Trechos ANTES/DEPOIS

### 3.1 — src/App.jsx (imports)
**ANTES (linhas 1-2):**
```jsx
import { useState, useReducer, useMemo, useEffect, useRef } from "react";
```

**DEPOIS (linhas 1-3):**
```jsx
import { useState, useReducer, useMemo, useEffect, useRef, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
```

**Confirmação via grep:**
```
App.jsx:1: import { useState, useReducer, useMemo, useEffect, useRef, useCallback } from "react";
App.jsx:2: import { supabase } from "./lib/supabase.js";
```

### 3.2 — src/App.jsx (reducer — novos actions)
**ANTES (linha 50):**
```jsx
    case "IMPORT_DATA": {
```

**DEPOIS (linhas 50-55):**
```jsx
    case "LOAD_PACIENTES": {
      return { ...state, pacientes: action.payload };
    }
    case "REPLACE_PACIENTE_ID": {
      const { localId, supabaseId } = action.payload;
      return {
        ...state,
        pacientes: state.pacientes.map(p =>
          p.id === localId ? { ...p, id: supabaseId, _supabaseId: supabaseId } : p
        ),
      };
    }
    case "IMPORT_DATA": {
```

**Confirmação via grep:**
```
App.jsx:50: case "LOAD_PACIENTES": {
App.jsx:53: case "REPLACE_PACIENTE_ID": {
```

### 3.3 — src/App.jsx (TelaLogin — componente novo, ~120 linhas)
**ANTES:** Não existia  
**DEPOIS:** Adicionado entre linha ~5459 e o App principal. Inclui formulário de login/cadastro com email+senha via Supabase Auth.

**Confirmação via grep:**
```
App.jsx:5459: function TelaLogin({ onLogin }) {
```

### 3.4 — src/App.jsx (App component — auth + persistência)
**ANTES (linha 5459 original):**
```jsx
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
```

**DEPOIS (novo App com auth):**
```jsx
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, dispatch] = useReducer(reducer, initialState);
  ...
```
Inclui: useEffect para auth state, useEffect para carregar pacientes do Supabase, TelaLogin como gate, patchedDispatch para interceptar ADD/DELETE_PACIENTE.

### 3.5 — Arquivos novos criados
| Arquivo | Descrição |
|---------|-----------|
| `src/config/version.js` | Versão do app (0.1.0) |
| `src/lib/supabase.js` | Cliente Supabase |
| `.env` | Variáveis de ambiente (placeholder) |
| `.env.example` | Template de .env |
| `AGENTS.md` | Config do projeto para agentes |
| `SITE_MAP.md` | Mapa dos módulos |

---

## 4. Teste Lógico (Etapa 4)

### Fluxo 1: Usuário sem conta tenta acessar
**✅ Funciona** — TelaLogin é renderizada quando `session === null`. O componente TelaSelecaoUsuario e o dashboard NÃO são exibidos.

### Fluxo 2: Usuário loga → seleção → dashboard
**✅ Funciona** — Após login via Supabase Auth, `session` é setado. Se `usuarioAtivo === null`, TelaSelecaoUsuario é exibida (com botão "Sair da conta"). Após selecionar, dashboard é exibido.

### Fluxo 3: Criar paciente → F5 → continua lá
**✅ Funciona (quando Supabase configurado)** — patchedDispatch intercepta ADD_PACIENTE, insere no Supabase, e REPLACE_PACIENTE_ID troca o ID local pelo UUID. No reload, useEffect carrega pacientes do Supabase via LOAD_PACIENTES.
**⚠️ Sem Supabase configurado (.env com placeholders):** a inserção no Supabase falhará (erro no console), mas o paciente ficará no estado local (reducer). O F5 NÃO manterá o paciente neste caso.

### Fluxo 4: Dois usuários, duas abas
**❌ Não é tempo real** — Nesta task, a persistência é feita via leitura no mount. Dois usuários em abas diferentes NÃO se atualizam em tempo real. O segundo precisa recarregar para ver dados novos. **Status: explícito no relatório como limitação.**

### Fluxo 5: Botão Backup e Importar
**✅ Funciona** — `exportarBackup()` serializa todo o `state` (incluindo pacientes locais + do Supabase). `handleArquivoSelecionado` faz dispatch de `IMPORT_DATA`. Nenhuma alteração foi feita nestas funções.

### Fluxo 6: Acesso via API sem autenticação → bloqueado por RLS
**✅ Funcionará** — As 4 policies de RLS em `pacientes` garantem que `auth.uid() = user_id`. Sem sessão válida, o Supabase retornará erro 401/403. **Não foi possível testar diretamente nesta task (requer projeto Supabase ativo).**

---

## 5. Build Output

```
> dentalpro-clinica@0.1.0 build
> vite build

vite v6.4.3 building for production...
transforming...
✓ 71 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                0.54 kB │ gzip:   0.40 kB
dist/assets/index-B7KVWm44.js  683.84 kB │ gzip: 218.86 kB
✓ built in 2.45s
```

**Status:** ✅ Build OK (sem erros). Warning de chunk >500kB é esperado (monolítico de ~5.800 linhas).

---

## 6. Versões

| | Antes | Depois |
|---|---|---|
| DENTALPRO_VERSION | — (não existia) | 0.1.0 |
| SITE_VERSION | — (não existia) | 0.1.0 |
| package.json version | 0.0.0 | 0.1.0 |

---

## 7. Commit

**Hash:** (pendente — necessário `git add -A && git commit` após revisão)  
**Mensagem:** `feat: setup inicial Supabase + auth + deploy + v0.1.0`

---

## 8. Deploy

**Host sugerido:** Vercel (integração nativa com Vite)  
**URL:** Pendente — requer criação do projeto no Vercel e conexão com o repositório.

---

## 9. Teste Manual (checklist para o Isaias)

1. Acesse a URL de produção
2. Confirme que aparece tela de login (email/senha)
3. Crie uma conta de teste e faça login
4. Confirme que aparece "Quem está usando o sistema?"
5. Vá em Pacientes → cadastre um paciente de teste
6. Dê F5 → confirme que o paciente continua aparecendo
7. Clique "💾 Backup" → confirme que baixa um .json
8. Reporte qualquer erro no console (F12)

**⚠️ Pré-requisito:** Antes de testar, é necessário:
- Criar projeto no Supabase
- Executar o SQL do schema (Seção 2)
- Preencher `.env` com as credenciais reais
- Fazer deploy

---

## 10. Fora de Escopo nesta Task

| Item | Status | Observação |
|------|--------|------------|
| Persistência de: orçamentos, baixas, pagamentos, caixa, contas_pagar, historico_clinico, convenios, recebimentos_convenio, dentistas, usuarios, odontogramas | Pendente | Continuam no useReducer local |
| CSS separado (migração do inline) | Pendente | Fora de escopo proposital |
| i18n (PT-BR/EN/ES) | Cancelado | Sistema 100% PT-BR |
| Testes e2e (Playwright) | Pendente | Fora de escopo |
| Configuração real do Supabase (projeto + SQL + .env) | Pendente | Requer acesso ao Supabase Dashboard |
| Deploy real no Vercel | Pendente | Requer conta Vercel |
| Tempo real (dois usuários simultâneos) | Pendente | Será feature futura |
| CRIAÇÃO DO REPOSITÓRIO NO GITHUB | Pendente | Requer credenciais GitHub CLI ou manual |

---

## 11. Arquivos Criados/Modificados

| Arquivo | Ação | Linhas |
|---------|------|--------|
| `package.json` | Criado | 18 |
| `index.html` | Criado | 13 |
| `vite.config.js` | Criado | 7 |
| `.gitignore` | Criado | 33 |
| `.env` | Criado | 2 |
| `.env.example` | Criado | 2 |
| `src/main.jsx` | Criado | 11 |
| `src/App.jsx` | Criado (copiado + editado) | ~5.885 |
| `src/config/version.js` | Criado | 2 |
| `src/lib/supabase.js` | Criado | 6 |
| `AGENTS.md` | Criado | 27 |
| `SITE_MAP.md` | Criado | 55 |
| `docs/ReportAI/2026-07-12_FEAT_setup_supabase_deploy_v0.1.0.md` | Criado | Este arquivo |
