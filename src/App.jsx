import { useState, useReducer, useMemo, useEffect, useRef, useCallback } from "react";
import { supabase } from "./lib/supabase.js";

// ── Paleta clínica moderna ──────────────────────────────────────────
// Azul-petróleo profissional + branco clínico + âmbar para alertas
const C = {
  navy: "#1B3A5C",
  teal: "#2A7D8C",
  tealLight: "#E8F4F6",
  white: "#FFFFFF",
  bg: "#F0F4F7",
  card: "#FFFFFF",
  text: "#1A2A3A",
  muted: "#6B8399",
  amber: "#E8A020",
  amberLight: "#FEF3DC",
  green: "#2E7D5B",
  greenLight: "#E6F4EE",
  red: "#C0392B",
  redLight: "#FDECEA",
  border: "#D5E3ED",
};

// ── Estado global ──────────────────────────────────────────────────
const initialState = {
  pacientes: [],
  tabelasPreco: [],
  orcamentos: [],
  baixas: [],
  pagamentos: [],
  caixa: [],
  contasPagar: [],
  historicoClinico: [],
  convenios: [],
  recebimentosConvenio: [],
  dentistasCadastrados: [
    { id: 1, ficha: 1, nome: "Rafael Lopes Vaz", nomeSocial: false, nomeCivil: "", dataNasc: "", cpf: "", rg: "", telefone: "", email: "", obs: "", cro: "", especialidade: "Clínico Geral", repasseTipo: "percentual", repassePercentual: "", repasseTabelaFixa: [], endereco: { rua: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "" } },
    { id: 2, ficha: 2, nome: "Pablo Humberto Vaz", nomeSocial: false, nomeCivil: "", dataNasc: "", cpf: "", rg: "", telefone: "", email: "", obs: "", cro: "", especialidade: "Clínico Geral", repasseTipo: "percentual", repassePercentual: "", repasseTabelaFixa: [], endereco: { rua: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "" } },
  ],
  usuarios: [
    { id: 1, nome: "Rafael Lopes Vaz", perfil: "Dentista" },
    { id: 2, nome: "Pablo Humberto Vaz", perfil: "Dentista" },
  ],
  nextId: { pac: 1, orc: 1, baixa: 1, caixa: 1, conta: 1, pagamento: 1, dent: 3, hist: 1, user: 3, conv: 1, recConv: 1 },
  nextFicha: 1,
  nextFichaDentista: 3,
  odontogramas: {},
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_PACIENTES": {
      const pacientes = [...action.payload].sort((a, b) => a.ficha - b.ficha);
      const maiorFicha = pacientes.reduce((maior, p) => Math.max(maior, Number(p.ficha) || 0), 0);
      return { ...state, pacientes, nextFicha: maiorFicha + 1 };
    }
    case "ADD_PACIENTE_PERSISTED": {
      const pacientes = [...state.pacientes, action.payload].sort((a, b) => a.ficha - b.ficha);
      return {
        ...state,
        pacientes,
        nextFicha: Math.max(state.nextFicha, Number(action.payload.ficha) + 1),
      };
    }
    case "LOAD_TABELAS_PRECO":
      return { ...state, tabelasPreco: action.payload };
    case "ADD_TABELA_PRECO_PERSISTED":
      return { ...state, tabelasPreco: [...state.tabelasPreco, action.payload] };
    case "UPDATE_TABELA_PRECO_PERSISTED":
      return {
        ...state,
        tabelasPreco: state.tabelasPreco.map(t => t.id === action.payload.id ? action.payload : t),
      };
    case "DELETE_TABELA_PRECO_PERSISTED":
      return { ...state, tabelasPreco: state.tabelasPreco.filter(t => t.id !== action.payload) };
    case "UNSET_DEFAULT_TABELAS_PRECO":
      return { ...state, tabelasPreco: state.tabelasPreco.map(t => ({ ...t, padrao: false })) };
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
      const dados = action.payload;
      return {
        pacientes: dados.pacientes || [],
        tabelasPreco: dados.tabelasPreco || [],
        orcamentos: dados.orcamentos || [],
        baixas: dados.baixas || [],
        pagamentos: dados.pagamentos || [],
        caixa: dados.caixa || [],
        contasPagar: dados.contasPagar || [],
        historicoClinico: dados.historicoClinico || [],
        dentistasCadastrados: dados.dentistasCadastrados || [],
        usuarios: dados.usuarios || [],
        convenios: dados.convenios || [],
        recebimentosConvenio: dados.recebimentosConvenio || [],
        nextId: dados.nextId || { pac: 1, orc: 1, baixa: 1, caixa: 1, conta: 1, pagamento: 1, dent: 1, hist: 1, user: 1, conv: 1, recConv: 1 },
        nextFicha: dados.nextFicha || 1,
        nextFichaDentista: dados.nextFichaDentista || 1,
        odontogramas: dados.odontogramas || {},
      };
    }
    case "ADD_CONVENIO": {
      const c = { ...action.payload, id: state.nextId.conv };
      return { ...state, convenios: [...state.convenios, c], nextId: { ...state.nextId, conv: state.nextId.conv + 1 } };
    }
    case "UPDATE_CONVENIO": {
      return { ...state, convenios: state.convenios.map(c => c.id === action.payload.id ? action.payload : c) };
    }
    case "DELETE_CONVENIO": {
      return { ...state, convenios: state.convenios.filter(c => c.id !== action.payload) };
    }
    case "ADD_RECEBIMENTO_CONVENIO": {
      // Registra que o convênio pagou um lote de procedimentos. Lança entrada no Caixa,
      // assim como o pagamento de paciente particular faz.
      const r = { ...action.payload, id: state.nextId.recConv };
      const novaCaixa = {
        id: state.nextId.caixa, tipo: "entrada",
        descricao: action.payload.descricao, valor: action.payload.valor,
        data: action.payload.data, forma: "convênio",
      };
      return {
        ...state,
        recebimentosConvenio: [...state.recebimentosConvenio, r],
        caixa: [...state.caixa, novaCaixa],
        nextId: { ...state.nextId, recConv: state.nextId.recConv + 1, caixa: state.nextId.caixa + 1 },
      };
    }
    case "MARCAR_GLOSA": {
      // payload: { baixaId, motivo }
      const { baixaId, motivo } = action.payload;
      return {
        ...state,
        baixas: state.baixas.map(b => b.id === baixaId ? { ...b, glosado: true, motivoGlosa: motivo || "" } : b),
      };
    }
    case "DESFAZER_GLOSA": {
      return {
        ...state,
        baixas: state.baixas.map(b => b.id === action.payload ? { ...b, glosado: false, motivoGlosa: "" } : b),
      };
    }
    case "ADD_USUARIO": {
      const u = { ...action.payload, id: state.nextId.user };
      return { ...state, usuarios: [...state.usuarios, u], nextId: { ...state.nextId, user: state.nextId.user + 1 } };
    }
    case "UPDATE_USUARIO": {
      return { ...state, usuarios: state.usuarios.map(u => u.id === action.payload.id ? action.payload : u) };
    }
    case "DELETE_USUARIO": {
      return { ...state, usuarios: state.usuarios.filter(u => u.id !== action.payload) };
    }
    case "ADD_HISTORICO": {
      const h = { ...action.payload, id: state.nextId.hist };
      return { ...state, historicoClinico: [...state.historicoClinico, h], nextId: { ...state.nextId, hist: state.nextId.hist + 1 } };
    }
    case "LOAD_HISTORICO":
      return { ...state, historicoClinico: action.payload };
    case "ADD_HISTORICO_PERSISTED":
      return { ...state, historicoClinico: [...state.historicoClinico, action.payload] };
    case "UPDATE_HISTORICO_PERSISTED":
      return {
        ...state,
        historicoClinico: state.historicoClinico.map(h => h.id === action.payload.id ? action.payload : h),
      };
    case "DELETE_HISTORICO_PERSISTED":
      return { ...state, historicoClinico: state.historicoClinico.filter(h => h.id !== action.payload) };
    case "UPDATE_HISTORICO": {
      return { ...state, historicoClinico: state.historicoClinico.map(h => h.id === action.payload.id ? action.payload : h) };
    }
    case "DELETE_HISTORICO": {
      return { ...state, historicoClinico: state.historicoClinico.filter(h => h.id !== action.payload) };
    }
    case "ADD_DENTISTA": {
      const d = { ...action.payload, id: state.nextId.dent, ficha: state.nextFichaDentista };
      return {
        ...state,
        dentistasCadastrados: [...state.dentistasCadastrados, d],
        nextId: { ...state.nextId, dent: state.nextId.dent + 1 },
        nextFichaDentista: state.nextFichaDentista + 1,
      };
    }
    case "UPDATE_DENTISTA": {
      return { ...state, dentistasCadastrados: state.dentistasCadastrados.map(d => d.id === action.payload.id ? action.payload : d) };
    }
    case "DELETE_DENTISTA": {
      return { ...state, dentistasCadastrados: state.dentistasCadastrados.filter(d => d.id !== action.payload) };
    }
    case "ADD_PACIENTE": {
      const p = { ...action.payload, id: state.nextId.pac, ficha: state.nextFicha };
      delete p._supabaseId;
      return { ...state, pacientes: [...state.pacientes, p], nextId: { ...state.nextId, pac: state.nextId.pac + 1 }, nextFicha: state.nextFicha + 1 };
    }
    case "UPDATE_PACIENTE": {
      return { ...state, pacientes: state.pacientes.map(p => p.id === action.payload.id ? action.payload : p) };
    }
    case "DELETE_PACIENTE": {
      return { ...state, pacientes: state.pacientes.filter(p => p.id !== action.payload) };
    }
    case "ADD_ORCAMENTO": {
      const o = { ...action.payload, id: state.nextId.orc, status: "pendente" };
      return { ...state, orcamentos: [...state.orcamentos, o], nextId: { ...state.nextId, orc: state.nextId.orc + 1 } };
    }
    case "LOAD_ORCAMENTOS":
      return { ...state, orcamentos: action.payload };
    case "ADD_ORCAMENTO_PERSISTED":
      return { ...state, orcamentos: [...state.orcamentos, action.payload] };
    case "APROVAR_ORCAMENTO_PERSISTED":
      return {
        ...state,
        orcamentos: state.orcamentos.map(o => o.id === action.payload.id ? action.payload : o),
      };
    case "APROVAR_ORCAMENTO": {
      return { ...state, orcamentos: state.orcamentos.map(o => o.id === action.payload ? { ...o, status: "aprovado" } : o) };
    }
    case "ADD_BAIXA": {
      // Baixa = procedimento foi realizado. NÃO lança caixa e NÃO exige pagamento.
      const b = { ...action.payload, id: state.nextId.baixa };
      return {
        ...state,
        baixas: [...state.baixas, b],
        nextId: { ...state.nextId, baixa: state.nextId.baixa + 1 },
      };
    }
    case "ADD_PAGAMENTO": {
      // payload: { pacienteId, data, valor, forma, baixaId? (vinculado a procedimento específico), obs? }
      const p = { ...action.payload, id: state.nextId.pagamento };
      const novaCaixa = {
        id: state.nextId.caixa, tipo: "entrada",
        descricao: action.payload.descricao, valor: action.payload.valor,
        data: action.payload.data, forma: action.payload.forma,
      };
      return {
        ...state,
        pagamentos: [...state.pagamentos, p],
        caixa: [...state.caixa, novaCaixa],
        nextId: { ...state.nextId, pagamento: state.nextId.pagamento + 1, caixa: state.nextId.caixa + 1 },
      };
    }
    case "DELETE_BAIXA": {
      // Trava: não permite excluir uma baixa que já tem pagamento (particular ou convênio) vinculado a ela.
      const temPagamento = state.pagamentos.some(p => p.baixaId === action.payload);
      const temRecebimentoConvenio = state.recebimentosConvenio.some(r => (r.baixaIds || []).includes(action.payload));
      if (temPagamento || temRecebimentoConvenio) return state; // a UI deve impedir isso antes, mas o reducer também protege
      return { ...state, baixas: state.baixas.filter(b => b.id !== action.payload) };
    }
    case "VINCULAR_CREDITO": {
      // Reatribui um valor do crédito (saldo positivo) do paciente para um procedimento específico.
      // payload: { pacienteId, baixaId, valor, obs? }
      // Cria um novo registro de pagamento "interno" (sem lançar caixa de novo, pois o dinheiro já entrou).
      const { pacienteId, baixaId, valor, obs } = action.payload;
      const baixa = state.baixas.find(b => b.id === baixaId);
      const novo = {
        id: state.nextId.pagamento,
        pacienteId, baixaId, valor,
        data: today(),
        forma: "crédito do paciente",
        obs: obs || "Crédito existente vinculado a este procedimento",
        descricao: baixa ? `Crédito vinculado - ${baixa.proc}` : "Crédito vinculado",
        interno: true, // não gera novo lançamento de caixa
      };
      return {
        ...state,
        pagamentos: [...state.pagamentos, novo],
        nextId: { ...state.nextId, pagamento: state.nextId.pagamento + 1 },
      };
    }
    case "ADD_CAIXA_MANUAL": {
      const c = { ...action.payload, id: state.nextId.caixa };
      return { ...state, caixa: [...state.caixa, c], nextId: { ...state.nextId, caixa: state.nextId.caixa + 1 } };
    }
    case "UPDATE_ODONTOGRAMA": {
      const { pacienteId, dente, dados } = action.payload;
      const odoAtual = state.odontogramas[pacienteId] || {};
      return { ...state, odontogramas: { ...state.odontogramas, [pacienteId]: { ...odoAtual, [dente]: dados } } };
    }
    case "CLEAR_ODONTOGRAMA_DENTE": {
      const { pacienteId: pid, dente: d } = action.payload;
      const odo2 = { ...(state.odontogramas[pid] || {}) };
      delete odo2[d];
      return { ...state, odontogramas: { ...state.odontogramas, [pid]: odo2 } };
    }
    case "ADD_CONTA_PAGAR": {
      const c = { ...action.payload, id: state.nextId.conta, status: "aberta" };
      return { ...state, contasPagar: [...state.contasPagar, c], nextId: { ...state.nextId, conta: state.nextId.conta + 1 } };
    }
    case "DELETE_CONTA_PAGAR": {
      return { ...state, contasPagar: state.contasPagar.filter(c => c.id !== action.payload) };
    }
    case "PAGAR_CONTA": {
      // payload: { contaId, dataPagamento, forma, valorPago }
      const { contaId, dataPagamento, forma, valorPago } = action.payload;
      const conta = state.contasPagar.find(c => c.id === contaId);
      if (!conta) return state;
      const novaCaixa = {
        id: state.nextId.caixa, tipo: "saida",
        descricao: `${conta.descricao} (${conta.fornecedor || "conta a pagar"})`,
        valor: valorPago, data: dataPagamento, forma,
      };
      return {
        ...state,
        contasPagar: state.contasPagar.map(c => c.id === contaId
          ? { ...c, status: "paga", dataPagamento, formaPag: forma, valorPago }
          : c
        ),
        caixa: [...state.caixa, novaCaixa],
        nextId: { ...state.nextId, caixa: state.nextId.caixa + 1 },
      };
    }
    default: return state;
  }
}

// ── Utilitários ────────────────────────────────────────────────────
const fmt = (v) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "R$ 0,00";
const today = () => new Date().toISOString().slice(0, 10);

// Lista de dentistas agora vem do cadastro completo (state.dentistasCadastrados),
// não mais de uma constante fixa — ver aba "Dentistas" no grupo Administrativo.

const CLINICA = {
  nome: "Clear Field",
  nomeCompleto: "CLEAR FIELD",
  subtitulo: "CLÍNICA ODONTOLÓGICA",
  epao: "EPAO 028575",
  cnpj: "45.918.404/0001-05",
  endereco: "Rua Jaslo 11. Salas 4 e 5. Jd. São Januário. CEP 05781 190. São Paulo.",
  cidade: "São Paulo",
  telefone: "(11) 9 1616-8863",
};

function calcIdade(dataNasc) {
  if (!dataNasc) return null;
  const hoje = new Date();
  const nasc = new Date(dataNasc + "T00:00:00");
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

// Valida CPF pelo algoritmo oficial dos dígitos verificadores.
// Retorna true se o número é matematicamente válido (não confirma que existe na Receita).
function validarCPF(cpf) {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // sequências repetidas tipo 111.111.111-11

  function calcDigito(base) {
    let soma = 0;
    let peso = base.length + 1;
    for (const d of base) { soma += Number(d) * peso; peso--; }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  const d1 = calcDigito(digits.slice(0, 9));
  const d2 = calcDigito(digits.slice(0, 10));
  return d1 === Number(digits[9]) && d2 === Number(digits[10]);
}

// Aplica máscara 000.000.000-00 enquanto o usuário digita
function maskCPF(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const emptyForm = () => ({
  nome: "", nomeSocial: false, nomeCivil: "",
  dataNasc: "", cpf: "", rg: "", telefone: "", email: "", responsavel: "", obs: "",
  endereco: { rua: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "" },
});

const ESPECIALIDADES = [
  "Clínico Geral",
  "Ortodontia",
  "Implantodontia",
  "Endodontia",
  "Periodontia",
  "Odontopediatria",
  "Cirurgia Bucomaxilofacial",
  "Prótese Dentária",
  "Dentística / Facetas e Estética",
  "Radiologia Odontológica",
  "Odontogeriatria",
  "Patologia Bucal",
  "Disfunção Temporomandibular (DTM)",
  "Odontologia do Esporte",
  "Outra",
];

const emptyFormDentista = () => ({
  nome: "", nomeSocial: false, nomeCivil: "",
  dataNasc: "", cpf: "", rg: "", telefone: "", email: "", obs: "",
  cro: "", especialidade: "",
  endereco: { rua: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "" },
  // Regra de repasse: "percentual" usa repassePercentual sobre o valor de cada
  // procedimento; "fixo" usa uma tabela própria (repasseTabelaFixa) por código de procedimento.
  repasseTipo: "percentual",
  repassePercentual: "",
  repasseTabelaFixa: [], // [{ cod, proc, valor }]
});

// ── Componentes base ───────────────────────────────────────────────
// ── Aforismos para a tela inicial ─────────────────────────────────
const AFORISMOS = [
  "A saúde é a maior das riquezas humanas. — Virgílio",
  "O sorriso é a menor distância entre duas pessoas. — Victor Borge",
  "Cuidar das pessoas é a mais nobre das profissões. — Albert Schweitzer",
  "A excelência não é um ato, mas um hábito. — Aristóteles",
  "O sucesso é a soma de pequenos esforços repetidos dia após dia. — Robert Collier",
  "Não basta fazer o bem; é preciso fazê-lo bem. — Denis Diderot",
  "A melhor preparação para o amanhã é fazer o melhor possível hoje. — H. Jackson Brown Jr.",
  "A qualidade nunca é um acidente; é sempre o resultado de um esforço inteligente. — John Ruskin",
  "Seja a mudança que você quer ver no mundo. — Mahatma Gandhi",
  "O único modo de fazer um grande trabalho é amar o que faz. — Steve Jobs",
  "A medicina cura às vezes, alivia frequentemente, consola sempre. — Louis Pasteur",
  "Tratar o paciente como você gostaria de ser tratado — essa é a regra de ouro da saúde.",
  "Cada sorriso que você restaura é uma vida que você transforma.",
  "A confiança do paciente é a maior recompensa do profissional de saúde.",
  "Detalhes fazem a perfeição, e a perfeição não é um detalhe. — Leonardo da Vinci",
];

function getAforismosDoDia() {
  const idx = new Date().getDate() % AFORISMOS.length;
  return AFORISMOS[idx];
}

function getSaudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// ── Tela de seleção de usuário ─────────────────────────────────────
function TelaSelecaoUsuario({ usuarios, onSelecionar }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.navy,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: 24,
    }}>
      {/* Logo e nome */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🦷</div>
        <div style={{ color: C.white, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>DentalPro</div>
        <div style={{ color: "#7AB8CC", fontSize: 14, marginTop: 4 }}>Clínica Odontológica Clear Field</div>
      </div>

      {/* Aforismo */}
      <div style={{
        maxWidth: 480, textAlign: "center", color: "#A0C4D5",
        fontSize: 13, fontStyle: "italic", marginBottom: 40, lineHeight: 1.7,
      }}>
        "{getAforismosDoDia()}"
      </div>

      {/* Quem está usando? */}
      <div style={{ color: "#7AB8CC", fontSize: 13, fontWeight: 600, marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
        Quem está usando o sistema?
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", maxWidth: 560 }}>
        {usuarios.map(u => (
          <button key={u.id} onClick={() => onSelecionar(u)} style={{
            background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: 12, padding: "16px 24px", cursor: "pointer", transition: "all .2s",
            color: C.white, textAlign: "center", minWidth: 140,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.teal; e.currentTarget.style.borderColor = C.teal; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>
              {u.perfil === "Dentista" ? "🩺" : u.perfil === "Recepcionista" ? "📋" : u.perfil === "Admin" ? "⚙️" : "👤"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{u.nome}</div>
            <div style={{ color: "#A0C4D5", fontSize: 12, marginTop: 3 }}>{u.perfil}</div>
          </button>
        ))}
      </div>

      <div style={{ color: "#4A7A9B", fontSize: 11, marginTop: 40 }}>
        Esta tela é apenas identificação — não há controle de acesso entre usuários.
      </div>
    </div>
  );
}

// ── Dashboard inicial ──────────────────────────────────────────────
function Dashboard({ state, usuario, onTrocarUsuario }) {
  const [valoresVisiveis, setValoresVisiveis] = useState(false); // por padrão, oculto — mais seguro numa recepção
  const hoje = today();

  // Máscara para qualquer valor sensível exibido na tela
  function mascarar(valorFormatado) {
    return valoresVisiveis ? valorFormatado : "••••••";
  }

  // Aniversariantes do dia — pacientes E dentistas
  function ehAniversarioHoje(dataNasc) {
    if (!dataNasc) return false;
    const [, mes, dia] = dataNasc.split("-");
    const [, mesHoje, diaHoje] = hoje.split("-");
    return mes === mesHoje && dia === diaHoje;
  }
  const aniversariantesPacientes = state.pacientes.filter(p => ehAniversarioHoje(p.dataNasc));
  const aniversariantesDentistas = state.dentistasCadastrados.filter(d => ehAniversarioHoje(d.dataNasc));
  const totalAniversariantes = aniversariantesPacientes.length + aniversariantesDentistas.length;

  // Resumo financeiro do mês atual
  const mesAtual = hoje.slice(0, 7);
  const entradasMes = state.caixa.filter(c => c.tipo === "entrada" && c.data.startsWith(mesAtual)).reduce((s, c) => s + c.valor, 0);
  const saidasMes = state.caixa.filter(c => c.tipo === "saida" && c.data.startsWith(mesAtual)).reduce((s, c) => s + c.valor, 0);

  // Contas vencendo nos próximos 7 dias
  const em7dias = new Date(); em7dias.setDate(em7dias.getDate() + 7);
  const em7str = em7dias.toISOString().slice(0, 10);
  const contasVencendo = state.contasPagar.filter(c => c.status !== "paga" && c.vencimento >= hoje && c.vencimento <= em7str);
  const contasAtrasadas = state.contasPagar.filter(c => c.status !== "paga" && c.vencimento < hoje);

  // Orçamentos pendentes de aprovação
  const orcPendentes = state.orcamentos.filter(o => o.status === "pendente");

  // Procedimentos realizados hoje
  const baixasHoje = state.baixas.filter(b => b.data === hoje);

  const dataFormatada = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", color: C.text }}>

      {/* Saudação */}
      <div style={{ background: C.navy, borderRadius: 14, padding: "24px 28px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, fontSize: 120, opacity: 0.05 }}>🦷</div>
        <div style={{ color: "#A0C4D5", fontSize: 13, marginBottom: 6, textTransform: "capitalize" }}>{dataFormatada}</div>
        <div style={{ color: C.white, fontSize: 24, fontWeight: 800 }}>
          {getSaudacao()}, {usuario.nome.split(" ")[0]}! 👋
        </div>
        <div style={{ color: "#7AB8CC", fontSize: 13, marginTop: 6, fontStyle: "italic" }}>
          "{getAforismosDoDia()}"
        </div>
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
          <button
            onClick={() => setValoresVisiveis(v => !v)}
            title={valoresVisiveis ? "Ocultar valores" : "Mostrar valores"}
            style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8, padding: "5px 10px", color: "#A0C4D5", fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {valoresVisiveis ? "🙈" : "👁"}
            <span style={{ fontSize: 12 }}>{valoresVisiveis ? "Ocultar" : "Mostrar"}</span>
          </button>
          <button onClick={onTrocarUsuario} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8, padding: "5px 12px", color: "#A0C4D5", fontSize: 12, cursor: "pointer",
          }}>Trocar usuário</button>
        </div>
      </div>

      {/* Aniversariantes — pacientes e dentistas */}
      {totalAniversariantes > 0 && (
        <div style={{ background: "#FEF3DC", border: `1.5px solid ${C.amber}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: C.amber, marginBottom: 8 }}>
            🎂 Aniversariante{totalAniversariantes > 1 ? "s" : ""} de hoje!
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {aniversariantesPacientes.map(p => (
              <span key={`pac-${p.id}`} style={{ background: C.white, border: `1px solid ${C.amber}`, borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 600, color: C.amber }}>
                🎉 {p.nome} {calcIdade(p.dataNasc) > 0 ? `— ${calcIdade(p.dataNasc)} anos` : ""}
                <span style={{ fontWeight: 400, color: C.muted, marginLeft: 4 }}>(paciente)</span>
              </span>
            ))}
            {aniversariantesDentistas.map(d => (
              <span key={`dent-${d.id}`} style={{ background: C.white, border: `1px solid ${C.teal}`, borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 600, color: C.teal }}>
                🎉 Dr(a). {d.nome} {calcIdade(d.dataNasc) > 0 ? `— ${calcIdade(d.dataNasc)} anos` : ""}
                <span style={{ fontWeight: 400, color: C.muted, marginLeft: 4 }}>(dentista)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.greenLight, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase" }}>Entradas do mês</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginTop: 4, fontFamily: valoresVisiveis ? "inherit" : "monospace" }}>{mascarar(fmt(entradasMes))}</div>
        </div>
        <div style={{ background: C.redLight, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase" }}>Saídas do mês</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, marginTop: 4, fontFamily: valoresVisiveis ? "inherit" : "monospace" }}>{mascarar(fmt(saidasMes))}</div>
        </div>
        <div style={{ background: C.tealLight, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase" }}>Saldo do mês</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.teal, marginTop: 4, fontFamily: valoresVisiveis ? "inherit" : "monospace" }}>{mascarar(fmt(entradasMes - saidasMes))}</div>
        </div>
        <div style={{ background: C.amberLight, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase" }}>Procedimentos hoje</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.amber, marginTop: 4 }}>{baixasHoje.length}</div>
        </div>
      </div>

      {/* Alertas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Contas em atraso */}
        <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18 }}>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>
            📄 Contas a pagar
          </div>
          {contasAtrasadas.length > 0 && (
            <div style={{ background: C.redLight, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>⚠ {contasAtrasadas.length} conta{contasAtrasadas.length > 1 ? "s" : ""} em atraso</div>
              {contasAtrasadas.slice(0, 3).map(c => (
                <div key={c.id} style={{ fontSize: 12, color: C.red, marginTop: 2 }}>· {c.descricao} — {mascarar(fmt(c.valor))}</div>
              ))}
            </div>
          )}
          {contasVencendo.length > 0 ? (
            <div style={{ fontSize: 12, color: C.amber }}>
              ⏰ {contasVencendo.length} conta{contasVencendo.length > 1 ? "s" : ""} vencendo em até 7 dias
            </div>
          ) : contasAtrasadas.length === 0 ? (
            <div style={{ fontSize: 12, color: C.green }}>✓ Nenhuma conta pendente em breve</div>
          ) : null}
        </div>

        {/* Orçamentos pendentes */}
        <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18 }}>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>
            📋 Orçamentos pendentes
          </div>
          {orcPendentes.length === 0 ? (
            <div style={{ fontSize: 12, color: C.green }}>✓ Nenhum orçamento aguardando aprovação</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {orcPendentes.slice(0, 4).map(o => {
                const pac = state.pacientes.find(p => p.id === o.pacienteId);
                const total = o.itens.reduce((s, i) => s + i.valor, 0);
                return (
                  <div key={o.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.text }}>{pac?.nome || "—"}</span>
                    <span style={{ color: C.amber, fontWeight: 600 }}>{mascarar(fmt(total))}</span>
                  </div>
                );
              })}
              {orcPendentes.length > 4 && <div style={{ fontSize: 11, color: C.muted }}>e mais {orcPendentes.length - 4} orçamento(s)…</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Gerenciamento de Usuários ──────────────────────────────────────
const PERFIS = ["Dentista", "Recepcionista", "Admin", "Outro"];

function GerenciarUsuarios({ state, dispatch }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: "", perfil: "Recepcionista" });
  const [editando, setEditando] = useState(null);

  function abrirNovo() { setForm({ nome: "", perfil: "Recepcionista" }); setEditando(null); setModal(true); }
  function abrirEditar(u) { setForm({ nome: u.nome, perfil: u.perfil }); setEditando(u); setModal(true); }

  async function salvar() {
    if (!form.nome.trim()) return;
    if (editando) dispatch({ type: "UPDATE_USUARIO", payload: { ...editando, ...form } });
    else dispatch({ type: "ADD_USUARIO", payload: form });
    setModal(false);
  }

  const icone = (perfil) => perfil === "Dentista" ? "🩺" : perfil === "Recepcionista" ? "📋" : perfil === "Admin" ? "⚙️" : "👤";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn onClick={abrirNovo}>+ Novo Usuário</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {state.usuarios.map(u => (
          <Card key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{icone(u.perfil)}</span>
              <div>
                <div style={{ fontWeight: 700, color: C.navy }}>{u.nome}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{u.perfil}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => abrirEditar(u)}>Editar</Btn>
              <Btn variant="danger" onClick={() => dispatch({ type: "DELETE_USUARIO", payload: u.id })}>Excluir</Btn>
            </div>
          </Card>
        ))}
        {state.usuarios.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum usuário cadastrado.</div>}
      </div>

      {modal && (
        <Modal title={editando ? "Editar Usuário" : "Novo Usuário"} onClose={() => setModal(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <Input label="Nome *" value={form.nome} onChange={e => setForm(x => ({ ...x, nome: e.target.value }))} placeholder="Nome completo" />
            <Select label="Perfil" value={form.perfil} onChange={e => setForm(x => ({ ...x, perfil: e.target.value }))}>
              {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn onClick={salvar}>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Badge({ children, color = "teal" }) {
  const map = { teal: { bg: C.tealLight, text: C.teal }, amber: { bg: C.amberLight, text: C.amber }, green: { bg: C.greenLight, text: C.green }, red: { bg: C.redLight, text: C.red } };
  const s = map[color] || map.teal;
  return <span style={{ background: s.bg, color: s.text, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>{children}</span>;
}

function Card({ children, style }) {
  return <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, ...style }}>{children}</div>;
}

// Envolve um campo de formulário e exibe mensagem de erro abaixo, se houver
function Campo({ erro, children }) {
  return (
    <div>
      {children}
      {erro && <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>⚠ {erro}</div>}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>}
      <input {...props} style={{ border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: C.text, outline: "none", background: props.disabled ? "#F0F4F7" : C.white, ...props.style }} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>}
      <select {...props} style={{ border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: C.text, background: C.white, outline: "none", ...props.style }}>{children}</select>
    </div>
  );
}

// Campo de busca de procedimento por nome ou código, com dropdown filtrado.
// value = código selecionado (ou "" se nenhum). onSelect(cod) é chamado ao escolher.
function ProcSearch({ label, value, onSelect, hasError, placeholder, catalogo }) {
  const itensDisponiveis = catalogo || TABELA.flatMap(g => g.itens.map(it => ({ ...it, grupo: g.grupo })));
  const selecionado = value ? itensDisponiveis.find(it => String(it.cod) === String(value)) : null;
  const [query, setQuery] = useState(selecionado ? `${selecionado.cod} · ${selecionado.proc}` : "");
  const [aberto, setAberto] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(0);

  // mantém o texto sincronizado se o value mudar de fora (ex: limpar formulário)
  useEffect(() => {
    const s = value ? itensDisponiveis.find(it => String(it.cod) === String(value)) : null;
    setQuery(s ? `${s.cod} · ${s.proc}` : "");
  }, [value, catalogo]);

  const termo = query.trim().toLowerCase();
  const resultados = useMemo(() => {
    if (!termo) return itensDisponiveis.slice(0, 8);
    return itensDisponiveis.filter(it =>
      it.proc.toLowerCase().includes(termo) || String(it.cod).includes(termo)
    ).slice(0, 8);
  }, [termo, catalogo]);

  function escolher(item) {
    onSelect(item.cod);
    setQuery(`${item.cod} · ${item.proc}`);
    setAberto(false);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setAberto(true);
    setHoverIdx(0);
    if (e.target.value.trim() === "") onSelect("");
  }

  function handleKeyDown(e) {
    if (!aberto) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHoverIdx(i => Math.min(i + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHoverIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (resultados[hoverIdx]) escolher(resultados[hoverIdx]); }
    else if (e.key === "Escape") { setAberto(false); }
  }

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>}
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Digite o nome ou código do procedimento…"}
        style={{
          border: `1.5px solid ${hasError ? C.red : C.border}`, borderRadius: 8, padding: "8px 12px",
          fontSize: 14, color: C.text, outline: "none", background: C.white, width: "100%", boxSizing: "border-box",
        }}
      />
      {aberto && resultados.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 20,
          background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto",
        }}>
          {resultados.map((item, idx) => (
            <div
              key={item.cod}
              onMouseDown={() => escolher(item)}
              onMouseEnter={() => setHoverIdx(idx)}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: 13,
                background: idx === hoverIdx ? C.tealLight : C.white,
                borderBottom: idx < resultados.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex", justifyContent: "space-between", gap: 8,
              }}
            >
              <span>
                <span style={{ color: C.muted, marginRight: 6 }}>{item.cod}</span>
                <span style={{ color: C.text }}>{item.proc}</span>
              </span>
              <span style={{ color: C.teal, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(item.valor)}</span>
            </div>
          ))}
        </div>
      )}
      {aberto && termo && resultados.length === 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 20,
          background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 8,
          padding: "10px 12px", fontSize: 13, color: C.muted,
        }}>
          Nenhum procedimento encontrado.
        </div>
      )}
    </div>
  );
}

// Seletor de escopo de dentes: Elemento(s) específico(s) / Hemiarco / Arco
// value = { escopo: "elemento"|"hemiarco"|"arco", dentes: [n,n,...] }
function SeletorDentes({ value, onChange, modo = "permanente" }) {
  const escopo = value?.escopo || "elemento";
  const dentes = value?.dentes || [];

  const DENTES = modo === "deciduo" ? DENTES_DEC : DENTES_PERM;
  const TODOS = modo === "deciduo" ? TODOS_DENTES_DEC : TODOS_DENTES_PERM;

  const HEMIARCOS = [
    { key: "supDir", label: "Superior Direito", dentes: DENTES.supDir },
    { key: "supEsq", label: "Superior Esquerdo", dentes: DENTES.supEsq },
    { key: "infEsq", label: "Inferior Esquerdo", dentes: DENTES.infEsq },
    { key: "infDir", label: "Inferior Direito", dentes: DENTES.infDir },
  ];
  const ARCOS = [
    { key: "sup", label: "Arco Superior", dentes: [...DENTES.supDir, ...DENTES.supEsq] },
    { key: "inf", label: "Arco Inferior", dentes: [...DENTES.infDir, ...DENTES.infEsq] },
  ];

  function setEscopo(novoEscopo) {
    onChange({ escopo: novoEscopo, dentes: [] });
  }

  function toggleDenteElemento(d) {
    const atual = dentes.includes(d) ? dentes.filter(x => x !== d) : [...dentes, d].sort((a, b) => a - b);
    onChange({ escopo: "elemento", dentes: atual });
  }

  function escolherGrupo(grupoDentes) {
    onChange({ escopo, dentes: grupoDentes });
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Onde será feito? *
      </div>

      {/* Tipo de abrangência */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[
          { k: "elemento", label: "Dente(s) específico(s)" },
          { k: "hemiarco", label: "Hemiarco" },
          { k: "arco", label: "Arco completo" },
        ].map(opt => (
          <button key={opt.k} onClick={() => setEscopo(opt.k)} style={{
            flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
            border: `2px solid ${escopo === opt.k ? C.teal : C.border}`,
            background: escopo === opt.k ? C.tealLight : C.white,
            color: escopo === opt.k ? C.teal : C.muted,
          }}>{opt.label}</button>
        ))}
      </div>

      {/* Elemento: chips clicáveis de todos os dentes */}
      {escopo === "elemento" && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {TODOS.map(d => {
              const ativo = dentes.includes(d);
              return (
                <button key={d} onClick={() => toggleDenteElemento(d)} style={{
                  width: 34, height: 30, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  border: `1.5px solid ${ativo ? C.teal : C.border}`,
                  background: ativo ? C.teal : C.white,
                  color: ativo ? C.white : C.text,
                }}>{d}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {dentes.length === 0 ? "Clique nos dentes desejados (pode marcar vários)" : `${dentes.length} dente${dentes.length > 1 ? "s" : ""} selecionado${dentes.length > 1 ? "s" : ""}: ${dentes.join(", ")}`}
          </div>
        </div>
      )}

      {/* Hemiarco: 4 opções de quadrante */}
      {escopo === "hemiarco" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {HEMIARCOS.map(h => {
            const ativo = JSON.stringify(dentes) === JSON.stringify(h.dentes);
            return (
              <button key={h.key} onClick={() => escolherGrupo(h.dentes)} style={{
                padding: "9px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", textAlign: "left",
                border: `2px solid ${ativo ? C.teal : C.border}`,
                background: ativo ? C.tealLight : C.white,
                color: ativo ? C.teal : C.text,
                fontWeight: ativo ? 700 : 400,
              }}>
                {h.label}
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{h.dentes.join(", ")}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Arco: 2 opções */}
      {escopo === "arco" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {ARCOS.map(a => {
            const ativo = JSON.stringify(dentes) === JSON.stringify(a.dentes);
            return (
              <button key={a.key} onClick={() => escolherGrupo(a.dentes)} style={{
                padding: "9px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", textAlign: "left",
                border: `2px solid ${ativo ? C.teal : C.border}`,
                background: ativo ? C.tealLight : C.white,
                color: ativo ? C.teal : C.text,
                fontWeight: ativo ? 700 : 400,
              }}>
                {a.label}
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{a.dentes.join(", ")}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Btn({ children, variant = "primary", onClick, style, disabled }) {
  const styles = {
    primary: { background: C.teal, color: C.white, border: "none" },
    ghost: { background: "transparent", color: C.teal, border: `1.5px solid ${C.teal}` },
    danger: { background: C.red, color: C.white, border: "none" },
    amber: { background: C.amber, color: C.white, border: "none" },
    green: { background: C.green, color: C.white, border: "none" },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...styles[variant], padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity .15s", ...style }}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 14, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: C.navy, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.muted }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Módulo: Pacientes ──────────────────────────────────────────────
// ── Ficha completa do paciente ────────────────────────────────────
// Visão consolidada: dados, saldo financeiro, orçamentos (todos, do mais
// recente ao mais antigo) e histórico clínico — numa única tela.
function FichaPaciente({ paciente: p, state, dispatch, onVoltar, onEditar }) {
  const saldo = calcularSaldoPaciente(state, p.id);
  const idade = calcIdade(p.dataNasc);

  const orcsPac = state.orcamentos
    .filter(o => o.pacienteId === p.id)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

  const historicoPac = state.historicoClinico
    .filter(h => h.pacienteId === p.id)
    .sort((a, b) => b.data.localeCompare(a.data));

  const baixasPac = state.baixas
    .filter(b => b.pacienteId === p.id)
    .sort((a, b) => b.data.localeCompare(a.data));

  const statusColor = { pendente: "amber", aprovado: "green", cancelado: "red" };
  const tipoInfo = (k) => ({
    consulta: { cor: C.teal, icone: "🩺", label: "Consulta" },
    evolucao: { cor: "#9B59B6", icone: "📝", label: "Evolução clínica" },
    anamnese: { cor: C.amber, icone: "📋", label: "Anamnese" },
    exame: { cor: "#2E7D5B", icone: "🔬", label: "Exame / Imagem" },
    anotacao: { cor: C.muted, icone: "💬", label: "Anotação" },
  }[k] || { cor: C.muted, icone: "💬", label: k });

  return (
    <div>
      {/* Cabeçalho da ficha */}
      <div style={{ background: C.navy, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge color="teal">Ficha #{String(p.ficha).padStart(4, "0")}</Badge>
              {p.nomeSocial && <Badge color="amber">NOME SOCIAL</Badge>}
            </div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 22, marginTop: 6 }}>{p.nome}</div>
            {p.nomeSocial && p.nomeCivil && <div style={{ color: "#A0C4D5", fontSize: 13 }}>Nome civil: {p.nomeCivil}</div>}
            <div style={{ color: "#7AB8CC", fontSize: 13, marginTop: 4 }}>
              {idade !== null && `${idade} anos · `}
              Nasc: {p.dataNasc || "—"} · CPF: {p.cpf || "—"}
              {p.rg && ` · RG: ${p.rg}`}
            </div>
            <div style={{ color: "#7AB8CC", fontSize: 13, marginTop: 2 }}>
              📞 {p.telefone || "—"}{p.email && ` · ✉ ${p.email}`}
            </div>
            {p.responsavel && <div style={{ color: "#7AB8CC", fontSize: 13, marginTop: 2 }}>👪 Responsável: {p.responsavel}</div>}
            {p.obs && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>⚠ {p.obs}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
            <Btn variant="ghost" onClick={onVoltar}>← Voltar</Btn>
            <Btn variant="ghost" onClick={onEditar}>✏ Editar dados</Btn>
          </div>
        </div>
      </div>

      {/* Cards de resumo financeiro */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ background: C.tealLight, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase" }}>Realizado</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.teal, marginTop: 4 }}>{fmt(saldo.totalRealizado)}</div>
        </div>
        <div style={{ background: C.greenLight, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase" }}>Pago</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green, marginTop: 4 }}>{fmt(saldo.totalPago)}</div>
        </div>
        <div style={{ background: saldo.saldo > 0 ? C.redLight : C.greenLight, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: saldo.saldo > 0 ? C.red : C.green, textTransform: "uppercase" }}>
            {saldo.saldo > 0 ? "Saldo devedor" : saldo.saldo < 0 ? "Crédito" : "Quitado"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: saldo.saldo > 0 ? C.red : C.green, marginTop: 4 }}>
            {fmt(Math.abs(saldo.saldo))}
          </div>
        </div>
        <div style={{ background: C.amberLight, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase" }}>Orçamentos</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.amber, marginTop: 4 }}>{orcsPac.length}</div>
        </div>
      </div>

      {/* Orçamentos — do mais recente ao mais antigo */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 12 }}>
          📋 ORÇAMENTOS ({orcsPac.length})
        </div>
        {orcsPac.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 16 }}>Nenhum orçamento registrado.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orcsPac.map((orc, idx) => {
              const totalOrc = orc.itens.reduce((s, i) => s + i.valor, 0);
              return (
                <div key={orc.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge color="teal">Orç. #{orc.id}</Badge>
                      {idx === 0 && <Badge color="green">MAIS RECENTE</Badge>}
                      {orc.convenioNome && <Badge color="amber">{orc.convenioNome}</Badge>}
                      <Badge color={statusColor[orc.status]}>{orc.status.toUpperCase()}</Badge>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, color: C.teal }}>{fmt(totalOrc)}</span>
                      <span style={{ color: C.muted, fontSize: 12 }}>{orc.data}</span>
                      {orc.status === "pendente" && (
                        <Btn variant="green" onClick={() => dispatch({ type: "APROVAR_ORCAMENTO", payload: orc.id })}>✓ Aprovar</Btn>
                      )}
                    </div>
                  </div>
                  {orc.dentista && <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Dr(a). {orc.dentista}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {orc.itens.map((it, i) => {
                      const qtd = it.dentes?.length || 1;
                      const baixado = baixasPac.some(b => b.orcamentoId === orc.id && b.itemIdx === i);
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                          <span style={{ color: baixado ? C.muted : C.text, textDecoration: baixado ? "line-through" : "none" }}>
                            {it.cod && <span style={{ color: C.muted, marginRight: 6 }}>{it.cod}</span>}
                            {it.proc}
                            {it.dentes?.length > 0 && <span style={{ color: C.teal, marginLeft: 6 }}>· {it.dentes.join(", ")}</span>}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: C.teal, fontWeight: 600 }}>{fmt(it.valor)}</span>
                            {baixado && <Badge color="teal">✓</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Histórico clínico resumido */}
      <Card>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 12 }}>
          📜 HISTÓRICO CLÍNICO ({historicoPac.length})
        </div>
        {historicoPac.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 16 }}>Nenhum registro clínico ainda.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {historicoPac.map(h => {
              const tipo = tipoInfo(h.tipo);
              return (
                <div key={h.id} style={{ display: "flex", gap: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: tipo.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>{tipo.icone}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tipo.cor }}>{tipo.label}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{h.data}{h.dentista && ` · Dr(a). ${h.dentista}`}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.text, marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{h.texto}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Pacientes({ state, dispatch }) {
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formInicial, setFormInicial] = useState(emptyForm());
  const [salvando, setSalvando] = useState(false);
  const [cepStatus, setCepStatus] = useState(null);
  const [erros, setErros] = useState({});
  const [fichaSel, setFichaSel] = useState(null); // paciente cuja ficha está aberta

  const lista = useMemo(() => state.pacientes
    .filter(p =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.cpf.includes(busca) ||
      String(p.ficha).includes(busca)
    )
    .sort((a, b) => a.ficha - b.ficha), [state.pacientes, busca]);

  function abrirNovo() {
    const inicial = emptyForm();
    setForm(inicial); setFormInicial(inicial); setModal("novo"); setErros({}); setCepStatus(null);
  }
  function abrirEditar(p) {
    const inicial = { ...p, endereco: { ...p.endereco } };
    setForm(inicial); setFormInicial(inicial); setModal("editar"); setErros({}); setCepStatus(null);
  }

  function tentarFechar() {
    const alterado = JSON.stringify(form) !== JSON.stringify(formInicial);
    if (alterado && !window.confirm("Existem dados não salvos. Deseja sair e descartar as alterações?")) return;
    setModal(null);
  }

  // ── Busca ViaCEP ───────────────────────────────────────────────
  async function buscarCep(cepRaw) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepStatus("buscando");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { setCepStatus("erro"); return; }
      setForm(x => ({
        ...x,
        endereco: {
          ...x.endereco,
          cep: data.cep || x.endereco.cep,
          rua: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
        }
      }));
      setCepStatus("ok");
    } catch {
      setCepStatus("erro");
    }
  }

  // ── Validação ──────────────────────────────────────────────────
  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.dataNasc) e.dataNasc = "Data de nascimento obrigatória";

    const idade = calcIdade(form.dataNasc);
    const ehMenor = idade !== null && idade < 18;
    const temRg = form.rg.trim().length > 0;
    // CPF é obrigatório, exceto quando o paciente é menor de idade e já informou RG
    if (!form.cpf.trim() && !(ehMenor && temRg)) {
      e.cpf = ehMenor ? "Informe o CPF ou o RG" : "CPF obrigatório";
    } else if (form.cpf.trim() && !validarCPF(form.cpf)) {
      e.cpf = "CPF inválido — confira os números digitados";
    }

    if (!form.telefone.trim()) e.telefone = "Telefone obrigatório";
    if (!form.endereco.rua.trim()) e.rua = "Rua obrigatória";
    if (!form.endereco.cep.trim()) e.cep = "CEP obrigatório";
    if (!form.endereco.numero.trim()) e.numero = "Número obrigatório";
    if (!form.endereco.bairro.trim()) e.bairro = "Bairro obrigatório";
    if (!form.endereco.cidade.trim()) e.cidade = "Cidade obrigatória";
    if (!form.endereco.estado) e.estado = "Estado obrigatório";
    if (ehMenor && !form.responsavel.trim()) e.responsavel = "Responsável obrigatório para menores";
    if (form.nomeSocial && !form.nomeCivil.trim()) e.nomeCivil = "Informe o nome civil (conforme documento)";
    return e;
  }

  async function salvar() {
    const e = validar();
    if (Object.keys(e).length > 0) { setErros(e); return; }
    setSalvando(true);
    const ok = modal === "novo"
      ? await dispatch({ type: "ADD_PACIENTE", payload: form })
      : await dispatch({ type: "UPDATE_PACIENTE", payload: form });
    setSalvando(false);
    if (ok !== false) setModal(null);
  }

  const f = (k) => (e) => { setForm(x => ({ ...x, [k]: e.target.value })); setErros(x => ({ ...x, [k]: undefined })); };
  const fEnd = (k) => (e) => { setForm(x => ({ ...x, endereco: { ...x.endereco, [k]: e.target.value } })); setErros(x => ({ ...x, [k]: undefined })); };

  const idadeForm = calcIdade(form.dataNasc);
  const menorDeIdade = idadeForm !== null && idadeForm < 18;

  return (
    <div>
      {/* Ficha completa aberta */}
      {fichaSel && (
        <FichaPaciente
          paciente={fichaSel}
          state={state}
          dispatch={dispatch}
          onVoltar={() => setFichaSel(null)}
          onEditar={() => { abrirEditar(fichaSel); setFichaSel(null); }}
        />
      )}

      {!fichaSel && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            <Input placeholder="Buscar por nome, CPF ou nº da ficha…" value={busca} onChange={e => setBusca(e.target.value)} style={{ minWidth: 260, flex: 1 }} />
            <Btn onClick={abrirNovo}>+ Novo Paciente</Btn>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lista.map(p => {
              const idade = calcIdade(p.dataNasc);
              const end = p.endereco;
              const endTxt = end && (end.rua || end.cidade)
                ? `${end.rua}${end.numero ? ", " + end.numero : ""}${end.bairro ? " — " + end.bairro : ""}${end.cidade ? ", " + end.cidade + "/" + end.estado : ""}`
                : null;
              const saldo = calcularSaldoPaciente(state, p.id);
              const qtdOrc = state.orcamentos.filter(o => o.pacienteId === p.id).length;
              return (
                <Card key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Badge color="teal">Ficha #{String(p.ficha).padStart(4, "0")}</Badge>
                      <span style={{ fontWeight: 700, color: C.navy, fontSize: 16 }}>{p.nome}</span>
                      {p.nomeSocial && <Badge color="amber">NOME SOCIAL</Badge>}
                      {idade !== null && <span style={{ color: C.muted, fontSize: 13 }}>· {idade} anos</span>}
                      {saldo.saldo > 0 && <Badge color="red">Deve {fmt(saldo.saldo)}</Badge>}
                    </div>
                    {p.nomeSocial && p.nomeCivil && (
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Nome civil: {p.nomeCivil}</div>
                    )}
                    <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                      CPF: {p.cpf || "—"}{p.rg && <> · RG: {p.rg}</>} · Tel: {p.telefone || "—"}
                    </div>
                    {endTxt && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>📍 {endTxt}</div>}
                    {p.responsavel && <div style={{ color: C.teal, fontSize: 12, marginTop: 2 }}>👪 Responsável: {p.responsavel}</div>}
                    {p.obs && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>⚠ {p.obs}</div>}
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                      {qtdOrc} orçamento(s) · {state.baixas.filter(b => b.pacienteId === p.id).length} procedimento(s) realizado(s)
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
                    <Btn onClick={() => setFichaSel(p)}>📋 Ver Ficha</Btn>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="ghost" onClick={() => abrirEditar(p)}>Editar</Btn>
                      <Btn variant="danger" onClick={() => dispatch({ type: "DELETE_PACIENTE", payload: p.id })}>Excluir</Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
            {lista.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum paciente encontrado.</div>}
          </div>
        </>
      )}

      {modal && (
        <Modal title={modal === "novo" ? "Novo Paciente" : `Editar Paciente — Ficha #${String(form.ficha).padStart(4, "0")}`} onClose={tentarFechar}>
          <div style={{ display: "grid", gap: 14 }}>

            {/* ── Nome social ── */}
            <div style={{ background: C.tealLight, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="nomeSocial"
                checked={form.nomeSocial}
                onChange={e => setForm(x => ({ ...x, nomeSocial: e.target.checked }))}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.teal }}
              />
              <label htmlFor="nomeSocial" style={{ fontSize: 13, color: C.teal, fontWeight: 600, cursor: "pointer" }}>
                O nome informado abaixo é o nome social do paciente
              </label>
            </div>

            {/* ── Dados pessoais ── */}
            <Campo erro={erros.nome}>
              <Input label={form.nomeSocial ? "Nome social *" : "Nome completo *"} value={form.nome} onChange={f("nome")} style={erros.nome ? { borderColor: C.red } : {}} />
            </Campo>

            {form.nomeSocial && (
              <Campo erro={erros.nomeCivil}>
                <Input
                  label="Nome civil (conforme documento) *"
                  value={form.nomeCivil}
                  onChange={f("nomeCivil")}
                  style={erros.nomeCivil ? { borderColor: C.red } : {}}
                />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  Usado apenas para documentos oficiais (NF, convênio). O paciente será chamado pelo nome social em todo o sistema.
                </div>
              </Campo>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
              <Campo erro={erros.dataNasc}>
                <Input label="Data de nascimento *" type="date" value={form.dataNasc} onChange={f("dataNasc")} style={erros.dataNasc ? { borderColor: C.red } : {}} />
              </Campo>
              <Input label="Idade" value={idadeForm !== null ? `${idadeForm} anos` : "—"} disabled />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Campo erro={erros.cpf}>
                <Input
                  label={menorDeIdade ? "CPF (ou informe o RG abaixo)" : "CPF *"}
                  value={form.cpf}
                  onChange={e => {
                    const masked = maskCPF(e.target.value);
                    setForm(x => ({ ...x, cpf: masked }));
                    setErros(x => ({ ...x, cpf: undefined }));
                  }}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  style={erros.cpf ? { borderColor: C.red } : (form.cpf.replace(/\D/g,"").length === 11 && validarCPF(form.cpf) ? { borderColor: C.green } : {})}
                />
                {!erros.cpf && form.cpf.replace(/\D/g,"").length === 11 && (
                  validarCPF(form.cpf)
                    ? <div style={{ color: C.green, fontSize: 11, marginTop: 3 }}>✓ CPF válido</div>
                    : <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>⚠ CPF inválido — confira os números</div>
                )}
              </Campo>
              <Input label={menorDeIdade ? "RG" : "RG (opcional)"} value={form.rg} onChange={f("rg")} placeholder="00.000.000-0" />
            </div>
            {menorDeIdade && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: -8 }}>
                Para menores de idade sem CPF, o RG é suficiente para o cadastro.
              </div>
            )}

            {menorDeIdade && (
              <div style={{ background: C.amberLight, borderRadius: 8, padding: "10px 12px" }}>
                <Campo erro={erros.responsavel}>
                  <Input label="Nome do responsável * (menor de idade)" value={form.responsavel} onChange={f("responsavel")} style={{ background: C.white, ...(erros.responsavel ? { borderColor: C.red } : {}) }} />
                </Campo>
              </div>
            )}

            {/* ── Endereço ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 12 }}>ENDEREÇO</div>
              <div style={{ display: "grid", gap: 10 }}>

                {/* CEP com botão buscar */}
                <Campo erro={erros.cep}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        label="CEP *"
                        value={form.endereco.cep}
                        onChange={e => { fEnd("cep")(e); setCepStatus(null); }}
                        onBlur={e => buscarCep(e.target.value)}
                        placeholder="00000-000"
                        style={erros.cep ? { borderColor: C.red } : {}}
                      />
                    </div>
                    <Btn
                      variant="ghost"
                      onClick={() => buscarCep(form.endereco.cep)}
                      disabled={cepStatus === "buscando"}
                      style={{ whiteSpace: "nowrap", height: 36 }}
                    >
                      {cepStatus === "buscando" ? "Buscando…" : "🔍 Buscar CEP"}
                    </Btn>
                  </div>
                  {cepStatus === "ok" && <div style={{ color: C.green, fontSize: 11, marginTop: 3 }}>✓ Endereço preenchido automaticamente</div>}
                  {cepStatus === "erro" && <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>⚠ CEP não encontrado. Preencha manualmente.</div>}
                </Campo>

                <Campo erro={erros.rua}>
                  <Input label="Rua *" value={form.endereco.rua} onChange={fEnd("rua")} style={erros.rua ? { borderColor: C.red } : {}} />
                </Campo>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                  <Campo erro={erros.numero}>
                    <Input label="Número *" value={form.endereco.numero} onChange={fEnd("numero")} style={erros.numero ? { borderColor: C.red } : {}} />
                  </Campo>
                  <Input label="Complemento" value={form.endereco.complemento} onChange={fEnd("complemento")} placeholder="Apto, bloco, casa… (opcional)" />
                </div>

                <Campo erro={erros.bairro}>
                  <Input label="Bairro *" value={form.endereco.bairro} onChange={fEnd("bairro")} style={erros.bairro ? { borderColor: C.red } : {}} />
                </Campo>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <Campo erro={erros.cidade}>
                    <Input label="Cidade *" value={form.endereco.cidade} onChange={fEnd("cidade")} style={erros.cidade ? { borderColor: C.red } : {}} />
                  </Campo>
                  <Campo erro={erros.estado}>
                    <Select label="Estado *" value={form.endereco.estado} onChange={fEnd("estado")} style={erros.estado ? { borderColor: C.red } : {}}>
                      <option value="">UF</option>
                      {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </Select>
                  </Campo>
                </div>
              </div>
            </div>

            {/* ── Contato ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Campo erro={erros.telefone}>
                  <Input label="Telefone *" value={form.telefone} onChange={f("telefone")} placeholder="(00) 00000-0000" style={erros.telefone ? { borderColor: C.red } : {}} />
                </Campo>
                <Input label="E-mail" value={form.email} onChange={f("email")} placeholder="(opcional)" />
              </div>
              <Input label="Observações / Alertas médicos" value={form.obs} onChange={f("obs")} />
            </div>

            {Object.keys(erros).length > 0 && (
              <div style={{ background: C.redLight, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13 }}>
                Preencha todos os campos obrigatórios (*) antes de salvar.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={tentarFechar}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Dentistas / Profissionais ──────────────────────────────
// Editor de tabela de repasse fixo por procedimento — usado no cadastro de
// dentista quando o tipo de repasse é "fixo" (componente top-level, mesma
// razão dos outros editores: precisa estar fora do form pai por causa do foco)
function EditorTabelaFixa({ itens, onChange }) {
  function addItem() {
    onChange([...itens, { cod: "", proc: "", valor: "" }]);
  }
  function remItem(i) {
    onChange(itens.filter((_, idx) => idx !== i));
  }
  function selecionarProc(i, cod) {
    const p = PROC_MAP[Number(cod)];
    onChange(itens.map((it, idx) => idx === i ? { cod: p?.cod || "", proc: p?.proc || "", valor: it.valor } : it));
  }
  function setValor(i, valor) {
    onChange(itens.map((it, idx) => idx === i ? { ...it, valor } : it));
  }

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Tabela de repasse fixo (por procedimento)
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {itens.map((it, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "1fr 110px 32px", gap: 8, alignItems: "end" }}>
            <ProcSearch
              label={`Procedimento ${i + 1}`}
              value={it.cod}
              onSelect={(cod) => selecionarProc(i, cod)}
            />
            <Input label="Valor repasse (R$)" type="number" value={it.valor} onChange={e => setValor(i, e.target.value)} />
            <button onClick={() => remItem(i)} style={{ background: C.redLight, color: C.red, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, height: 36 }}>×</button>
          </div>
        ))}
      </div>
      <Btn variant="ghost" onClick={addItem} style={{ fontSize: 12, padding: "6px 14px", marginTop: 8 }}>+ Adicionar procedimento à tabela</Btn>
      {itens.length === 0 && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Nenhum procedimento na tabela ainda. Procedimentos fora desta lista não geram repasse automático — use o ajuste manual ao fechar o repasse.</div>
      )}
    </div>
  );
}

function Dentistas({ state, dispatch }) {
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyFormDentista());
  const [cepStatus, setCepStatus] = useState(null);
  const [erros, setErros] = useState({});

  const lista = useMemo(() => state.dentistasCadastrados.filter(d =>
    d.nome.toLowerCase().includes(busca.toLowerCase()) ||
    d.cpf.includes(busca) ||
    d.cro.toLowerCase().includes(busca.toLowerCase()) ||
    String(d.ficha).includes(busca)
  ), [state.dentistasCadastrados, busca]);

  function abrirNovo() { setForm(emptyFormDentista()); setModal("novo"); setErros({}); setCepStatus(null); }
  function abrirEditar(d) { setForm({ ...d, endereco: { ...d.endereco } }); setModal("editar"); setErros({}); setCepStatus(null); }

  async function buscarCep(cepRaw) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepStatus("buscando");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { setCepStatus("erro"); return; }
      setForm(x => ({
        ...x,
        endereco: {
          ...x.endereco,
          cep: data.cep || x.endereco.cep,
          rua: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
        }
      }));
      setCepStatus("ok");
    } catch {
      setCepStatus("erro");
    }
  }

  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.dataNasc) e.dataNasc = "Data de nascimento obrigatória";
    if (!form.cro.trim()) e.cro = "CRO obrigatório";
    if (!form.especialidade) e.especialidade = "Especialidade obrigatória";

    if (!form.cpf.trim()) {
      e.cpf = "CPF obrigatório";
    } else if (!validarCPF(form.cpf)) {
      e.cpf = "CPF inválido — confira os números digitados";
    }

    if (!form.telefone.trim()) e.telefone = "Telefone obrigatório";
    if (!form.endereco.rua.trim()) e.rua = "Rua obrigatória";
    if (!form.endereco.cep.trim()) e.cep = "CEP obrigatório";
    if (!form.endereco.numero.trim()) e.numero = "Número obrigatório";
    if (!form.endereco.bairro.trim()) e.bairro = "Bairro obrigatório";
    if (!form.endereco.cidade.trim()) e.cidade = "Cidade obrigatória";
    if (!form.endereco.estado) e.estado = "Estado obrigatório";
    if (form.nomeSocial && !form.nomeCivil.trim()) e.nomeCivil = "Informe o nome civil (conforme documento)";
    return e;
  }

  function salvar() {
    const e = validar();
    if (Object.keys(e).length > 0) { setErros(e); return; }
    if (modal === "novo") dispatch({ type: "ADD_DENTISTA", payload: form });
    else dispatch({ type: "UPDATE_DENTISTA", payload: form });
    setModal(null);
  }

  const f = (k) => (e) => { setForm(x => ({ ...x, [k]: e.target.value })); setErros(x => ({ ...x, [k]: undefined })); };
  const fEnd = (k) => (e) => { setForm(x => ({ ...x, endereco: { ...x.endereco, [k]: e.target.value } })); setErros(x => ({ ...x, [k]: undefined })); };

  const idadeForm = calcIdade(form.dataNasc);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <Input placeholder="Buscar por nome, CPF, CRO ou nº da ficha…" value={busca} onChange={e => setBusca(e.target.value)} style={{ minWidth: 260, flex: 1 }} />
        <Btn onClick={abrirNovo}>+ Novo Profissional</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map(d => {
          const idade = calcIdade(d.dataNasc);
          const end = d.endereco;
          const endTxt = end && (end.rua || end.cidade)
            ? `${end.rua}${end.numero ? ", " + end.numero : ""}${end.bairro ? " — " + end.bairro : ""}${end.cidade ? ", " + end.cidade + "/" + end.estado : ""}`
            : null;
          return (
            <Card key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Badge color="teal">Ficha #{String(d.ficha).padStart(4, "0")}</Badge>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 16 }}>{d.nome}</span>
                  {d.nomeSocial && <Badge color="amber">NOME SOCIAL</Badge>}
                  {d.especialidade && <Badge color="green">{d.especialidade}</Badge>}
                  {idade !== null && <span style={{ color: C.muted, fontSize: 13 }}>· {idade} anos</span>}
                </div>
                {d.nomeSocial && d.nomeCivil && (
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Nome civil (documentos): {d.nomeCivil}</div>
                )}
                <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                  CRO: {d.cro || "—"} · CPF: {d.cpf || "—"}{d.rg && <> · RG: {d.rg}</>} · Tel: {d.telefone || "—"}
                </div>
                {endTxt && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>📍 {endTxt}</div>}
                {d.obs && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>⚠ {d.obs}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => abrirEditar(d)}>Editar</Btn>
                <Btn variant="danger" onClick={() => dispatch({ type: "DELETE_DENTISTA", payload: d.id })}>Excluir</Btn>
              </div>
            </Card>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum profissional encontrado.</div>}
      </div>

      {modal && (
        <Modal title={modal === "novo" ? "Novo Profissional" : `Editar Profissional — Ficha #${String(form.ficha).padStart(4, "0")}`} onClose={() => setModal(null)}>
          <div style={{ display: "grid", gap: 14 }}>

            {/* ── Nome social ── */}
            <div style={{ background: C.tealLight, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="nomeSocialDent"
                checked={form.nomeSocial}
                onChange={e => setForm(x => ({ ...x, nomeSocial: e.target.checked }))}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.teal }}
              />
              <label htmlFor="nomeSocialDent" style={{ fontSize: 13, color: C.teal, fontWeight: 600, cursor: "pointer" }}>
                O nome informado abaixo é o nome social do profissional
              </label>
            </div>

            {/* ── Dados pessoais ── */}
            <Campo erro={erros.nome}>
              <Input label={form.nomeSocial ? "Nome social *" : "Nome completo *"} value={form.nome} onChange={f("nome")} style={erros.nome ? { borderColor: C.red } : {}} />
            </Campo>

            {form.nomeSocial && (
              <Campo erro={erros.nomeCivil}>
                <Input
                  label="Nome civil (conforme documento) *"
                  value={form.nomeCivil}
                  onChange={f("nomeCivil")}
                  style={erros.nomeCivil ? { borderColor: C.red } : {}}
                />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  Usado apenas para documentos oficiais. O profissional será chamado pelo nome social em todo o sistema.
                </div>
              </Campo>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
              <Campo erro={erros.dataNasc}>
                <Input label="Data de nascimento *" type="date" value={form.dataNasc} onChange={f("dataNasc")} style={erros.dataNasc ? { borderColor: C.red } : {}} />
              </Campo>
              <Input label="Idade" value={idadeForm !== null ? `${idadeForm} anos` : "—"} disabled />
            </div>

            {/* ── CRO e Especialidade ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Campo erro={erros.cro}>
                <Input label="CRO *" value={form.cro} onChange={f("cro")} placeholder="Ex: CRO-SP 12345" style={erros.cro ? { borderColor: C.red } : {}} />
              </Campo>
              <Campo erro={erros.especialidade}>
                <Select label="Especialidade *" value={form.especialidade} onChange={f("especialidade")} style={erros.especialidade ? { borderColor: C.red } : {}}>
                  <option value="">Selecione…</option>
                  {ESPECIALIDADES.map(esp => <option key={esp} value={esp}>{esp}</option>)}
                </Select>
              </Campo>
            </div>

            {/* ── Regra de repasse ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>REGRA DE REPASSE</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[
                  { k: "percentual", label: "Percentual (%)" },
                  { k: "fixo", label: "Valor fixo por procedimento" },
                ].map(opt => (
                  <button key={opt.k} onClick={() => setForm(x => ({ ...x, repasseTipo: opt.k }))} style={{
                    flex: 1, padding: "9px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: `2px solid ${form.repasseTipo === opt.k ? C.teal : C.border}`,
                    background: form.repasseTipo === opt.k ? C.tealLight : C.white,
                    color: form.repasseTipo === opt.k ? C.teal : C.muted,
                  }}>{opt.label}</button>
                ))}
              </div>

              {form.repasseTipo === "percentual" ? (
                <Input
                  label="Percentual de repasse (%)"
                  type="number"
                  value={form.repassePercentual}
                  onChange={f("repassePercentual")}
                  placeholder="Ex: 40"
                />
              ) : (
                <EditorTabelaFixa
                  itens={form.repasseTabelaFixa}
                  onChange={(itens) => setForm(x => ({ ...x, repasseTabelaFixa: itens }))}
                />
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Campo erro={erros.cpf}>
                <Input
                  label="CPF *"
                  value={form.cpf}
                  onChange={e => {
                    const masked = maskCPF(e.target.value);
                    setForm(x => ({ ...x, cpf: masked }));
                    setErros(x => ({ ...x, cpf: undefined }));
                  }}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  style={erros.cpf ? { borderColor: C.red } : (form.cpf.replace(/\D/g,"").length === 11 && validarCPF(form.cpf) ? { borderColor: C.green } : {})}
                />
                {!erros.cpf && form.cpf.replace(/\D/g,"").length === 11 && (
                  validarCPF(form.cpf)
                    ? <div style={{ color: C.green, fontSize: 11, marginTop: 3 }}>✓ CPF válido</div>
                    : <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>⚠ CPF inválido — confira os números</div>
                )}
              </Campo>
              <Input label="RG (opcional)" value={form.rg} onChange={f("rg")} placeholder="00.000.000-0" />
            </div>

            {/* ── Endereço ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 12 }}>ENDEREÇO</div>
              <div style={{ display: "grid", gap: 10 }}>

                <Campo erro={erros.cep}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        label="CEP *"
                        value={form.endereco.cep}
                        onChange={e => { fEnd("cep")(e); setCepStatus(null); }}
                        onBlur={e => buscarCep(e.target.value)}
                        placeholder="00000-000"
                        style={erros.cep ? { borderColor: C.red } : {}}
                      />
                    </div>
                    <Btn
                      variant="ghost"
                      onClick={() => buscarCep(form.endereco.cep)}
                      disabled={cepStatus === "buscando"}
                      style={{ whiteSpace: "nowrap", height: 36 }}
                    >
                      {cepStatus === "buscando" ? "Buscando…" : "🔍 Buscar CEP"}
                    </Btn>
                  </div>
                  {cepStatus === "ok" && <div style={{ color: C.green, fontSize: 11, marginTop: 3 }}>✓ Endereço preenchido automaticamente</div>}
                  {cepStatus === "erro" && <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>⚠ CEP não encontrado. Preencha manualmente.</div>}
                </Campo>

                <Campo erro={erros.rua}>
                  <Input label="Rua *" value={form.endereco.rua} onChange={fEnd("rua")} style={erros.rua ? { borderColor: C.red } : {}} />
                </Campo>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                  <Campo erro={erros.numero}>
                    <Input label="Número *" value={form.endereco.numero} onChange={fEnd("numero")} style={erros.numero ? { borderColor: C.red } : {}} />
                  </Campo>
                  <Input label="Complemento" value={form.endereco.complemento} onChange={fEnd("complemento")} placeholder="Apto, bloco, casa… (opcional)" />
                </div>

                <Campo erro={erros.bairro}>
                  <Input label="Bairro *" value={form.endereco.bairro} onChange={fEnd("bairro")} style={erros.bairro ? { borderColor: C.red } : {}} />
                </Campo>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <Campo erro={erros.cidade}>
                    <Input label="Cidade *" value={form.endereco.cidade} onChange={fEnd("cidade")} style={erros.cidade ? { borderColor: C.red } : {}} />
                  </Campo>
                  <Campo erro={erros.estado}>
                    <Select label="Estado *" value={form.endereco.estado} onChange={fEnd("estado")} style={erros.estado ? { borderColor: C.red } : {}}>
                      <option value="">UF</option>
                      {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </Select>
                  </Campo>
                </div>
              </div>
            </div>

            {/* ── Contato ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Campo erro={erros.telefone}>
                  <Input label="Telefone *" value={form.telefone} onChange={f("telefone")} placeholder="(00) 00000-0000" style={erros.telefone ? { borderColor: C.red } : {}} />
                </Campo>
                <Input label="E-mail" value={form.email} onChange={f("email")} placeholder="(opcional)" />
              </div>
              <Input label="Observações" value={form.obs} onChange={f("obs")} placeholder="Opcional" />
            </div>

            {Object.keys(erros).length > 0 && (
              <div style={{ background: C.redLight, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13 }}>
                Preencha todos os campos obrigatórios (*) antes de salvar.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar}>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Convênios ──────────────────────────────────────────────
// Cadastro de convênios odontológicos: dados de contato e tabela própria
// de valores por procedimento (geralmente diferente da tabela particular).
function Convenios({ state, dispatch }) {
  const emptyConv = () => ({ nome: "", contato: "", telefone: "", email: "", obs: "", tabela: [] });
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null); // null | "novo" | "editar"
  const [form, setForm] = useState(emptyConv());
  const [erros, setErros] = useState({});

  const lista = useMemo(() => state.convenios.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  ), [state.convenios, busca]);

  function abrirNovo() { setForm(emptyConv()); setModal("novo"); setErros({}); }
  function abrirEditar(c) { setForm({ ...c, tabela: [...(c.tabela || [])] }); setModal("editar"); setErros({}); }

  function salvar() {
    const e = {};
    if (!form.nome.trim()) e.nome = "Nome do convênio obrigatório";
    if (Object.keys(e).length > 0) { setErros(e); return; }
    if (modal === "novo") dispatch({ type: "ADD_CONVENIO", payload: form });
    else dispatch({ type: "UPDATE_CONVENIO", payload: form });
    setModal(null);
  }

  const f = (k) => (e) => { setForm(x => ({ ...x, [k]: e.target.value })); setErros(x => ({ ...x, [k]: undefined })); };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <Input placeholder="Buscar convênio…" value={busca} onChange={e => setBusca(e.target.value)} style={{ minWidth: 260, flex: 1 }} />
        <Btn onClick={abrirNovo}>+ Novo Convênio</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map(c => (
          <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: C.navy, fontSize: 16 }}>{c.nome}</span>
                <Badge color="teal">{(c.tabela || []).length} procedimento(s) na tabela</Badge>
              </div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                {c.contato && <>Contato: {c.contato} · </>}
                {c.telefone && <>Tel: {c.telefone} · </>}
                {c.email && <>{c.email}</>}
              </div>
              {c.obs && <div style={{ color: C.muted, fontSize: 12, marginTop: 2, fontStyle: "italic" }}>{c.obs}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => abrirEditar(c)}>Editar</Btn>
              <Btn variant="danger" onClick={() => dispatch({ type: "DELETE_CONVENIO", payload: c.id })}>Excluir</Btn>
            </div>
          </Card>
        ))}
        {lista.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum convênio cadastrado.</div>}
      </div>

      {modal && (
        <Modal title={modal === "novo" ? "Novo Convênio" : "Editar Convênio"} onClose={() => setModal(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            <Campo erro={erros.nome}>
              <Input label="Nome do convênio *" value={form.nome} onChange={f("nome")} placeholder="Ex: Unimed Odonto, Amil Dental…" style={erros.nome ? { borderColor: C.red } : {}} />
            </Campo>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Pessoa de contato" value={form.contato} onChange={f("contato")} placeholder="Opcional" />
              <Input label="Telefone" value={form.telefone} onChange={f("telefone")} placeholder="Opcional" />
            </div>
            <Input label="E-mail" value={form.email} onChange={f("email")} placeholder="Opcional" />
            <Input label="Observações" value={form.obs} onChange={f("obs")} placeholder="Opcional — regras de envio de guia, prazos, etc." />

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <EditorTabelaFixa
                itens={form.tabela}
                onChange={(itens) => setForm(x => ({ ...x, tabela: itens }))}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar}>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tabela de procedimentos Clear Field ───────────────────────────
const TABELA = [
  { grupo: "Exodontia", itens: [
    { cod: 101, proc: "Exodontia simples", valor: 200 },
    { cod: 102, proc: "Exodontia de raiz residual", valor: 250 },
    { cod: 103, proc: "Exodontia 3º molar erupcionado", valor: 350 },
    { cod: 104, proc: "Exodontia 3º molar semi-incluso", valor: 650 },
    { cod: 105, proc: "Exodontia 3º molar incluso", valor: 950 },
    { cod: 106, proc: "Exodontia decíduo (rizólise)", valor: 100 },
  ]},
  { grupo: "Restaurações", itens: [
    { cod: 201, proc: "Restauração 1 face", valor: 100 },
    { cod: 202, proc: "Restauração 2 faces", valor: 125 },
    { cod: 203, proc: "Restauração 3 faces", valor: 150 },
    { cod: 204, proc: "Reconstrução em resina", valor: 200 },
    { cod: 205, proc: "Reconstrução com pino", valor: 250 },
    { cod: 206, proc: "Facetas", valor: 400 },
  ]},
  { grupo: "Endodontia", itens: [
    { cod: 301, proc: "Canal 1 conduto", valor: 700 },
    { cod: 302, proc: "Canal 2 condutos", valor: 900 },
    { cod: 303, proc: "Canal 3 condutos", valor: 1200 },
    { cod: 304, proc: "Canal 1 conduto — sessão única", valor: 1300 },
    { cod: 305, proc: "Canal 2 condutos — sessão única", valor: 1400 },
    { cod: 306, proc: "Canal 3 condutos — sessão única", valor: 1500 },
    { cod: 307, proc: "Retratamento canal 1 conduto", valor: 1300 },
    { cod: 308, proc: "Retratamento canal 2 condutos", valor: 1400 },
    { cod: 309, proc: "Retratamento canal 3 condutos", valor: 1500 },
    { cod: 310, proc: "Retirada de lima fraturada", valor: 2400 },
  ]},
  { grupo: "Estética / Clareamento", itens: [
    { cod: 401, proc: "Clareamento consultório (3 sessões)", valor: 900 },
    { cod: 402, proc: "Clareamento 1 sessão", valor: 350 },
    { cod: 403, proc: "Clareamento caseiro (3 seringas)", valor: 700 },
    { cod: 404, proc: "Seringa para clareamento", valor: 175 },
    { cod: 405, proc: "Clareamento misto (1 sessão + 2 seringas)", valor: 800 },
    { cod: 406, proc: "Aplicação de toxina botulínica", valor: 900 },
    { cod: 407, proc: "Aplicação de preenchedor", valor: 1200 },
  ]},
  { grupo: "Implantodontia", itens: [
    { cod: 501, proc: "Levantamento de seio", valor: 1400 },
    { cod: 502, proc: "Enxerto ósseo", valor: 600 },
    { cod: 503, proc: "Implante unitário", valor: 1000 },
    { cod: 504, proc: "Implante para protocolo (por unidade)", valor: 800 },
    { cod: 505, proc: "Micro-implante ortodôntico", valor: 1000 },
  ]},
  { grupo: "Ortodontia", itens: [
    { cod: 601, proc: "Colagem aparelho convencional", valor: 150 },
    { cod: 602, proc: "Manutenção aparelho convencional", valor: 120 },
    { cod: 603, proc: "Colagem aparelho autoligado", valor: 1500 },
    { cod: 604, proc: "Manutenção aparelho autoligado", valor: 150 },
    { cod: 605, proc: "Colagem aparelho estético", valor: 250 },
    { cod: 606, proc: "Manutenção aparelho estético", valor: 130 },
    { cod: 607, proc: "Colagem aparelho estético autoligado", valor: 2500 },
    { cod: 608, proc: "Manutenção aparelho estético autoligado", valor: 250 },
    { cod: 609, proc: "Alinhador Invisalign Fast Simples", valor: 2400 },
    { cod: 610, proc: "Alinhador Invisalign Fast Moderado", valor: 3975 },
    { cod: 611, proc: "Alinhador Invisalign Fast Intermediário", valor: 5055 },
    { cod: 612, proc: "Alinhador Invisalign Fast Smart", valor: 6090 },
    { cod: 613, proc: "Alinhador Invisalign Fast Premium", valor: 7380 },
    { cod: 614, proc: "Alinhador Invisalign Fast Full", valor: 7950 },
    { cod: 615, proc: "Manutenção de alinhador", valor: 200 },
    { cod: 616, proc: "Contenção Hawley", valor: 350 },
    { cod: 617, proc: "Contenção fixa", valor: 350 },
    { cod: 618, proc: "Contenção de acetato", valor: 350 },
    { cod: 619, proc: "Expansor Hirax", valor: 750 },
    { cod: 620, proc: "Expansor com dente", valor: 850 },
    { cod: 621, proc: "Expansor e contenção", valor: 950 },
    { cod: 622, proc: "Expansor Hass", valor: 750 },
    { cod: 623, proc: "Mantenedor de espaço", valor: 400 },
    { cod: 624, proc: "Tracionamento cirúrgico", valor: 800 },
  ]},
  { grupo: "Periodontia / Profilaxia", itens: [
    { cod: 701, proc: "Raspagem com ultrassom", valor: 150 },
    { cod: 702, proc: "Profilaxia e aplicação de flúor", valor: 100 },
    { cod: 703, proc: "Aumento de coroa clínica", valor: 350 },
    { cod: 704, proc: "Gengivoplastia", valor: 350 },
    { cod: 705, proc: "Sessão complementar de raspagem", valor: 75 },
    { cod: 706, proc: "Retirada de aparelho", valor: 200 },
  ]},
  { grupo: "Próteses", itens: [
    { cod: 801, proc: "Prótese total definitiva", valor: 1500 },
    { cod: 802, proc: "Prótese total provisória", valor: 1000 },
    { cod: 803, proc: "Prótese parcial acrílica provisória", valor: 1000 },
    { cod: 804, proc: "Prótese parcial acrílica definitiva", valor: 1200 },
    { cod: 805, proc: "Prótese parcial metálica", valor: 1800 },
    { cod: 806, proc: "Prótese parcial flexível", valor: 2200 },
    { cod: 807, proc: "Coroa sobre implante unitária", valor: 2000 },
    { cod: 808, proc: "Coroa metalocerâmica unitária", valor: 1300 },
    { cod: 809, proc: "Coroa metálica", valor: 1200 },
    { cod: 810, proc: "Prótese adesiva definitiva unitária", valor: 1300 },
    { cod: 811, proc: "Prótese adesiva provisória unitária", valor: 500 },
    { cod: 812, proc: "Protocolo de Branemark", valor: 9500 },
    { cod: 813, proc: "Prótese Overdenture Oring", valor: 11000 },
    { cod: 814, proc: "Prótese Overdenture Barra", valor: 11000 },
    { cod: 815, proc: "Protocolo carga imediata", valor: 19000 },
    { cod: 816, proc: "Placa para bruxismo", valor: 400 },
    { cod: 817, proc: "Placa para clareamento", valor: 200 },
    { cod: 818, proc: "Dente provisório em orto", valor: 275 },
  ]},
  { grupo: "Radiografia", itens: [
    { cod: 901, proc: "Radiografia periapical", valor: 50 },
    { cod: 902, proc: "Radiografia interoclusal", valor: 50 },
  ]},
  { grupo: "Outros", itens: [
    { cod: 1001, proc: "Pulpotomia", valor: 160 },
    { cod: 1002, proc: "Pulpectomia", valor: 220 },
    { cod: 1003, proc: "Troca de curativo endodôntico", valor: 110 },
    { cod: 1004, proc: "Curativo CIV", valor: 125 },
    { cod: 1005, proc: "Conserto de prótese", valor: 250 },
    { cod: 1006, proc: "Confecção de provisório", valor: 275 },
    { cod: 1007, proc: "Ulectomia", valor: 180 },
  ]},
];

// Mapa cod → {proc, valor} para lookup rápido
const PROC_MAP = {};
TABELA.forEach(g => g.itens.forEach(i => { PROC_MAP[i.cod] = i; }));

// Documento formatado do orçamento, pensado para visualização e impressão.
// Usa @media print para esconder a interface do app e mostrar só o documento.
// Cabeçalho da clínica no padrão visual usado nos impressos oficiais:
// selo "CF" em bordô + nome grande "CLEAR FIELD" + subtítulo, número EPAO à direita.
// Logo oficial da clínica (extraído do receituário original), embutido como
// data URI para funcionar offline e ser fiel ao documento real.
const LOGO_BASE64 = "data:image/png;base64,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";

function CabecalhoClinica() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 18 }}>
      <img src={LOGO_BASE64} alt="Clear Field" style={{ width: 56, height: "auto", flexShrink: 0 }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 400, color: "#000", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 1, lineHeight: 1, whiteSpace: "nowrap" }}>
          CLEAR FIELD
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8B8B8B", letterSpacing: 0.5, marginTop: 4, fontFamily: "Arial, sans-serif", whiteSpace: "nowrap" }}>
          {CLINICA.subtitulo}
        </div>
        <div style={{ fontSize: 10, color: "#333", textAlign: "center", marginTop: 6, whiteSpace: "nowrap" }}>{CLINICA.epao}</div>
      </div>
    </div>
  );
}

// Rodapé padrão com o endereço completo da clínica, idêntico ao usado nos impressos oficiais.
function RodapeClinica() {
  return (
    <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#000", marginTop: 40 }}>
      {CLINICA.endereco}
    </div>
  );
}

function TabelasPreco({ state, dispatch }) {
  const nova = () => ({ nome: "", tipo: "particular", convenioId: "", ativo: true, padrao: false, itens: [] });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(nova());
  const [erro, setErro] = useState("");

  function abrir(tabela, duplicar = false) {
    setForm(tabela ? {
      ...tabela,
      id: duplicar ? undefined : tabela.id,
      nome: duplicar ? `${tabela.nome} (cópia)` : tabela.nome,
      padrao: duplicar ? false : tabela.padrao,
      convenioId: tabela.convenioId || "",
      itens: tabela.itens.map(i => ({ ...i })),
    } : nova());
    setModal(tabela && !duplicar ? "editar" : "novo");
    setErro("");
  }

  const alterarItem = (i, campo, valor) => setForm(f => ({
    ...f, itens: f.itens.map((item, idx) => idx === i ? { ...item, [campo]: valor } : item),
  }));

  function salvar() {
    if (!form.nome.trim()) { setErro("Informe o nome da tabela."); return; }
    if (form.itens.some(i => !String(i.cod).trim() || !i.proc.trim() || Number(i.valor) < 0)) {
      setErro("Preencha código, procedimento e valor de todos os itens."); return;
    }
    const codigos = form.itens.map(i => String(i.cod).trim());
    if (new Set(codigos).size !== codigos.length) { setErro("Não repita códigos na mesma tabela."); return; }
    const payload = {
      ...form,
      convenioId: form.tipo === "convenio" && form.convenioId ? form.convenioId : null,
      itens: form.itens.map(i => ({ cod: String(i.cod).trim(), proc: i.proc.trim(), grupo: i.grupo.trim() || "Geral", valor: Number(i.valor) || 0 })),
    };
    dispatch({ type: modal === "novo" ? "ADD_TABELA_PRECO" : "UPDATE_TABELA_PRECO", payload });
    setModal(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <span style={{ color: C.muted, fontSize: 13 }}>Modelos reutilizáveis para particulares, convênios e outras modalidades.</span>
        <div style={{ display: "flex", gap: 8 }}>
          {!state.tabelasPreco.length && (
            <Btn variant="ghost" onClick={() => abrir({
              nome: "Particular padrão", tipo: "particular", convenioId: null, ativo: true, padrao: true,
              itens: TABELA.flatMap(g => g.itens.map(i => ({ ...i, grupo: g.grupo }))),
            }, true)}>Importar tabela atual</Btn>
          )}
          <Btn onClick={() => abrir()}>+ Nova tabela</Btn>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {state.tabelasPreco.map(t => (
          <Card key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ color: C.navy }}>{t.nome}</strong>
                <Badge color={t.tipo === "convenio" ? "amber" : "teal"}>{t.tipo === "particular" ? "Particular" : t.tipo === "convenio" ? "Convênio" : "Outro"}</Badge>
                {t.padrao && <Badge color="green">PADRÃO</Badge>}
                {!t.ativo && <Badge color="red">INATIVA</Badge>}
              </div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{t.itens.length} procedimento(s)</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => abrir(t, true)}>Duplicar</Btn>
              <Btn variant="ghost" onClick={() => abrir(t)}>Editar</Btn>
              <Btn variant="danger" onClick={() => dispatch({ type: "DELETE_TABELA_PRECO", payload: t.id })}>Excluir</Btn>
            </div>
          </Card>
        ))}
        {!state.tabelasPreco.length && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhuma tabela cadastrada.</div>}
      </div>
      {modal && (
        <Modal title={modal === "novo" ? "Nova tabela de preços" : "Editar tabela de preços"} onClose={() => setModal(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            <Input label="Nome da tabela *" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Tipo" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="particular">Particular</option><option value="convenio">Convênio</option><option value="outro">Outro / personalizado</option>
              </Select>
              {form.tipo === "convenio" && <Select label="Convênio relacionado" value={form.convenioId || ""} onChange={e => setForm(f => ({ ...f, convenioId: e.target.value }))}>
                <option value="">Sem vínculo</option>{state.convenios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>}
            </div>
            <div style={{ display: "flex", gap: 18 }}>
              <label><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} /> Ativa</label>
              <label><input type="checkbox" checked={form.padrao} onChange={e => setForm(f => ({ ...f, padrao: e.target.checked }))} /> Padrão</label>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, overflowX: "auto" }}>
              {form.itens.map((item, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "80px minmax(180px,1fr) 120px 100px 34px", gap: 8, alignItems: "end", marginBottom: 8 }}>
                <Input label="Código" value={item.cod} onChange={e => alterarItem(i, "cod", e.target.value)} />
                <Input label="Procedimento" value={item.proc} onChange={e => alterarItem(i, "proc", e.target.value)} />
                <Input label="Grupo" value={item.grupo} onChange={e => alterarItem(i, "grupo", e.target.value)} />
                <Input label="Valor" type="number" min="0" step="0.01" value={item.valor} onChange={e => alterarItem(i, "valor", e.target.value)} />
                <button onClick={() => setForm(f => ({ ...f, itens: f.itens.filter((_, idx) => idx !== i) }))} style={{ height: 36, border: "none", borderRadius: 8, background: C.redLight, color: C.red }}>×</button>
              </div>)}
              <Btn variant="ghost" onClick={() => setForm(f => ({ ...f, itens: [...f.itens, { cod: "", proc: "", grupo: "Geral", valor: "" }] }))}>+ Adicionar procedimento</Btn>
            </div>
            {erro && <div style={{ background: C.redLight, color: C.red, padding: 10, borderRadius: 8 }}>{erro}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn><Btn onClick={salvar}>Salvar tabela</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OrcamentoImprimivel({ orcamento, paciente, onClose }) {
  const total = orcamento.itens.reduce((s, i) => s + i.valor, 0);
  const hoje = new Date().toLocaleDateString("pt-BR");

  function imprimir() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #area-impressao, #area-impressao * { visibility: visible; }
          #area-impressao { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .quebra-evitar { break-inside: avoid; page-break-inside: avoid; }
          .cabecalho-clinica { break-after: avoid; page-break-after: avoid; }
          #area-impressao thead { display: table-header-group; }
          #area-impressao tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
        <div style={{ background: C.white, borderRadius: 12, maxWidth: 720, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

          {/* Barra de ações — não aparece na impressão */}
          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Pré-visualização do Orçamento</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
              <Btn onClick={imprimir}>🖨 Imprimir / Salvar PDF</Btn>
            </div>
          </div>

          {/* Documento */}
          <div id="area-impressao" style={{ padding: "32px 36px", color: "#111" }}>
            <div className="cabecalho-clinica">
              <CabecalhoClinica />
            </div>

            <div className="quebra-evitar" style={{ textAlign: "center", fontSize: 16, fontWeight: 700, color: "#1B3A5C", marginBottom: 20, letterSpacing: 1 }}>
              ORÇAMENTO ODONTOLÓGICO
            </div>

            {/* Dados do paciente e orçamento */}
            <div className="quebra-evitar" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 13, marginBottom: 22, background: "#F7FAFC", borderRadius: 8, padding: 16 }}>
              <div><strong>Paciente:</strong> {paciente?.nome ?? "—"}</div>
              <div><strong>Ficha:</strong> #{String(paciente?.ficha ?? "").padStart(4, "0")}</div>
              <div><strong>CPF:</strong> {paciente?.cpf || "—"}</div>
              <div><strong>Data de nascimento:</strong> {paciente?.dataNasc || "—"}</div>
              <div><strong>Orçamento Nº:</strong> {orcamento.id}</div>
              <div><strong>Data de emissão:</strong> {orcamento.data}</div>
              <div style={{ gridColumn: "1 / -1" }}><strong>Dentista responsável:</strong> {orcamento.dentista || "—"}</div>
            </div>

            {/* Tabela de procedimentos — cabeçalho repete em cada página, linhas nunca cortadas */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
              <thead>
                <tr style={{ background: "#1B3A5C" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#fff", fontSize: 12 }}>Cód.</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#fff", fontSize: 12 }}>Procedimento</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#fff", fontSize: 12 }}>Dente(s)</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#fff", fontSize: 12 }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {orcamento.itens.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: "#555" }}>{it.cod}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13 }}>{it.proc}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: "#555" }}>{it.dentes?.join(", ") || "—"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontWeight: 600 }}>{fmt(it.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div className="quebra-evitar" style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, marginBottom: 28 }}>
              <div style={{ background: "#1B3A5C", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 16, fontWeight: 800 }}>
                TOTAL: {fmt(total)}
              </div>
            </div>

            {/* Status */}
            <div className="quebra-evitar" style={{ fontSize: 12, color: "#555", marginBottom: 28 }}>
              Status: <strong>{orcamento.status.toUpperCase()}</strong> · Documento emitido em {hoje}
            </div>

            {/* Assinaturas */}
            <div className="quebra-evitar" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 50 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: 6, fontSize: 12 }}>{paciente?.nome ?? "Paciente"}</div>
                <div style={{ fontSize: 11, color: "#777" }}>Assinatura do paciente / responsável</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: 6, fontSize: 12 }}>{orcamento.dentista || "Dentista"}</div>
                <div style={{ fontSize: 11, color: "#777" }}>Assinatura do dentista responsável</div>
              </div>
            </div>

            <div className="quebra-evitar" style={{ textAlign: "center", fontSize: 10, color: "#999", marginTop: 12 }}>
              Valores sujeitos a alteração conforme avaliação clínica. Orçamento válido por 30 dias.
            </div>

            <div className="quebra-evitar">
              <RodapeClinica />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Módulo: Impressos (documentos para impressão) ──────────────────
// Documento genérico imprimível: cabeçalho da clínica + corpo de texto livre + assinatura(s).
// Reaproveita o mesmo padrão visual e CSS de impressão usado no orçamento.
function DocumentoImprimivel({ titulo, paciente, corpo, assinaturas, onClose }) {
  const hoje = new Date().toLocaleDateString("pt-BR");

  function imprimir() { window.print(); }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #area-impressao-doc, #area-impressao-doc * { visibility: visible; }
          #area-impressao-doc { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .quebra-evitar { break-inside: avoid; page-break-inside: avoid; }
          .cabecalho-clinica { break-after: avoid; page-break-after: avoid; }
          .corpo-documento p { orphans: 3; widows: 3; }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
        <div style={{ background: C.white, borderRadius: 12, maxWidth: 720, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Pré-visualização — {titulo}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
              <Btn onClick={imprimir}>🖨 Imprimir / Salvar PDF</Btn>
            </div>
          </div>

          <div id="area-impressao-doc" style={{ padding: "36px 40px", color: "#111", minHeight: 600, display: "flex", flexDirection: "column" }}>
            <div className="cabecalho-clinica">
              <CabecalhoClinica />
            </div>

            <div className="quebra-evitar" style={{ textAlign: "center", fontSize: 22, fontWeight: 400, color: "#333", marginBottom: 28, letterSpacing: 1, fontFamily: "Georgia, serif" }}>
              {titulo}
            </div>

            {paciente && (
              <div className="quebra-evitar" style={{ fontSize: 13.5, marginBottom: 18 }}>
                <strong>Paciente</strong>: {paciente.nome}
              </div>
            )}

            {/* Corpo do documento — texto livre, preserva quebras de linha.
                Sem quebra-evitar aqui de propósito: textos longos (contrato) PRECISAM
                poder quebrar entre páginas, senão nunca caberia em uma folha só. */}
            <div className="corpo-documento" style={{ fontSize: 13.5, lineHeight: 1.9, whiteSpace: "pre-wrap", flex: 1 }}>
              {corpo}
            </div>

            {/* Assinaturas — nunca separar a linha de assinatura do nome abaixo dela */}
            {assinaturas && assinaturas.length > 0 && (
              <div className="quebra-evitar" style={{ display: "grid", gridTemplateColumns: `repeat(${assinaturas.length}, 1fr)`, gap: 40, marginTop: 60 }}>
                {assinaturas.map((a, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ borderTop: "1px solid #333", paddingTop: 6, fontSize: 12 }}>{a}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="quebra-evitar" style={{ textAlign: "right", fontSize: 12, color: "#333", marginTop: 36 }}>
              {CLINICA.cidade}, {hoje}.
            </div>

            <div className="quebra-evitar">
              <RodapeClinica />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Geradores de texto padrão para cada tipo de impresso.
// Cada função recebe { paciente, dentista, data, ...camposExtras } e devolve o corpo do texto.
// Receituário com layout estruturado: itens numerados, linha pontilhada até a
// quantidade (estilo "Amoxicilina 500MG ........... 1 CAIXA"), posologia abaixo de cada item.
function ReceituarioImprimivel({ paciente, dentista, data, medicamentos, onClose }) {
  function imprimir() { window.print(); }
  const hoje = new Date().toLocaleDateString("pt-BR");

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #area-impressao-receita, #area-impressao-receita * { visibility: visible; }
          #area-impressao-receita { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .quebra-evitar { break-inside: avoid; page-break-inside: avoid; }
          .cabecalho-clinica { break-after: avoid; page-break-after: avoid; }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
        <div style={{ background: C.white, borderRadius: 12, maxWidth: 720, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Pré-visualização — Receituário</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
              <Btn onClick={imprimir}>🖨 Imprimir / Salvar PDF</Btn>
            </div>
          </div>

          <div id="area-impressao-receita" style={{ padding: "36px 40px", color: "#111", minHeight: 600, display: "flex", flexDirection: "column" }}>
            <div className="cabecalho-clinica">
              <CabecalhoClinica />
            </div>

            <div className="quebra-evitar" style={{ textAlign: "center", fontSize: 22, fontWeight: 400, color: "#333", marginBottom: 28, letterSpacing: 1, fontFamily: "Georgia, serif" }}>
              PRESCRIÇÃO
            </div>

            <div className="quebra-evitar" style={{ fontSize: 13.5, marginBottom: 22 }}>
              <strong>Paciente</strong>: {paciente?.nome ?? "—"}
            </div>

            <div className="quebra-evitar" style={{ fontSize: 12, fontWeight: 700, textDecoration: "underline", marginBottom: 18 }}>
              USO INTERNO
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {medicamentos.map((m, i) => (
                <div key={i} className="quebra-evitar">
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 13.5 }}>
                    <span>{i + 1} - {m.nome}</span>
                    <span style={{ flex: 1, borderBottom: "1px dotted #555", position: "relative", top: -3 }} />
                    <span style={{ whiteSpace: "nowrap" }}>{m.quantidade}</span>
                  </div>
                  {m.posologia && (
                    <div style={{ fontSize: 13, marginTop: 4, marginLeft: 4 }}>- {m.posologia}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="quebra-evitar" style={{ textAlign: "right", fontSize: 12, color: "#333", marginTop: 50 }}>
              {CLINICA.cidade}, {hoje}.
            </div>

            <div className="quebra-evitar" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 50 }}>
              <div style={{ textAlign: "center", width: 280, margin: "0 auto" }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: 6, fontSize: 12 }}>Dr(a). {dentista || "____________________"}</div>
              </div>
            </div>

            <div className="quebra-evitar">
              <RodapeClinica />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Receituário usa estrutura própria (lista de medicamentos), renderizada
// diretamente no componente — ver ReceituarioImprimivel mais abaixo.

function gerarTextoAtestado({ paciente, dentista, data, dias, cid, horaInicio, horaFim }) {
  const periodo = dias && Number(dias) > 0
    ? `necessitando de afastamento de suas atividades pelo período de ${dias} dia(s), a contar de ${data}`
    : (horaInicio && horaFim
        ? `havendo comparecido a esta clínica no dia ${data}, no período das ${horaInicio} às ${horaFim}`
        : `havendo comparecido a esta clínica no dia ${data}`);

  return `Atesto, para os devidos fins, que o(a) paciente ${paciente?.nome ?? "____________________"}${paciente?.cpf ? `, portador(a) do CPF nº ${paciente.cpf}` : ""}, foi atendido(a) nesta clínica odontológica, ${periodo}.${cid ? `\n\nCID: ${cid}` : ""}

Por ser verdade, firmo o presente atestado.`;
}

function gerarTextoRecibo({ paciente, dentista, data, valor, valorExtenso, referente, formaPag }) {
  return `Recebi de ${paciente?.nome ?? "____________________"}${paciente?.cpf ? `, CPF nº ${paciente.cpf}` : ""}, a quantia de ${fmt(Number(valor) || 0)}${valorExtenso ? ` (${valorExtenso})` : ""}, referente a ${referente || "procedimento odontológico realizado nesta clínica"}.

Forma de pagamento: ${formaPag || "____________________"}
Data: ${data}

Para clareza, firmo o presente recibo.`;
}

function gerarTextoDeclaracao({ paciente, data, horaInicio, horaFim }) {
  return `Declaramos, para os devidos fins, que o(a) Sr(a). ${paciente?.nome ?? "____________________"}${paciente?.cpf ? `, portador(a) do CPF nº ${paciente.cpf}` : ""}, esteve presente nesta clínica odontológica no dia ${data}${horaInicio ? `, no período das ${horaInicio}${horaFim ? ` às ${horaFim}` : ""}` : ""}, para atendimento odontológico.

Por ser verdade, firmamos a presente declaração.`;
}

function gerarTextoContrato({ paciente, dentista, data, valorTotal, descricaoTratamento, condicoesPagamento }) {
  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS

Pelo presente instrumento particular, de um lado ${CLINICA.nome}, inscrita no CNPJ sob nº ${CLINICA.cnpj}, com sede em ${CLINICA.endereco}, doravante denominada CONTRATADA, e de outro lado ${paciente?.nome ?? "____________________"}${paciente?.cpf ? `, portador(a) do CPF nº ${paciente.cpf}` : ""}, doravante denominado(a) CONTRATANTE, têm entre si justo e contratado o seguinte:

CLÁUSULA 1ª — DO OBJETO
O presente contrato tem por objeto a prestação de serviços odontológicos pela CONTRATADA ao CONTRATANTE, compreendendo: ${descricaoTratamento || "____________________________________________"}.

CLÁUSULA 2ª — DO VALOR E FORMA DE PAGAMENTO
O valor total dos serviços é de ${fmt(Number(valorTotal) || 0)}, a ser pago da seguinte forma: ${condicoesPagamento || "____________________________________________"}.

CLÁUSULA 3ª — DAS OBRIGAÇÕES DA CONTRATADA
A CONTRATADA se compromete a prestar os serviços odontológicos com zelo, técnica adequada e em conformidade com as normas do Conselho Federal de Odontologia, utilizando materiais de qualidade.

CLÁUSULA 4ª — DAS OBRIGAÇÕES DO CONTRATANTE
O CONTRATANTE se compromete a comparecer às consultas e sessões agendadas, seguir as orientações pós-procedimento fornecidas pelo dentista responsável, e efetuar os pagamentos nas datas acordadas.

CLÁUSULA 5ª — DO CANCELAMENTO E REAGENDAMENTO
Consultas deverão ser canceladas ou reagendadas com antecedência mínima de 24 (vinte e quatro) horas, sob pena de cobrança de taxa a ser definida pela CONTRATADA em caso de ausência não justificada.

CLÁUSULA 6ª — DO FORO
Fica eleito o foro da comarca onde está situada a CONTRATADA para dirimir quaisquer dúvidas oriundas do presente contrato.

E por estarem assim justos e contratados, firmam o presente instrumento.

${CLINICA.endereco.split(",").slice(-1)[0]?.trim() || "Local"}, ${data}.`;
}

function gerarTextoTermoConsentimento({ paciente, dentista, data, procedimento }) {
  return `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO

Eu, ${paciente?.nome ?? "____________________"}${paciente?.cpf ? `, portador(a) do CPF nº ${paciente.cpf}` : ""}, declaro que fui devidamente informado(a) pelo(a) Dr(a). ${dentista || "____________________"} sobre o procedimento odontológico denominado:

${procedimento || "____________________________________________"}

Fui esclarecido(a) sobre:
— A natureza e os objetivos do procedimento;
— Os riscos, benefícios e possíveis complicações envolvidos;
— As alternativas de tratamento disponíveis;
— As consequências da não realização do procedimento;
— Os cuidados pós-operatórios necessários.

Tive a oportunidade de fazer perguntas, que foram respondidas de forma clara e satisfatória. Estou ciente de que nenhum procedimento odontológico está livre de riscos, e que os resultados podem variar conforme a resposta individual de cada paciente.

Diante do exposto, AUTORIZO a realização do procedimento descrito acima, de forma livre, consciente e esclarecida.

Data: ${data}`;
}

const MODELOS_IMPRESSO = {
  receituario: { label: "Receituário", titulo: "Receituário Odontológico", estruturado: true },
  atestado: { label: "Atestado", titulo: "Atestado Odontológico", gerar: gerarTextoAtestado, assinaturas: 1 },
  recibo: { label: "Recibo de Pagamento", titulo: "Recibo de Pagamento", gerar: gerarTextoRecibo, assinaturas: 1 },
  declaracao: { label: "Declaração de Comparecimento", titulo: "Declaração de Comparecimento", gerar: gerarTextoDeclaracao, assinaturas: 1 },
  contrato: { label: "Contrato de Prestação de Serviço", titulo: "Contrato de Prestação de Serviços", gerar: gerarTextoContrato, assinaturas: 2 },
  termo: { label: "Termo de Consentimento", titulo: "Termo de Consentimento Livre e Esclarecido", gerar: gerarTextoTermoConsentimento, assinaturas: 2 },
};

// Campos extras específicos de cada modelo de impresso — componente top-level
// (precisa estar fora de Impressos para o React não perder o foco dos inputs a cada digitação)
function CamposExtras({ modeloSel, campos, f }) {
  switch (modeloSel) {
    case "atestado":
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Dias de afastamento (opcional)" type="number" value={campos.dias || ""} onChange={f("dias")} placeholder="Ex: 2" />
            <Input label="CID (opcional)" value={campos.cid || ""} onChange={f("cid")} placeholder="Ex: K08.8" />
          </div>
          {!campos.dias && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Horário de início" type="time" value={campos.horaInicio || ""} onChange={f("horaInicio")} />
              <Input label="Horário de término" type="time" value={campos.horaFim || ""} onChange={f("horaFim")} />
            </div>
          )}
        </div>
      );
    case "recibo":
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Valor (R$) *" type="number" value={campos.valor || ""} onChange={f("valor")} />
            <Select label="Forma de pagamento" value={campos.formaPag || ""} onChange={f("formaPag")}>
              <option value="">Selecione…</option>
              {["dinheiro","pix","débito","crédito","cheque","convênio"].map(fp => <option key={fp} value={fp}>{fp}</option>)}
            </Select>
          </div>
          <Input label="Valor por extenso (opcional)" value={campos.valorExtenso || ""} onChange={f("valorExtenso")} placeholder="Ex: trezentos reais" />
          <Input label="Referente a" value={campos.referente || ""} onChange={f("referente")} placeholder="Ex: tratamento de canal — dente 26" />
        </div>
      );
    case "declaracao":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Horário de início (opcional)" type="time" value={campos.horaInicio || ""} onChange={f("horaInicio")} />
          <Input label="Horário de término (opcional)" type="time" value={campos.horaFim || ""} onChange={f("horaFim")} />
        </div>
      );
    case "contrato":
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <Input label="Valor total (R$)" type="number" value={campos.valorTotal || ""} onChange={f("valorTotal")} />
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Descrição do tratamento</label>
            <textarea rows={2} value={campos.descricaoTratamento || ""} onChange={f("descricaoTratamento")} placeholder="Ex: Tratamento ortodôntico completo com aparelho autoligado"
              style={{ width: "100%", marginTop: 6, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Condições de pagamento</label>
            <textarea rows={2} value={campos.condicoesPagamento || ""} onChange={f("condicoesPagamento")} placeholder="Ex: 3x de R$500 no cartão de crédito"
              style={{ width: "100%", marginTop: 6, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        </div>
      );
    case "termo":
      return (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Procedimento a ser realizado</label>
          <textarea rows={3} value={campos.procedimento || ""} onChange={f("procedimento")} placeholder="Ex: Extração do dente 38 (terceiro molar incluso)"
            style={{ width: "100%", marginTop: 6, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      );
    default:
      return null;
  }
}

// Editor de lista de medicamentos para o receituário — componente top-level
// (mesma razão dos outros: precisa estar fora de Impressos para inputs não perderem foco)
function EditorMedicamentos({ medicamentos, onChange }) {
  function addMed() {
    onChange([...medicamentos, { nome: "", quantidade: "", posologia: "" }]);
  }
  function remMed(i) {
    onChange(medicamentos.filter((_, idx) => idx !== i));
  }
  function setMed(i, campo, valor) {
    onChange(medicamentos.map((m, idx) => idx === i ? { ...m, [campo]: valor } : m));
  }

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Medicamentos</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {medicamentos.map((m, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 8, padding: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 32px", gap: 8 }}>
              <Input placeholder="Ex: Amoxicilina 500MG" value={m.nome} onChange={e => setMed(i, "nome", e.target.value)} />
              <Input placeholder="Ex: 1 caixa" value={m.quantidade} onChange={e => setMed(i, "quantidade", e.target.value)} />
              <button onClick={() => remMed(i)} style={{ background: C.redLight, color: C.red, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, height: 36 }}>×</button>
            </div>
            <Input placeholder="Posologia — ex: Tomar 1 comprimido por via oral de 8/8h por 7 dias" value={m.posologia} onChange={e => setMed(i, "posologia", e.target.value)} />
          </div>
        ))}
      </div>
      <Btn variant="ghost" onClick={addMed} style={{ fontSize: 12, padding: "6px 14px", marginTop: 8 }}>+ Adicionar medicamento</Btn>
    </div>
  );
}

function Impressos({ state }) {
  const [modeloSel, setModeloSel] = useState("receituario");
  const [pacSel, setPacSel] = useState("");
  const [data, setData] = useState(today());
  const [dentista, setDentista] = useState("");
  const [campos, setCampos] = useState({});
  const [medicamentos, setMedicamentos] = useState([{ nome: "", quantidade: "", posologia: "" }]);
  const [visualizando, setVisualizando] = useState(false);
  const [textoEditado, setTextoEditado] = useState(null); // permite ajustar o texto antes de imprimir

  const paciente = state.pacientes.find(p => String(p.id) === String(pacSel));
  const modelo = MODELOS_IMPRESSO[modeloSel];
  const ehReceituario = modeloSel === "receituario";

  function f(k) { return (e) => setCampos(x => ({ ...x, [k]: e.target.value })); }

  function gerarPreVisualizacao() {
    if (!ehReceituario) {
      const texto = modelo.gerar({ paciente, dentista, data, ...campos });
      setTextoEditado(texto);
    }
    setVisualizando(true);
  }

  function trocarModelo(novoModelo) {
    setModeloSel(novoModelo);
    setCampos({});
    setMedicamentos([{ nome: "", quantidade: "", posologia: "" }]);
    setTextoEditado(null);
  }

  const medicamentosValidos = medicamentos.filter(m => m.nome.trim());
  const podeGerar = pacSel && (ehReceituario ? medicamentosValidos.length > 0 : true);

  return (
    <div>
      {/* Seleção de modelo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 20 }}>
        {Object.entries(MODELOS_IMPRESSO).map(([k, v]) => (
          <button key={k} onClick={() => trocarModelo(k)} style={{
            padding: "12px 10px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left",
            border: `2px solid ${modeloSel === k ? C.teal : C.border}`,
            background: modeloSel === k ? C.tealLight : C.white,
            color: modeloSel === k ? C.teal : C.text,
          }}>{v.label}</button>
        ))}
      </div>

      <Card>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select label="Paciente *" value={pacSel} onChange={e => setPacSel(e.target.value)}>
              <option value="">Selecione…</option>
              {state.pacientes.map(p => <option key={p.id} value={p.id}>Ficha #{String(p.ficha).padStart(4,"0")} — {p.nome}</option>)}
            </Select>
            <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>

          <Select label="Dentista responsável" value={dentista} onChange={e => setDentista(e.target.value)}>
            <option value="">Selecione…</option>
            {state.dentistasCadastrados.map(d => (
              <option key={d.id} value={d.nome}>{d.nome}{d.especialidade ? ` — ${d.especialidade}` : ""}</option>
            ))}
          </Select>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            {ehReceituario
              ? <EditorMedicamentos medicamentos={medicamentos} onChange={setMedicamentos} />
              : <CamposExtras modeloSel={modeloSel} campos={campos} f={f} />
            }
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={gerarPreVisualizacao} disabled={!podeGerar}>
              🖨 Gerar e Visualizar
            </Btn>
          </div>
        </div>
      </Card>

      {visualizando && ehReceituario && (
        <ReceituarioImprimivel
          paciente={paciente}
          dentista={dentista}
          data={data}
          medicamentos={medicamentosValidos}
          onClose={() => setVisualizando(false)}
        />
      )}

      {visualizando && !ehReceituario && (
        <DocumentoImprimivel
          titulo={modelo.titulo}
          paciente={paciente}
          corpo={textoEditado}
          assinaturas={modelo.assinaturas === 2 ? [paciente?.nome || "Paciente / Contratante", dentista || "Dentista / Contratada"] : [paciente?.nome || "Paciente"]}
          onClose={() => setVisualizando(false)}
        />
      )}
    </div>
  );
}

function Orcamentos({ state, dispatch }) {
  const [modal, setModal] = useState(false);
  const [pacSel, setPacSel] = useState("");
  const [data, setData] = useState(today());
  const [dentista, setDentista] = useState("");
  const [tabelaSel, setTabelaSel] = useState("");
  const [itens, setItens] = useState([{ cod: "", proc: "", valor: "", valorEditado: "", escopo: "elemento", dentes: [] }]);
  const [busca, setBusca] = useState("");
  const [erroSalvar, setErroSalvar] = useState(false);
  const [visualizando, setVisualizando] = useState(null); // orçamento sendo visualizado/impresso

  const tabelasAtivas = state.tabelasPreco.filter(t => t.ativo);
  const tabelaPreco = state.tabelasPreco.find(t => t.id === tabelaSel);
  const catalogoPreco = tabelaPreco?.itens || [];
  const convenio = tabelaPreco?.convenioId
    ? state.convenios.find(c => String(c.id) === String(tabelaPreco.convenioId))
    : null;

  useEffect(() => {
    if (!tabelaSel && tabelasAtivas.length) {
      setTabelaSel((tabelasAtivas.find(t => t.padrao) || tabelasAtivas[0]).id);
    }
  }, [state.tabelasPreco, tabelaSel]);

  function addItem() { setItens(x => [...x, { cod: "", proc: "", valor: "", valorEditado: "", escopo: "elemento", dentes: [] }]); }
  function remItem(i) { setItens(x => x.filter((_, idx) => idx !== i)); }

  function valorParaProcedimento(cod) {
    return Number(catalogoPreco.find(t => String(t.cod) === String(cod))?.valor) || 0;
  }

  function selecionarProc(i, cod) {
    const codNormalizado = String(cod);
    const encontrado = catalogoPreco.find(t => String(t.cod) === codNormalizado);
    const valorAplicavel = valorParaProcedimento(codNormalizado);
    setItens(x => x.map((it, idx) => idx === i
      ? { ...it, cod: codNormalizado, proc: encontrado?.proc ?? "", valor: valorAplicavel, valorEditado: valorAplicavel }
      : it
    ));
  }

  function trocarTabela(novaTabelaId) {
    setTabelaSel(novaTabelaId);
    const tabela = state.tabelasPreco.find(t => t.id === novaTabelaId);
    setItens(x => x.map(it => {
      if (!it.cod) return it;
      const valorAplicavel = tabela?.itens.find(t => String(t.cod) === String(it.cod))?.valor ?? 0;
      return { ...it, valor: Number(valorAplicavel), valorEditado: Number(valorAplicavel) };
    }));
  }

  function setDentesItem(i, sel) {
    setItens(x => x.map((it, idx) => idx === i ? { ...it, escopo: sel.escopo, dentes: sel.dentes } : it));
  }

  function editarValor(i, v) {
    setItens(x => x.map((it, idx) => idx === i ? { ...it, valorEditado: v, valor: Number(v) || 0 } : it));
  }

  async function salvar() {
    const semDentes = itens.some(it => !it.dentes || it.dentes.length === 0);
    if (!pacSel || !dentista || !tabelaSel || itens.some(it => !it.cod) || semDentes) { setErroSalvar(true); return; }
    setErroSalvar(false);
    const ok = await dispatch({
      type: "ADD_ORCAMENTO",
      payload: {
        pacienteId: pacSel,
        data,
        dentista,
        convenioId: convenio ? convenio.id : null,
        convenioNome: convenio ? convenio.nome : null,
        tabelaPrecoId: tabelaPreco?.id || null,
        tabelaPrecoNome: tabelaPreco?.nome || null,
        itens: itens.map(it => {
          const qtd = it.dentes?.length || 1;
          const valorUnit = Number(it.valorEditado) || it.valor;
          return { cod: it.cod, proc: it.proc, valorUnit, valor: valorUnit * qtd, dentes: it.dentes, escopo: it.escopo };
        }),
      }
    });
    if (ok === false) return;
    setModal(false); setPacSel(""); setDentista(""); setItens([{ cod: "", proc: "", valor: "", valorEditado: "", escopo: "elemento", dentes: [] }]); setData(today());
  }

  function fecharModal() {
    setModal(false);
    setPacSel(""); setDentista(""); setItens([{ cod: "", proc: "", valor: "", valorEditado: "", escopo: "elemento", dentes: [] }]);
  }

  const total = (orc) => orc.itens.reduce((s, i) => s + i.valor, 0);
  const totalForm = itens.reduce((s, i) => {
    const qtd = i.dentes?.length || 1;
    return s + (Number(i.valorEditado) || 0) * qtd;
  }, 0);
  const getPac = (id) => state.pacientes.find(p => String(p.id) === String(id));
  const statusColor = { pendente: "amber", aprovado: "green", cancelado: "red" };

  // Filtra e ordena a lista de orçamentos
  const listaOrc = useMemo(() => {
    let lista = [...state.orcamentos];

    // Filtro por paciente selecionado
    if (pacSel) lista = lista.filter(o => String(o.pacienteId) === String(pacSel));

    // Filtro por texto (nome do paciente ou procedimento)
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(o => {
        const pac = getPac(o.pacienteId);
        return pac?.nome.toLowerCase().includes(b) || o.itens.some(i => i.proc.toLowerCase().includes(b));
      });
    }

    // Sempre ordena do mais recente para o mais antigo
    lista.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
    return lista;
  }, [state.orcamentos, busca, pacSel, state.pacientes]);

  // Agrupa por paciente quando há filtro ativo — facilita ver o histórico
  const agrupado = useMemo(() => {
    if (!pacSel && !busca.trim()) return null; // sem filtro: lista normal
    const grupos = {};
    listaOrc.forEach(orc => {
      const pac = getPac(orc.pacienteId);
      const key = pac?.id || "?";
      if (!grupos[key]) grupos[key] = { pac, orcs: [] };
      grupos[key].orcs.push(orc);
    });
    return Object.values(grupos);
  }, [listaOrc, pacSel, busca]);

  // Renderiza o card de um orçamento — extraído pra evitar duplicação entre vista normal e agrupada
  function renderOrc(orc, pac) {
    return (
      <Card key={orc.id}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>
              <Badge color="teal">Orç. #{orc.id}</Badge>{" "}
              {pac?.nome ?? "—"}
              {orc.convenioNome && <span style={{ marginLeft: 8 }}><Badge color="amber">{orc.convenioNome}</Badge></span>}
            </div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Emitido em {orc.data}{orc.dentista && <> · Dr(a). {orc.dentista}</>}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: C.teal, fontSize: 17 }}>{fmt(total(orc))}</span>
            <Badge color={statusColor[orc.status]}>{orc.status.toUpperCase()}</Badge>
            <Btn variant="ghost" onClick={() => setVisualizando(orc)}>🖨 Visualizar</Btn>
            {orc.status === "pendente" && (
              <Btn variant="green" onClick={() => dispatch({ type: "APROVAR_ORCAMENTO", payload: orc.id })}>
                ✓ Aprovar
              </Btn>
            )}
          </div>
        </div>
        <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {orc.itens.map((it, i) => {
            const qtd = it.dentes?.length || 1;
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: C.muted, marginRight: 8 }}>{it.cod}</span>
                <span style={{ flex: 1, color: C.text }}>
                  {it.proc}
                  {it.dentes && <span style={{ color: C.teal, fontSize: 11, marginLeft: 6 }}>· dente{qtd>1?"s":""} {it.dentes.join(", ")}</span>}
                  {qtd > 1 && it.valorUnit && <span style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>({fmt(it.valorUnit)} × {qtd})</span>}
                </span>
                <span style={{ fontWeight: 600, color: C.teal }}>{fmt(it.valor)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <Select label="Filtrar por paciente" value={pacSel} onChange={e => setPacSel(e.target.value)}>
            <option value="">Todos os pacientes</option>
            {state.pacientes
              .filter(p => state.orcamentos.some(o => o.pacienteId === p.id))
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map(p => <option key={p.id} value={p.id}>Ficha #{String(p.ficha).padStart(4,"0")} — {p.nome}</option>)
            }
          </Select>
        </div>
        <div style={{ flex: 2, minWidth: 180 }}>
          <Input label="Buscar procedimento" placeholder="Ex: canal, limpeza…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Btn onClick={() => { setPacSel(""); setBusca(""); }} variant="ghost">Limpar filtros</Btn>
        <Btn onClick={() => setModal(true)}>+ Novo Orçamento</Btn>
      </div>

      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
        {listaOrc.length} orçamento(s) encontrado(s), ordenados do mais recente para o mais antigo.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {listaOrc.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum orçamento encontrado.</div>}

        {/* Vista agrupada por paciente (quando há filtro ativo) */}
        {agrupado ? agrupado.map(({ pac, orcs }) => (
          <div key={pac?.id}>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, padding: "6px 0", marginBottom: 6, borderBottom: `2px solid ${C.teal}` }}>
              👤 {pac?.nome} — {orcs.length} orçamento(s)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orcs.map(orc => renderOrc(orc, pac))}
            </div>
          </div>
        )) : listaOrc.map(orc => renderOrc(orc, getPac(orc.pacienteId)))}
      </div>

      {modal && (
        <Modal title="Novo Orçamento" onClose={fecharModal}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Paciente *" value={pacSel} onChange={e => { setPacSel(e.target.value); setErroSalvar(false); }} style={erroSalvar && !pacSel ? { borderColor: C.red } : {}}>
                <option value="">Selecione…</option>
                {state.pacientes.map(p => <option key={p.id} value={p.id}>Ficha #{String(p.ficha).padStart(4,"0")} — {p.nome}</option>)}
              </Select>
              <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>

            <Select label="Dentista responsável *" value={dentista} onChange={e => { setDentista(e.target.value); setErroSalvar(false); }} style={erroSalvar && !dentista ? { borderColor: C.red } : {}}>
              <option value="">Selecione o dentista…</option>
              {state.dentistasCadastrados.map(d => (
                <option key={d.id} value={d.nome}>{d.nome}{d.especialidade ? ` — ${d.especialidade}` : ""}</option>
              ))}
            </Select>

            <Select label="Tabela de preços *" value={tabelaSel} onChange={e => trocarTabela(e.target.value)}>
              <option value="">Selecione uma tabela…</option>
              {tabelasAtivas.map(t => (
                <option key={t.id} value={t.id}>{t.nome} — {t.tipo === "particular" ? "Particular" : t.tipo === "convenio" ? "Convênio" : "Outro"}</option>
              ))}
            </Select>
            {tabelaPreco && (
              <div style={{ background: C.tealLight, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.teal }}>
                Os procedimentos e valores abaixo vêm da tabela <strong>{tabelaPreco.nome}</strong>. O valor pode ser ajustado neste orçamento sem alterar o modelo.
              </div>
            )}

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 12 }}>PROCEDIMENTOS</div>

              {itens.map((it, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 36px", gap: 8, alignItems: "end", marginBottom: 10 }}>
                    <ProcSearch
                      label={`Procedimento ${i + 1} *`}
                      value={it.cod}
                      onSelect={(cod) => selecionarProc(i, cod)}
                      hasError={erroSalvar && !it.cod}
                      catalogo={catalogoPreco}
                    />
                    <button
                      onClick={() => remItem(i)}
                      style={{ background: C.redLight, color: C.red, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 18, height: 36, width: 36 }}
                    >×</button>
                  </div>

                  {/* Seletor de dente(s) / hemiarco / arco para este procedimento */}
                  <div style={{ marginBottom: 10, background: C.white, borderRadius: 8, padding: "10px 10px", border: `1.5px solid ${erroSalvar && it.dentes.length === 0 ? C.red : "transparent"}` }}>
                    <SeletorDentes
                      value={{ escopo: it.escopo, dentes: it.dentes }}
                      onChange={(sel) => setDentesItem(i, sel)}
                    />
                    {erroSalvar && it.dentes.length === 0 && (
                      <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>⚠ Selecione ao menos um dente para este procedimento</div>
                    )}
                  </div>

                  {it.cod && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>
                          Valor tabela (unitário): <strong>{fmt(catalogoPreco.find(p => String(p.cod) === String(it.cod))?.valor || 0)}</strong>
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <label style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>Valor unitário cobrado (R$):</label>
                          <input
                            type="number"
                            value={it.valorEditado}
                            onChange={e => editarValor(i, e.target.value)}
                            style={{ width: 100, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 14, fontWeight: 700, color: C.teal }}
                          />
                        </div>
                      </div>
                      {it.dentes && it.dentes.length > 1 && (
                        <div style={{ marginTop: 8, background: C.tealLight, borderRadius: 6, padding: "6px 10px", fontSize: 12, color: C.teal, display: "flex", justifyContent: "space-between" }}>
                          <span>{fmt(Number(it.valorEditado) || 0)} × {it.dentes.length} dentes</span>
                          <strong>{fmt((Number(it.valorEditado) || 0) * it.dentes.length)}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <Btn variant="ghost" onClick={addItem} style={{ fontSize: 12, padding: "6px 14px" }}>
                + Adicionar procedimento
              </Btn>
            </div>

            {/* Total */}
            <div style={{ background: C.navy, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#A0C4D5", fontSize: 13, fontWeight: 600 }}>TOTAL DO ORÇAMENTO</span>
              <span style={{ color: C.white, fontSize: 22, fontWeight: 800 }}>{fmt(totalForm)}</span>
            </div>

            {erroSalvar && (
              <div style={{ background: C.redLight, color: C.red, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                Selecione o paciente, a tabela de preços, o dentista responsável, o procedimento e ao menos um dente para cada item antes de salvar.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={fecharModal}>Cancelar</Btn>
              <Btn onClick={salvar}>Salvar Orçamento</Btn>
            </div>
          </div>
        </Modal>
      )}

      {visualizando && (
        <OrcamentoImprimivel
          orcamento={visualizando}
          paciente={getPac(visualizando.pacienteId)}
          onClose={() => setVisualizando(null)}
        />
      )}
    </div>
  );
}

// ── Módulo: Baixa de Procedimentos ────────────────────────────────
// Baixa = procedimento foi REALIZADO pelo dentista. O pagamento é lançado
// separadamente na aba Pagamentos, podendo ser parcial, parcelado ou avulso.
function Baixas({ state, dispatch }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ proc: "", valor: "", data: today(), dentista: "" });
  const [erroSalvar, setErroSalvar] = useState(false);

  const orcAprovados = state.orcamentos.filter(o => o.status === "aprovado");
  const getPac = (id) => state.pacientes.find(p => p.id === id);

  function abrirBaixa(orc, item, idx) {
    setModal({ orc, item, idx });
    setForm({ proc: item.proc, valor: item.valor, data: today(), dentista: orc.dentista || "" });
    setErroSalvar(false);
  }

  function confirmar() {
    if (!form.dentista) { setErroSalvar(true); return; }
    const pac = getPac(modal.orc.pacienteId);
    dispatch({
      type: "ADD_BAIXA",
      payload: {
        orcamentoId: modal.orc.id,
        pacienteId: modal.orc.pacienteId,
        itemIdx: modal.idx,
        proc: form.proc,
        cod: modal.item.cod,
        valor: Number(form.valor),
        data: form.data,
        dentista: form.dentista,
        convenioId: modal.orc.convenioId || null,
        convenioNome: modal.orc.convenioNome || null,
        descricao: `${form.proc} - ${pac?.nome}`,
      }
    });
    setModal(null);
  }

  const jaLancado = (orcId, proc, idx) => state.baixas.some(b => b.orcamentoId === orcId && b.proc === proc && b.itemIdx === idx);
  const baixaDoItem = (orcId, proc, idx) => state.baixas.find(b => b.orcamentoId === orcId && b.proc === proc && b.itemIdx === idx);
  const temPagamentoVinculado = (baixaId) => state.pagamentos.some(p => p.baixaId === baixaId);

  function excluirBaixa(baixa) {
    if (temPagamentoVinculado(baixa.id)) return; // trava: UI nem deveria chegar aqui, mas protege
    dispatch({ type: "DELETE_BAIXA", payload: baixa.id });
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {orcAprovados.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>Nenhum orçamento aprovado para baixar.<br /><span style={{ fontSize: 12 }}>Aprove um orçamento no módulo de Orçamentos.</span></div>
        )}
        {orcAprovados.map(orc => {
          const pac = getPac(orc.pacienteId);
          const totalOrc = orc.itens.reduce((s, i) => s + i.valor, 0);
          const totalRealizado = orc.itens.reduce((s, it, idx) => s + (jaLancado(orc.id, it.proc, idx) ? it.valor : 0), 0);
          const completo = totalRealizado >= totalOrc;
          return (
            <Card key={orc.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.navy }}>
                    <Badge color="teal">Orç. #{orc.id}</Badge>{" "}{pac?.nome}
                    {orc.convenioNome && <span style={{ marginLeft: 8 }}><Badge color="amber">{orc.convenioNome}</Badge></span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{orc.data}{orc.dentista && <> · Orçado por Dr(a). {orc.dentista}</>}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: C.muted }}>Realizado: <strong style={{ color: C.teal }}>{fmt(totalRealizado)}</strong> / {fmt(totalOrc)}</div>
                  {completo && <Badge color="teal">TODOS REALIZADOS</Badge>}
                </div>
              </div>
              {orc.itens.map((it, i) => {
                const feito = jaLancado(orc.id, it.proc, i);
                const baixa = feito ? baixaDoItem(orc.id, it.proc, i) : null;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      {it.cod && <span style={{ color: C.muted, fontSize: 12, marginRight: 8 }}>{it.cod}</span>}
                      <span style={{ fontSize: 14, color: feito ? C.muted : C.text, textDecoration: feito ? "line-through" : "none" }}>{it.proc}</span>
                      <span style={{ color: C.teal, marginLeft: 10, fontWeight: 600 }}>{fmt(it.valor)}</span>
                      {baixa?.dentista && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Realizado por Dr(a). {baixa.dentista} em {baixa.data}</div>}
                    </div>
                    {feito
                      ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Badge color="teal">REALIZADO</Badge>
                          {temPagamentoVinculado(baixa.id) ? (
                            <span title="Não é possível excluir: já existe pagamento vinculado a este procedimento" style={{ fontSize: 11, color: C.muted, cursor: "not-allowed" }}>
                              🔒
                            </span>
                          ) : (
                            <button onClick={() => excluirBaixa(baixa)} style={{ background: C.redLight, color: C.red, border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer", fontSize: 13 }}>×</button>
                          )}
                        </div>
                      )
                      : <Btn variant="amber" onClick={() => abrirBaixa(orc, it, i)}>Dar Baixa</Btn>
                    }
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>

      {modal && (
        <Modal title="Confirmar Procedimento Realizado" onClose={() => setModal(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.tealLight, borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: C.teal }}>{modal.item.proc}</div>
              <div style={{ color: C.muted, fontSize: 13 }}>Paciente: {getPac(modal.orc.pacienteId)?.nome}</div>
              <div style={{ color: C.muted, fontSize: 13 }}>Valor: {fmt(modal.item.valor)}</div>
            </div>
            <Input label="Data da realização" type="date" value={form.data} onChange={e => setForm(x => ({ ...x, data: e.target.value }))} />
            <Select
              label="Dentista que realizou o procedimento *"
              value={form.dentista}
              onChange={e => { setForm(x => ({ ...x, dentista: e.target.value })); setErroSalvar(false); }}
              style={erroSalvar && !form.dentista ? { borderColor: C.red } : {}}
            >
              <option value="">Selecione o dentista…</option>
              {state.dentistasCadastrados.map(d => (
                <option key={d.id} value={d.nome}>{d.nome}{d.especialidade ? ` — ${d.especialidade}` : ""}</option>
              ))}
            </Select>
            {erroSalvar && !form.dentista && (
              <div style={{ color: C.red, fontSize: 12 }}>⚠ Selecione o dentista responsável pelo procedimento.</div>
            )}
            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              Isto apenas registra que o procedimento foi realizado. O pagamento é lançado separadamente na aba Pagamentos.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn variant="green" onClick={confirmar}>Confirmar Realização</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Pagamentos ─────────────────────────────────────────────
// Aqui o paciente paga o que deve. Pode ser vinculado a um procedimento
// específico (uma baixa) ou ser um valor avulso que abate do saldo geral.

// Calcula, para um paciente, total realizado (baixas) e total pago (pagamentos)
function calcularSaldoPaciente(state, pacienteId) {
  const totalRealizado = state.baixas
    .filter(b => b.pacienteId === pacienteId)
    .reduce((s, b) => s + b.valor, 0);
  // Pagamentos "internos" (vínculo de crédito) não somam dinheiro novo — o valor já
  // havia entrado como pagamento avulso antes. Contá-los de novo duplicaria o total pago.
  const totalPago = state.pagamentos
    .filter(p => p.pacienteId === pacienteId && !p.interno)
    .reduce((s, p) => s + p.valor, 0);
  return { totalRealizado, totalPago, saldo: totalRealizado - totalPago };
}

function Pagamentos({ state, dispatch }) {
  const [pacSel, setPacSel] = useState("");
  const [modal, setModal] = useState(false);
  const [tipo, setTipo] = useState("avulso"); // "avulso" | "procedimento"
  const [baixaSel, setBaixaSel] = useState("");
  const [form, setForm] = useState({ valor: "", data: today(), forma: "dinheiro", obs: "" });
  const [modalCredito, setModalCredito] = useState(false);
  const [creditoBaixaSel, setCreditoBaixaSel] = useState("");
  const [creditoValor, setCreditoValor] = useState("");

  const formas = ["dinheiro", "pix", "débito", "crédito", "cheque", "convênio"];

  const pacientesComSaldo = useMemo(() => {
    return state.pacientes.map(p => ({ ...p, ...calcularSaldoPaciente(state, p.id) }))
      .filter(p => p.totalRealizado > 0); // só mostra quem já tem algo realizado
  }, [state.pacientes, state.baixas, state.pagamentos]);

  const paciente = state.pacientes.find(p => String(p.id) === String(pacSel));
  const saldoInfo = pacSel ? calcularSaldoPaciente(state, pacSel) : null;
  const credito = saldoInfo && saldoInfo.saldo < 0 ? Math.abs(saldoInfo.saldo) : 0;

  // Baixas (procedimentos realizados) deste paciente, com quanto já foi pago de cada uma
  const baixasDoPaciente = useMemo(() => {
    if (!pacSel) return [];
    return state.baixas
      .filter(b => String(b.pacienteId) === String(pacSel))
      .map(b => {
        const pagoNela = state.pagamentos
          .filter(p => p.baixaId === b.id)
          .reduce((s, p) => s + p.valor, 0);
        return { ...b, pago: pagoNela, restante: b.valor - pagoNela };
      });
  }, [pacSel, state.baixas, state.pagamentos]);

  const historicoPagamentos = useMemo(() => {
    if (!pacSel) return [];
    return state.pagamentos.filter(p => String(p.pacienteId) === String(pacSel)).sort((a,b) => b.data.localeCompare(a.data));
  }, [pacSel, state.pagamentos]);

  function abrirNovoPagamento() {
    setTipo("avulso");
    setBaixaSel("");
    setForm({ valor: "", data: today(), forma: "dinheiro", obs: "" });
    setModal(true);
  }

  function selecionarProcedimento(baixaId) {
    setBaixaSel(baixaId);
    const b = baixasDoPaciente.find(x => x.id === Number(baixaId));
    if (b) setForm(x => ({ ...x, valor: b.restante > 0 ? b.restante : b.valor }));
  }

  function confirmarPagamento() {
    if (!pacSel || !form.valor || Number(form.valor) <= 0) return;
    const b = tipo === "procedimento" ? baixasDoPaciente.find(x => x.id === Number(baixaSel)) : null;
    dispatch({
      type: "ADD_PAGAMENTO",
      payload: {
        pacienteId: pacSel,
        data: form.data,
        valor: Number(form.valor),
        forma: form.forma,
        baixaId: b ? b.id : null,
        obs: form.obs,
        descricao: b ? `Pagamento - ${b.proc} - ${paciente?.nome}` : `Pagamento avulso - ${paciente?.nome}`,
      }
    });
    setModal(false);
  }

  function abrirVincularCredito() {
    setCreditoBaixaSel("");
    setCreditoValor("");
    setModalCredito(true);
  }

  function selecionarBaixaCredito(baixaId) {
    setCreditoBaixaSel(baixaId);
    const b = baixasDoPaciente.find(x => x.id === Number(baixaId));
    if (b) {
      const sugestao = Math.min(b.restante, credito);
      setCreditoValor(sugestao > 0 ? sugestao : "");
    }
  }

  function confirmarVinculoCredito() {
    const valor = Number(creditoValor);
    if (!creditoBaixaSel || !valor || valor <= 0 || valor > credito) return;
    dispatch({
      type: "VINCULAR_CREDITO",
      payload: {
        pacienteId: pacSel,
        baixaId: Number(creditoBaixaSel),
        valor,
      }
    });
    setModalCredito(false);
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Select label="Selecione o paciente" value={pacSel} onChange={e => setPacSel(e.target.value)}>
          <option value="">Escolha um paciente…</option>
          {state.pacientes.map(p => (
            <option key={p.id} value={p.id}>Ficha #{String(p.ficha).padStart(4,"0")} — {p.nome}</option>
          ))}
        </Select>
      </Card>

      {!pacSel && (
        <>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>PACIENTES COM SALDO DEVEDOR</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pacientesComSaldo.filter(p => p.saldo > 0).length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum paciente com saldo em aberto.</div>
            )}
            {pacientesComSaldo.filter(p => p.saldo > 0).sort((a,b) => b.saldo - a.saldo).map(p => (
              <Card key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setPacSel(String(p.id))}>
                <div>
                  <div style={{ fontWeight: 700, color: C.navy }}>{p.nome}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Ficha #{String(p.ficha).padStart(4,"0")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Saldo devedor</div>
                  <div style={{ fontWeight: 800, color: C.red, fontSize: 16 }}>{fmt(p.saldo)}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {pacSel && saldoInfo && (
        <>
          {/* Resumo do saldo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
            <div style={{ background: C.tealLight, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase" }}>Total Realizado</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.teal, marginTop: 4 }}>{fmt(saldoInfo.totalRealizado)}</div>
            </div>
            <div style={{ background: C.greenLight, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase" }}>Total Pago</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.green, marginTop: 4 }}>{fmt(saldoInfo.totalPago)}</div>
            </div>
            <div style={{ background: saldoInfo.saldo > 0 ? C.redLight : C.greenLight, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: saldoInfo.saldo > 0 ? C.red : C.green, textTransform: "uppercase" }}>
                {saldoInfo.saldo > 0 ? "Saldo Devedor" : saldoInfo.saldo < 0 ? "Crédito do Paciente" : "Quitado"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: saldoInfo.saldo > 0 ? C.red : C.green, marginTop: 4 }}>
                {fmt(Math.abs(saldoInfo.saldo))}
              </div>
            </div>
          </div>

          {/* Aviso de crédito disponível para vincular a um procedimento */}
          {credito > 0 && (
            <Card style={{ background: C.greenLight, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: C.green, fontSize: 13 }}>💰 Paciente tem crédito de {fmt(credito)}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Esse valor pode ser usado para quitar um procedimento já realizado.</div>
              </div>
              <Btn
                variant="green"
                onClick={abrirVincularCredito}
                disabled={baixasDoPaciente.every(b => b.restante <= 0)}
              >
                Vincular crédito a procedimento
              </Btn>
            </Card>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Btn variant="ghost" onClick={() => setPacSel("")}>← Voltar</Btn>
            <Btn onClick={abrirNovoPagamento} disabled={baixasDoPaciente.length === 0}>+ Lançar Pagamento</Btn>
          </div>

          {/* Procedimentos realizados deste paciente e quanto falta pagar */}
          {baixasDoPaciente.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>PROCEDIMENTOS REALIZADOS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {baixasDoPaciente.map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <span style={{ color: C.text }}>{b.proc}</span>
                      <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>{b.data} · Dr(a). {b.dentista}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: C.muted, fontSize: 11 }}>{fmt(b.pago)} / {fmt(b.valor)}</span>
                      {b.restante > 0
                        ? <Badge color="red">FALTA {fmt(b.restante)}</Badge>
                        : <Badge color="green">QUITADO</Badge>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Histórico de pagamentos */}
          <Card>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>HISTÓRICO DE PAGAMENTOS</div>
            {historicoPagamentos.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: 20, fontSize: 13 }}>Nenhum pagamento lançado ainda.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {historicoPagamentos.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <span style={{ color: C.text }}>
                      {p.interno ? "🔄 Crédito vinculado" : p.baixaId ? "Vinculado a procedimento" : "Pagamento avulso"}
                    </span>
                    <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>{p.data} · {p.forma}</span>
                    {p.obs && <div style={{ color: C.muted, fontSize: 11, fontStyle: "italic" }}>{p.obs}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: C.green }}>{fmt(p.valor)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Modal de novo pagamento */}
      {modal && (
        <Modal title="Lançar Pagamento" onClose={() => setModal(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.tealLight, borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, color: C.teal }}>{paciente?.nome}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Saldo devedor atual: {fmt(saldoInfo?.saldo > 0 ? saldoInfo.saldo : 0)}</div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              {[
                { k: "avulso", label: "Pagamento avulso" },
                { k: "procedimento", label: "Vincular a procedimento" },
              ].map(opt => (
                <button key={opt.k} onClick={() => { setTipo(opt.k); setBaixaSel(""); setForm(x => ({ ...x, valor: "" })); }} style={{
                  flex: 1, padding: "9px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: `2px solid ${tipo === opt.k ? C.teal : C.border}`,
                  background: tipo === opt.k ? C.tealLight : C.white,
                  color: tipo === opt.k ? C.teal : C.muted,
                }}>{opt.label}</button>
              ))}
            </div>

            {tipo === "procedimento" && (
              <Select label="Procedimento *" value={baixaSel} onChange={e => selecionarProcedimento(e.target.value)}>
                <option value="">Selecione…</option>
                {baixasDoPaciente.filter(b => b.restante > 0).map(b => (
                  <option key={b.id} value={b.id}>{b.proc} — falta {fmt(b.restante)}</option>
                ))}
              </Select>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Valor pago (R$) *" type="number" value={form.valor} onChange={e => setForm(x => ({ ...x, valor: e.target.value }))} />
              <Input label="Data" type="date" value={form.data} onChange={e => setForm(x => ({ ...x, data: e.target.value }))} />
            </div>

            <Select label="Forma de pagamento" value={form.forma} onChange={e => setForm(x => ({ ...x, forma: e.target.value }))}>
              {formas.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </Select>

            <Input label="Observações" value={form.obs} onChange={e => setForm(x => ({ ...x, obs: e.target.value }))} placeholder="Opcional — ex: parcela 1 de 3" />

            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              Este pagamento será lançado automaticamente como entrada no Caixa.
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn variant="green" onClick={confirmarPagamento}>Confirmar Pagamento</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de vincular crédito existente a um procedimento */}
      {modalCredito && (
        <Modal title="Vincular Crédito a Procedimento" onClose={() => setModalCredito(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.greenLight, borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, color: C.green }}>{paciente?.nome}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Crédito disponível: {fmt(credito)}</div>
            </div>

            <Select label="Procedimento em aberto *" value={creditoBaixaSel} onChange={e => selecionarBaixaCredito(e.target.value)}>
              <option value="">Selecione…</option>
              {baixasDoPaciente.filter(b => b.restante > 0).map(b => (
                <option key={b.id} value={b.id}>{b.proc} — falta {fmt(b.restante)}</option>
              ))}
            </Select>

            <Input
              label="Valor a vincular (R$)"
              type="number"
              value={creditoValor}
              onChange={e => setCreditoValor(e.target.value)}
            />
            {Number(creditoValor) > credito && (
              <div style={{ color: C.red, fontSize: 12 }}>⚠ Valor maior que o crédito disponível ({fmt(credito)}).</div>
            )}

            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              Isso não gera novo lançamento no Caixa — o dinheiro já entrou antes. Apenas reatribui o crédito existente a este procedimento.
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModalCredito(false)}>Cancelar</Btn>
              <Btn
                variant="green"
                onClick={confirmarVinculoCredito}
                disabled={!creditoBaixaSel || !creditoValor || Number(creditoValor) <= 0 || Number(creditoValor) > credito}
              >
                Confirmar Vínculo
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Convênios a Receber ────────────────────────────────────
// Procedimentos de convênio não geram pagamento direto do paciente — o
// convênio paga depois, em lote, podendo recusar (glosar) itens específicos.

function ConvenioReceberInfo(state, convenioId) {
  // Baixas deste convênio que ainda não foram incluídas em nenhum recebimento e não estão glosadas
  const baixasConv = state.baixas.filter(b => b.convenioId === convenioId);
  const baixaIdsJaRecebidos = new Set(
    state.recebimentosConvenio
      .filter(r => r.convenioId === convenioId)
      .flatMap(r => r.baixaIds || [])
  );
  const pendentes = baixasConv.filter(b => !baixaIdsJaRecebidos.has(b.id) && !b.glosado);
  const glosadas = baixasConv.filter(b => b.glosado);
  const totalPendente = pendentes.reduce((s, b) => s + b.valor, 0);
  const totalRecebido = state.recebimentosConvenio.filter(r => r.convenioId === convenioId).reduce((s, r) => s + r.valor, 0);
  return { baixasConv, pendentes, glosadas, totalPendente, totalRecebido };
}

function ConveniosReceber({ state, dispatch }) {
  const [convenioSel, setConvenioSel] = useState("");
  const [selecionados, setSelecionados] = useState([]); // baixaIds marcados para o lote
  const [modalLote, setModalLote] = useState(false);
  const [formLote, setFormLote] = useState({ data: today(), descricao: "" });
  const [modalGlosa, setModalGlosa] = useState(null); // baixa sendo glosada
  const [motivoGlosa, setMotivoGlosa] = useState("");

  const convenio = state.convenios.find(c => c.id === Number(convenioSel));
  const info = convenioSel ? ConvenioReceberInfo(state, Number(convenioSel)) : null;

  const getPac = (id) => state.pacientes.find(p => p.id === id);

  // Resumo por convênio, para a lista inicial
  const resumoConvenios = useMemo(() => {
    return state.convenios.map(c => {
      const i = ConvenioReceberInfo(state, c.id);
      return { ...c, ...i };
    });
  }, [state.convenios, state.baixas, state.recebimentosConvenio]);

  function toggleSelecionado(id) {
    setSelecionados(x => x.includes(id) ? x.filter(i => i !== id) : [...x, id]);
  }

  function selecionarTodos() {
    setSelecionados(info.pendentes.map(b => b.id));
  }
  function limparSelecao() { setSelecionados([]); }

  const totalLote = info ? info.pendentes.filter(b => selecionados.includes(b.id)).reduce((s, b) => s + b.valor, 0) : 0;

  function abrirConfirmarLote() {
    if (selecionados.length === 0) return;
    setFormLote({ data: today(), descricao: `Recebimento ${convenio.nome} — ${selecionados.length} procedimento(s)` });
    setModalLote(true);
  }

  function confirmarLote() {
    dispatch({
      type: "ADD_RECEBIMENTO_CONVENIO",
      payload: {
        convenioId: convenio.id,
        data: formLote.data,
        valor: totalLote,
        descricao: formLote.descricao,
        baixaIds: [...selecionados],
        obs: "",
      }
    });
    setSelecionados([]);
    setModalLote(false);
  }

  function abrirGlosa(baixa) {
    setModalGlosa(baixa);
    setMotivoGlosa("");
  }
  function confirmarGlosa() {
    dispatch({ type: "MARCAR_GLOSA", payload: { baixaId: modalGlosa.id, motivo: motivoGlosa } });
    setModalGlosa(null);
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Select label="Selecione o convênio" value={convenioSel} onChange={e => { setConvenioSel(e.target.value); setSelecionados([]); }}>
          <option value="">Escolha um convênio…</option>
          {state.convenios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
      </Card>

      {!convenioSel && (
        <>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>RESUMO POR CONVÊNIO</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resumoConvenios.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum convênio cadastrado ainda.</div>
            )}
            {resumoConvenios.map(c => (
              <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setConvenioSel(String(c.id))}>
                <div>
                  <div style={{ fontWeight: 700, color: C.navy }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{c.pendentes.length} procedimento(s) pendente(s) de envio/recebimento</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>A receber</div>
                  <div style={{ fontWeight: 800, color: c.totalPendente > 0 ? C.amber : C.green, fontSize: 16 }}>{fmt(c.totalPendente)}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {convenioSel && info && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
            <div style={{ background: C.amberLight, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase" }}>A receber</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.amber, marginTop: 4 }}>{fmt(info.totalPendente)}</div>
            </div>
            <div style={{ background: C.greenLight, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase" }}>Já recebido</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.green, marginTop: 4 }}>{fmt(info.totalRecebido)}</div>
            </div>
            <div style={{ background: C.redLight, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase" }}>Glosados</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.red, marginTop: 4 }}>{info.glosadas.length}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Btn variant="ghost" onClick={() => setConvenioSel("")}>← Voltar</Btn>
            <div style={{ display: "flex", gap: 8 }}>
              {selecionados.length > 0 && <Btn variant="ghost" onClick={limparSelecao}>Limpar seleção</Btn>}
              {info.pendentes.length > 0 && <Btn variant="ghost" onClick={selecionarTodos}>Selecionar todos</Btn>}
            </div>
          </div>

          {/* Procedimentos pendentes */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>
              PROCEDIMENTOS PENDENTES DE RECEBIMENTO
              <span style={{ color: C.muted, fontWeight: 400, fontSize: 12, marginLeft: 8 }}>({info.pendentes.length})</span>
            </div>
            {info.pendentes.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Nenhum procedimento pendente para este convênio.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {info.pendentes.map(b => (
                  <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selecionados.includes(b.id)}
                      onChange={() => toggleSelecionado(b.id)}
                      style={{ width: 16, height: 16, accentColor: C.teal }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, color: C.text }}>{b.proc}</span>
                      <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>
                        {b.data} · {getPac(b.pacienteId)?.nome} · Dr(a). {b.dentista}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: C.teal, fontSize: 13 }}>{fmt(b.valor)}</span>
                    <button onClick={(e) => { e.preventDefault(); abrirGlosa(b); }} style={{
                      background: C.redLight, color: C.red, border: "none", borderRadius: 6,
                      padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
                    }}>Glosar</button>
                  </label>
                ))}
              </div>
            )}
          </Card>

          {/* Glosados */}
          {info.glosadas.length > 0 && (
            <Card style={{ marginBottom: 14, background: C.redLight }}>
              <div style={{ fontWeight: 700, color: C.red, fontSize: 13, marginBottom: 10 }}>
                ⚠ PROCEDIMENTOS GLOSADOS (recusados pelo convênio)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {info.glosadas.map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0" }}>
                    <div>
                      <span style={{ color: C.text }}>{b.proc}</span>
                      <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>{getPac(b.pacienteId)?.nome}</span>
                      {b.motivoGlosa && <div style={{ color: C.red, fontSize: 11, fontStyle: "italic" }}>Motivo: {b.motivoGlosa}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: C.red, fontWeight: 700 }}>{fmt(b.valor)}</span>
                      <button onClick={() => dispatch({ type: "DESFAZER_GLOSA", payload: b.id })} style={{
                        background: "none", border: `1px solid ${C.red}`, color: C.red, borderRadius: 6,
                        padding: "3px 10px", fontSize: 11, cursor: "pointer",
                      }}>Reapresentar</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Total do lote selecionado */}
          {selecionados.length > 0 && (
            <>
              <div style={{ background: C.navy, borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ color: "#A0C4D5", fontSize: 12, fontWeight: 600 }}>TOTAL DO LOTE SELECIONADO</div>
                  <div style={{ color: C.white, fontSize: 11, marginTop: 2 }}>{selecionados.length} procedimento(s)</div>
                </div>
                <span style={{ color: C.white, fontSize: 26, fontWeight: 800 }}>{fmt(totalLote)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn onClick={abrirConfirmarLote}>Registrar Recebimento do Lote →</Btn>
              </div>
            </>
          )}

          {/* Histórico de recebimentos */}
          <Card style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>HISTÓRICO DE RECEBIMENTOS</div>
            {state.recebimentosConvenio.filter(r => r.convenioId === convenio.id).length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Nenhum recebimento registrado ainda.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {state.recebimentosConvenio
                  .filter(r => r.convenioId === convenio.id)
                  .sort((a, b) => b.data.localeCompare(a.data))
                  .map(r => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <span style={{ color: C.text }}>{r.descricao}</span>
                        <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>{r.data} · {(r.baixaIds || []).length} procedimento(s)</span>
                      </div>
                      <span style={{ fontWeight: 700, color: C.green }}>{fmt(r.valor)}</span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal de confirmação do lote */}
      {modalLote && (
        <Modal title="Confirmar Recebimento do Lote" onClose={() => setModalLote(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.tealLight, borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: C.teal }}>{convenio.nome}</div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{selecionados.length} procedimento(s) · {fmt(totalLote)}</div>
            </div>
            <Input label="Descrição" value={formLote.descricao} onChange={e => setFormLote(x => ({ ...x, descricao: e.target.value }))} />
            <Input label="Data do recebimento" type="date" value={formLote.data} onChange={e => setFormLote(x => ({ ...x, data: e.target.value }))} />
            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              Isso vai lançar uma entrada de {fmt(totalLote)} no Caixa, forma "convênio".
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModalLote(false)}>Cancelar</Btn>
              <Btn variant="green" onClick={confirmarLote}>Confirmar Recebimento</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de glosa */}
      {modalGlosa && (
        <Modal title="Marcar como Glosado" onClose={() => setModalGlosa(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.redLight, borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: C.red }}>{modalGlosa.proc}</div>
              <div style={{ color: C.muted, fontSize: 13 }}>{getPac(modalGlosa.pacienteId)?.nome} · {fmt(modalGlosa.valor)}</div>
            </div>
            <Input label="Motivo da glosa (opcional)" value={motivoGlosa} onChange={e => setMotivoGlosa(e.target.value)} placeholder="Ex: documentação incompleta, fora de cobertura…" />
            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              O procedimento sai da lista de pendentes e fica marcado como glosado. Você pode reapresentá-lo depois, se for o caso.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModalGlosa(null)}>Cancelar</Btn>
              <Btn variant="danger" onClick={confirmarGlosa}>Confirmar Glosa</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Inadimplência ──────────────────────────────────────────
// Relatório consolidado de todos os pacientes com saldo devedor,
// com informações de tempo de débito e acesso rápido para registrar pagamento.

function Inadimplencia({ state, dispatch }) {
  const [ordenar, setOrdenar] = useState("valor"); // "valor" | "tempo"
  const [filtroMinimo, setFiltroMinimo] = useState("");
  const [filtroDias, setFiltroDias] = useState(""); // mínimo de dias em aberto
  const [modalPag, setModalPag] = useState(null); // paciente selecionado p/ pagamento rápido
  const [formPag, setFormPag] = useState({ valor: "", data: today(), forma: "dinheiro", obs: "" });

  const formas = ["dinheiro", "pix", "débito", "crédito", "cheque"];

  // Calcula inadimplência por paciente
  const devedores = useMemo(() => {
    return state.pacientes
      .map(p => {
        const { totalRealizado, totalPago, saldo } = calcularSaldoPaciente(state, p.id);
        if (saldo <= 0) return null;

        // Baixas não pagas — usamos para calcular a data do débito mais antigo
        const baixasPac = state.baixas
          .filter(b => b.pacienteId === p.id && !b.convenioId); // ignora convênio
        const pagosPorBaixa = (baixaId) => state.pagamentos
          .filter(pg => pg.baixaId === baixaId)
          .reduce((s, pg) => s + pg.valor, 0);

        // Débitos em aberto (baixas com saldo restante)
        const debitos = baixasPac
          .map(b => {
            const pagoNela = pagosPorBaixa(b.id);
            return { ...b, restante: b.valor - pagoNela };
          })
          .filter(b => b.restante > 0)
          .sort((a, b) => a.data.localeCompare(b.data));

        const dataDebMaisAntigo = debitos[0]?.data || null;
        const diasEmAberto = dataDebMaisAntigo
          ? Math.floor((new Date() - new Date(dataDebMaisAntigo)) / (1000 * 60 * 60 * 24))
          : 0;

        return { ...p, totalRealizado, totalPago, saldo, debitos, dataDebMaisAntigo, diasEmAberto };
      })
      .filter(Boolean)
      .filter(p => {
        if (filtroMinimo && p.saldo < Number(filtroMinimo)) return false;
        if (filtroDias && p.diasEmAberto < Number(filtroDias)) return false;
        return true;
      })
      .sort((a, b) => ordenar === "valor" ? b.saldo - a.saldo : b.diasEmAberto - a.diasEmAberto);
  }, [state.pacientes, state.baixas, state.pagamentos, ordenar, filtroMinimo, filtroDias]);

  const totalDevido = devedores.reduce((s, p) => s + p.saldo, 0);

  function abrirPagamento(pac) {
    setModalPag(pac);
    setFormPag({ valor: String(pac.saldo), data: today(), forma: "dinheiro", obs: "" });
  }

  function confirmarPagamento() {
    if (!formPag.valor || Number(formPag.valor) <= 0) return;
    dispatch({
      type: "ADD_PAGAMENTO",
      payload: {
        pacienteId: modalPag.id,
        data: formPag.data,
        valor: Number(formPag.valor),
        forma: formPag.forma,
        baixaId: null,
        obs: formPag.obs,
        descricao: `Pagamento avulso - ${modalPag.nome}`,
      }
    });
    setModalPag(null);
  }

  function corDias(dias) {
    if (dias > 60) return C.red;
    if (dias > 30) return C.amber;
    return C.teal;
  }

  return (
    <div>
      {/* Resumo geral */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.redLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase" }}>Total em aberto</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, marginTop: 4 }}>{fmt(totalDevido)}</div>
        </div>
        <div style={{ background: C.amberLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase" }}>Pacientes devedores</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.amber, marginTop: 4 }}>{devedores.length}</div>
        </div>
        <div style={{ background: C.redLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase" }}>Acima de 30 dias</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, marginTop: 4 }}>
            {devedores.filter(p => p.diasEmAberto > 30).length}
          </div>
        </div>
        <div style={{ background: C.bg, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase" }}>Acima de 60 dias</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, marginTop: 4 }}>
            {devedores.filter(p => p.diasEmAberto > 60).length}
          </div>
        </div>
      </div>

      {/* Filtros e ordenação */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <Input
            label="Valor mínimo (R$)"
            type="number"
            value={filtroMinimo}
            onChange={e => setFiltroMinimo(e.target.value)}
            placeholder="Ex: 200"
          />
          <Input
            label="Mínimo de dias em aberto"
            type="number"
            value={filtroDias}
            onChange={e => setFiltroDias(e.target.value)}
            placeholder="Ex: 30"
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Ordenar por</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ k: "valor", label: "Maior valor" }, { k: "tempo", label: "Mais antigo" }].map(opt => (
                <button key={opt.k} onClick={() => setOrdenar(opt.k)} style={{
                  flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: `2px solid ${ordenar === opt.k ? C.teal : C.border}`,
                  background: ordenar === opt.k ? C.tealLight : C.white,
                  color: ordenar === opt.k ? C.teal : C.muted,
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de devedores */}
      {devedores.length === 0 ? (
        <div style={{ textAlign: "center", color: C.green, padding: 60, fontSize: 15, fontWeight: 600 }}>
          ✓ Nenhum paciente com saldo devedor nos filtros selecionados.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {devedores.map(p => (
            <Card key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Badge color="teal">Ficha #{String(p.ficha).padStart(4, "0")}</Badge>
                    <span style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{p.nome}</span>
                    {p.diasEmAberto > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: corDias(p.diasEmAberto) }}>
                        ⏱ {p.diasEmAberto} dia{p.diasEmAberto !== 1 ? "s" : ""} em aberto
                      </span>
                    )}
                  </div>

                  {p.telefone && (
                    <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                      📞 {p.telefone}
                    </div>
                  )}

                  {/* Procedimentos em aberto */}
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {p.debitos.map(b => (
                      <span key={b.id} style={{
                        background: C.bg, border: `1px solid ${C.border}`,
                        borderRadius: 20, padding: "3px 10px", fontSize: 11, color: C.muted,
                      }}>
                        {b.proc} — falta {fmt(b.restante)}
                        <span style={{ marginLeft: 6, color: C.muted, fontSize: 10 }}>({b.data})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.muted }}>Saldo devedor</div>
                    <div style={{ fontWeight: 800, color: C.red, fontSize: 20 }}>{fmt(p.saldo)}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {fmt(p.totalPago)} / {fmt(p.totalRealizado)} pagos
                    </div>
                  </div>
                  <Btn variant="green" onClick={() => abrirPagamento(p)}>
                    💵 Registrar Pagamento
                  </Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de pagamento rápido */}
      {modalPag && (
        <Modal title={`Registrar Pagamento — ${modalPag.nome}`} onClose={() => setModalPag(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.redLight, borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: C.red }}>Saldo devedor: {fmt(modalPag.saldo)}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                {modalPag.debitos.length} procedimento(s) em aberto · débito mais antigo: {modalPag.dataDebMaisAntigo}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input
                label="Valor pago (R$) *"
                type="number"
                value={formPag.valor}
                onChange={e => setFormPag(x => ({ ...x, valor: e.target.value }))}
              />
              <Input
                label="Data"
                type="date"
                value={formPag.data}
                onChange={e => setFormPag(x => ({ ...x, data: e.target.value }))}
              />
            </div>

            <Select label="Forma de pagamento" value={formPag.forma} onChange={e => setFormPag(x => ({ ...x, forma: e.target.value }))}>
              {formas.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </Select>

            <Input
              label="Observações"
              value={formPag.obs}
              onChange={e => setFormPag(x => ({ ...x, obs: e.target.value }))}
              placeholder="Opcional — ex: parcela 1 de 3"
            />

            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              Este pagamento será lançado como avulso (abate do saldo geral). Para vincular a um procedimento específico, use a aba Pagamentos.
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModalPag(null)}>Cancelar</Btn>
              <Btn variant="green" onClick={confirmarPagamento}>Confirmar Pagamento</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Caixa ─────────────────────────────────────────────────
function Caixa({ state, dispatch }) {
  const [filtroData, setFiltroData] = useState(today().slice(0, 7)); // YYYY-MM
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: "entrada", descricao: "", valor: "", forma: "dinheiro", data: today() });

  const movimentos = useMemo(() =>
    state.caixa.filter(c => c.data.startsWith(filtroData)).sort((a, b) => b.data.localeCompare(a.data)),
    [state.caixa, filtroData]
  );

  const entradas = movimentos.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const saidas = movimentos.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);

  function salvar() {
    if (!form.descricao || !form.valor) return;
    dispatch({ type: "ADD_CAIXA_MANUAL", payload: { ...form, valor: Number(form.valor) } });
    setModal(false); setForm({ tipo: "entrada", descricao: "", valor: "", forma: "dinheiro", data: today() });
  }

  const formas = ["dinheiro", "pix", "débito", "crédito", "cheque", "convênio"];

  return (
    <div>
      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Entradas", valor: entradas, color: C.green, bg: C.greenLight },
          { label: "Saídas", valor: saidas, color: C.red, bg: C.redLight },
          { label: "Saldo do Mês", valor: entradas - saidas, color: C.navy, bg: C.tealLight },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: card.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: card.color, marginTop: 6 }}>{fmt(card.valor)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Input type="month" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
        <div style={{ flex: 1 }} />
        <Btn onClick={() => setModal(true)}>+ Lançar Manualmente</Btn>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.navy }}>
              {["Data", "Descrição", "Forma", "Tipo", "Valor"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.white, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movimentos.map((m, i) => (
              <tr key={m.id} style={{ background: i % 2 === 0 ? C.white : "#F7FAFC" }}>
                <td style={{ padding: "10px 14px", fontSize: 13, color: C.muted }}>{m.data}</td>
                <td style={{ padding: "10px 14px", fontSize: 14, color: C.text }}>{m.descricao}</td>
                <td style={{ padding: "10px 14px", fontSize: 13 }}><Badge color="teal">{m.forma}</Badge></td>
                <td style={{ padding: "10px 14px" }}><Badge color={m.tipo === "entrada" ? "green" : "red"}>{m.tipo}</Badge></td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: m.tipo === "entrada" ? C.green : C.red }}>{m.tipo === "saida" ? "−" : "+"}{fmt(m.valor)}</td>
              </tr>
            ))}
            {movimentos.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhum lançamento neste período.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal title="Lançamento Manual" onClose={() => setModal(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <Select label="Tipo" value={form.tipo} onChange={e => setForm(x => ({ ...x, tipo: e.target.value }))}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </Select>
            <Input label="Descrição *" value={form.descricao} onChange={e => setForm(x => ({ ...x, descricao: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Valor (R$) *" type="number" value={form.valor} onChange={e => setForm(x => ({ ...x, valor: e.target.value }))} />
              <Input label="Data" type="date" value={form.data} onChange={e => setForm(x => ({ ...x, data: e.target.value }))} />
            </div>
            <Select label="Forma de pagamento" value={form.forma} onChange={e => setForm(x => ({ ...x, forma: e.target.value }))}>
              {formas.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </Select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn onClick={salvar}>Lançar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ── Módulo: Repasses ───────────────────────────────────────────────
// Calcula o valor a repassar para um dentista num período escolhido,
// aplica a regra configurada no cadastro (% ou tabela fixa), permite
// ajustes manuais pontuais, e ao confirmar gera uma Conta a Pagar.

function Repasses({ state, dispatch }) {
  const [dentistaSel, setDentistaSel] = useState("");
  const [periodo, setPeriodo] = useState("mensal");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [ajustes, setAjustes] = useState([]); // ajustes manuais pontuais
  const [novoAjuste, setNovoAjuste] = useState({ descricao: "", valor: "" });
  const [modalConfirmar, setModalConfirmar] = useState(false);

  const dentista = state.dentistasCadastrados.find(d => d.id === Number(dentistaSel));

  // Define datas automáticas ao trocar período
  function aplicarPeriodo(p) {
    setPeriodo(p);
    const hoje = new Date();
    if (p === "mensal") {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      setDataInicio(ini.toISOString().slice(0, 10));
      setDataFim(fim.toISOString().slice(0, 10));
    } else {
      // quinzenal: 1ª ou 2ª quinzena do mês atual
      const dia = hoje.getDate();
      if (dia <= 15) {
        setDataInicio(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}-01`);
        setDataFim(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}-15`);
      } else {
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        setDataInicio(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}-16`);
        setDataFim(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}-${ultimoDia}`);
      }
    }
  }

  // Baixas do dentista selecionado no período
  const baixasPeriodo = useMemo(() => {
    if (!dentistaSel || !dataInicio || !dataFim) return [];
    return state.baixas.filter(b =>
      b.dentista === dentista?.nome &&
      b.data >= dataInicio &&
      b.data <= dataFim
    );
  }, [dentistaSel, dataInicio, dataFim, state.baixas, dentista]);

  // Calcula repasse de cada baixa segundo a regra configurada no cadastro
  const itenscalculados = useMemo(() => {
    if (!dentista) return [];
    return baixasPeriodo.map(b => {
      let repasseCalc = 0;
      let origem = "";
      if (dentista.repasseTipo === "percentual" && dentista.repassePercentual) {
        repasseCalc = b.valor * (Number(dentista.repassePercentual) / 100);
        origem = `${dentista.repassePercentual}% de ${fmt(b.valor)}`;
      } else if (dentista.repasseTipo === "fixo") {
        const orc = state.orcamentos.find(o => o.id === b.orcamentoId);
        const item = orc?.itens?.[b.itemIdx];
        const cod = item?.cod;
        const entradaTabela = dentista.repasseTabelaFixa?.find(t => t.cod === cod);
        if (entradaTabela) {
          repasseCalc = Number(entradaTabela.valor);
          origem = `Tabela fixa: ${fmt(repasseCalc)}`;
        } else {
          origem = "Procedimento fora da tabela — sem repasse automático";
        }
      }
      return { ...b, repasseCalc, origem };
    });
  }, [baixasPeriodo, dentista, state.orcamentos]);

  const totalProcedimentos = itenscalculados.reduce((s, it) => s + it.repasseCalc, 0);
  const totalAjustes = ajustes.reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalRepasse = totalProcedimentos + totalAjustes;

  function addAjuste() {
    if (!novoAjuste.descricao.trim() || !novoAjuste.valor) return;
    setAjustes(x => [...x, { ...novoAjuste, id: Date.now() }]);
    setNovoAjuste({ descricao: "", valor: "" });
  }
  function remAjuste(id) { setAjustes(x => x.filter(a => a.id !== id)); }

  function confirmarRepasse() {
    const descricao = `Repasse ${dentista.nome} — ${dataInicio} a ${dataFim}`;
    dispatch({
      type: "ADD_CONTA_PAGAR",
      payload: {
        descricao,
        fornecedor: dentista.nome,
        categoria: "Salários",
        valor: totalRepasse,
        vencimento: dataFim,
        obs: `Período: ${dataInicio} a ${dataFim} · ${itenscalculados.length} procedimento(s) · ${ajustes.length} ajuste(s) manual(is)`,
      }
    });
    setModalConfirmar(false);
    setDentistaSel("");
    setAjustes([]);
  }

  const getPac = (id) => state.pacientes.find(p => p.id === id);

  return (
    <div>
      {/* Seleção de dentista e período */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <Select label="Dentista" value={dentistaSel} onChange={e => setDentistaSel(e.target.value)}>
            <option value="">Selecione o dentista…</option>
            {state.dentistasCadastrados.map(d => (
              <option key={d.id} value={d.id}>{d.nome}{d.especialidade ? ` — ${d.especialidade}` : ""}</option>
            ))}
          </Select>

          {dentistaSel && (
            <>
              {dentista && (
                <div style={{ background: C.tealLight, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                  <strong>Regra configurada:</strong>{" "}
                  {dentista.repasseTipo === "percentual"
                    ? `${dentista.repassePercentual || "0"}% sobre o valor de cada procedimento realizado`
                    : `Tabela fixa (${dentista.repasseTabelaFixa?.length || 0} procedimento(s) cadastrado(s))`
                  }
                  {(!dentista.repassePercentual && dentista.repasseTipo === "percentual") && (
                    <span style={{ color: C.red, marginLeft: 8 }}>⚠ Configure o percentual no cadastro do dentista</span>
                  )}
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Período</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[{ k: "quinzenal", label: "Quinzenal" }, { k: "mensal", label: "Mensal" }].map(opt => (
                    <button key={opt.k} onClick={() => aplicarPeriodo(opt.k)} style={{
                      padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: `2px solid ${periodo === opt.k ? C.teal : C.border}`,
                      background: periodo === opt.k ? C.tealLight : C.white,
                      color: periodo === opt.k ? C.teal : C.muted,
                    }}>{opt.label}</button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="Data início" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                  <Input label="Data fim" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {dentistaSel && dataInicio && dataFim && (
        <>
          {/* Procedimentos do período */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>
              PROCEDIMENTOS REALIZADOS NO PERÍODO
              <span style={{ color: C.muted, fontWeight: 400, fontSize: 12, marginLeft: 8 }}>({baixasPeriodo.length} procedimento(s))</span>
            </div>
            {itenscalculados.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Nenhum procedimento realizado neste período.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {itenscalculados.map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <span style={{ color: C.text }}>{it.proc}</span>
                      <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>
                        {it.data} · {getPac(it.pacienteId)?.nome} · {it.origem}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: it.repasseCalc > 0 ? C.teal : C.muted }}>
                      {fmt(it.repasseCalc)}
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 13, fontWeight: 700, color: C.teal }}>
                  Subtotal procedimentos: {fmt(totalProcedimentos)}
                </div>
              </div>
            )}
          </Card>

          {/* Ajustes manuais */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>AJUSTES MANUAIS (opcional)</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              Use para casos pontuais: procedimento fora da tabela, preço especial, bônus, desconto, etc.
            </div>

            {/* Linha de adição de ajuste */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 40px", gap: 8, marginBottom: 12, alignItems: "end" }}>
              <Input
                label="Descrição do ajuste"
                value={novoAjuste.descricao}
                onChange={e => setNovoAjuste(x => ({ ...x, descricao: e.target.value }))}
                placeholder="Ex: Implante com preço especial, bônus, etc."
              />
              <Input
                label="Valor (R$)"
                type="number"
                value={novoAjuste.valor}
                onChange={e => setNovoAjuste(x => ({ ...x, valor: e.target.value }))}
                placeholder="0,00"
              />
              <Btn onClick={addAjuste} disabled={!novoAjuste.descricao.trim() || !novoAjuste.valor} style={{ height: 36 }}>+</Btn>
            </div>

            {ajustes.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ajustes.map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.text }}>{a.descricao}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, color: C.teal }}>{fmt(Number(a.valor))}</span>
                      <button onClick={() => remAjuste(a.id)} style={{ background: C.redLight, color: C.red, border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer", fontSize: 13 }}>×</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 13, fontWeight: 700, color: C.teal }}>
                  Subtotal ajustes: {fmt(totalAjustes)}
                </div>
              </div>
            )}
          </Card>

          {/* Total e botão de confirmar */}
          <div style={{ background: C.navy, borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ color: "#A0C4D5", fontSize: 12, fontWeight: 600 }}>TOTAL DO REPASSE</div>
              <div style={{ color: C.white, fontSize: 11, marginTop: 2 }}>
                {dataInicio} a {dataFim} · {itenscalculados.length} procedimento(s) + {ajustes.length} ajuste(s)
              </div>
            </div>
            <span style={{ color: C.white, fontSize: 26, fontWeight: 800 }}>{fmt(totalRepasse)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn
              onClick={() => setModalConfirmar(true)}
              disabled={totalRepasse <= 0}
            >
              Gerar Conta a Pagar →
            </Btn>
          </div>
        </>
      )}

      {/* Modal de confirmação */}
      {modalConfirmar && (
        <Modal title="Confirmar Geração do Repasse" onClose={() => setModalConfirmar(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.tealLight, borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: C.teal, fontSize: 15 }}>{dentista?.nome}</div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Período: {dataInicio} a {dataFim}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.muted }}>Procedimentos ({itenscalculados.length})</span>
                <span>{fmt(totalProcedimentos)}</span>
              </div>
              {ajustes.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: C.muted }}>Ajustes manuais ({ajustes.length})</span>
                  <span>{fmt(totalAjustes)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: C.navy }}>Total a pagar</span>
                <span style={{ color: C.teal }}>{fmt(totalRepasse)}</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              Isso vai gerar uma Conta a Pagar com vencimento em <strong>{dataFim}</strong>. Você pode dar baixa no pagamento pelo módulo <strong>Contas a Pagar</strong>, que lançará a saída automaticamente no Caixa.
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModalConfirmar(false)}>Cancelar</Btn>
              <Btn variant="green" onClick={confirmarRepasse}>Confirmar e Gerar Conta</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Contas a Pagar ─────────────────────────────────────────
const CATEGORIAS_CONTA = ["Aluguel", "Fornecedor / Material", "Salários", "Impostos", "Energia/Água/Internet", "Manutenção/Equipamento", "Laboratório", "Marketing", "Outros"];

function ContasPagar({ state, dispatch }) {
  const [modal, setModal] = useState(false);
  const [modalPagar, setModalPagar] = useState(null); // conta selecionada para pagar
  const [filtro, setFiltro] = useState("abertas"); // abertas | pagas | todas | atrasadas
  const [form, setForm] = useState({ descricao: "", fornecedor: "", categoria: "", valor: "", vencimento: today(), obs: "" });
  const [formPag, setFormPag] = useState({ dataPagamento: today(), forma: "dinheiro", valorPago: "" });
  const [erro, setErro] = useState(false);

  function abrirNova() {
    setForm({ descricao: "", fornecedor: "", categoria: "", valor: "", vencimento: today(), obs: "" });
    setErro(false);
    setModal(true);
  }

  function salvar() {
    if (!form.descricao.trim() || !form.valor || !form.vencimento) { setErro(true); return; }
    dispatch({
      type: "ADD_CONTA_PAGAR",
      payload: {
        descricao: form.descricao,
        fornecedor: form.fornecedor,
        categoria: form.categoria,
        valor: Number(form.valor),
        vencimento: form.vencimento,
        obs: form.obs,
      }
    });
    setModal(false);
  }

  function abrirPagamento(conta) {
    setFormPag({ dataPagamento: today(), forma: "dinheiro", valorPago: conta.valor });
    setModalPagar(conta);
  }

  function confirmarPagamento() {
    dispatch({
      type: "PAGAR_CONTA",
      payload: {
        contaId: modalPagar.id,
        dataPagamento: formPag.dataPagamento,
        forma: formPag.forma,
        valorPago: Number(formPag.valorPago) || modalPagar.valor,
      }
    });
    setModalPagar(null);
  }

  const hoje = today();

  function statusConta(c) {
    if (c.status === "paga") return "paga";
    if (c.vencimento < hoje) return "atrasada";
    return "aberta";
  }

  const lista = useMemo(() => {
    return state.contasPagar
      .filter(c => {
        const st = statusConta(c);
        if (filtro === "todas") return true;
        if (filtro === "abertas") return st === "aberta" || st === "atrasada";
        if (filtro === "atrasadas") return st === "atrasada";
        if (filtro === "pagas") return st === "paga";
        return true;
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [state.contasPagar, filtro]);

  const totalAberto = state.contasPagar.filter(c => c.status !== "paga").reduce((s, c) => s + c.valor, 0);
  const totalAtrasado = state.contasPagar.filter(c => statusConta(c) === "atrasada").reduce((s, c) => s + c.valor, 0);
  const totalPagoMes = state.contasPagar.filter(c => c.status === "paga" && c.dataPagamento?.startsWith(hoje.slice(0,7))).reduce((s, c) => s + (c.valorPago || c.valor), 0);

  const statusBadge = { aberta: "amber", atrasada: "red", paga: "green" };
  const statusLabel = { aberta: "EM ABERTO", atrasada: "ATRASADA", paga: "PAGA" };

  const formas = ["dinheiro", "pix", "débito", "crédito", "boleto", "transferência"];

  return (
    <div>
      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.amberLight, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: 0.5 }}>Em aberto</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.amber, marginTop: 6 }}>{fmt(totalAberto)}</div>
        </div>
        <div style={{ background: C.redLight, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 0.5 }}>Atrasado</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, marginTop: 6 }}>{fmt(totalAtrasado)}</div>
        </div>
        <div style={{ background: C.greenLight, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 0.5 }}>Pago este mês</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginTop: 6 }}>{fmt(totalPagoMes)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "abertas", label: "Em aberto" },
            { k: "atrasadas", label: "Atrasadas" },
            { k: "pagas", label: "Pagas" },
            { k: "todas", label: "Todas" },
          ].map(f => (
            <button key={f.k} onClick={() => setFiltro(f.k)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: `2px solid ${filtro === f.k ? C.teal : C.border}`,
              background: filtro === f.k ? C.tealLight : C.white,
              color: filtro === f.k ? C.teal : C.muted,
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Btn onClick={abrirNova}>+ Nova Conta</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Nenhuma conta encontrada neste filtro.</div>
        )}
        {lista.map(c => {
          const st = statusConta(c);
          return (
            <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{c.descricao}</span>
                  <Badge color={statusBadge[st]}>{statusLabel[st]}</Badge>
                  {c.categoria && <span style={{ color: C.muted, fontSize: 12 }}>· {c.categoria}</span>}
                </div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                  {c.fornecedor && <>Fornecedor: {c.fornecedor} · </>}
                  Vencimento: {c.vencimento}
                  {c.status === "paga" && <> · Pago em {c.dataPagamento} ({c.formaPag})</>}
                </div>
                {c.obs && <div style={{ color: C.muted, fontSize: 12, marginTop: 2, fontStyle: "italic" }}>{c.obs}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 800, color: st === "atrasada" ? C.red : C.navy, fontSize: 16 }}>{fmt(c.valor)}</span>
                {c.status !== "paga" ? (
                  <>
                    <Btn variant="green" onClick={() => abrirPagamento(c)}>Dar Baixa</Btn>
                    <Btn variant="danger" onClick={() => dispatch({ type: "DELETE_CONTA_PAGAR", payload: c.id })}>Excluir</Btn>
                  </>
                ) : (
                  <Btn variant="danger" onClick={() => dispatch({ type: "DELETE_CONTA_PAGAR", payload: c.id })}>Excluir</Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal nova conta */}
      {modal && (
        <Modal title="Nova Conta a Pagar" onClose={() => setModal(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <Campo erro={erro && !form.descricao.trim() ? "Descrição obrigatória" : null}>
              <Input label="Descrição *" value={form.descricao} onChange={e => setForm(x => ({ ...x, descricao: e.target.value }))} placeholder="Ex: Aluguel da clínica, Compra de material…" style={erro && !form.descricao.trim() ? { borderColor: C.red } : {}} />
            </Campo>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Fornecedor / Credor" value={form.fornecedor} onChange={e => setForm(x => ({ ...x, fornecedor: e.target.value }))} />
              <Select label="Categoria" value={form.categoria} onChange={e => setForm(x => ({ ...x, categoria: e.target.value }))}>
                <option value="">Selecione…</option>
                {CATEGORIAS_CONTA.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </Select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Campo erro={erro && !form.valor ? "Valor obrigatório" : null}>
                <Input label="Valor (R$) *" type="number" value={form.valor} onChange={e => setForm(x => ({ ...x, valor: e.target.value }))} style={erro && !form.valor ? { borderColor: C.red } : {}} />
              </Campo>
              <Campo erro={erro && !form.vencimento ? "Vencimento obrigatório" : null}>
                <Input label="Vencimento *" type="date" value={form.vencimento} onChange={e => setForm(x => ({ ...x, vencimento: e.target.value }))} style={erro && !form.vencimento ? { borderColor: C.red } : {}} />
              </Campo>
            </div>

            <Input label="Observações" value={form.obs} onChange={e => setForm(x => ({ ...x, obs: e.target.value }))} placeholder="Opcional" />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn onClick={salvar}>Salvar Conta</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal dar baixa / pagamento */}
      {modalPagar && (
        <Modal title="Confirmar Pagamento" onClose={() => setModalPagar(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.tealLight, borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: C.teal }}>{modalPagar.descricao}</div>
              {modalPagar.fornecedor && <div style={{ color: C.muted, fontSize: 13 }}>Fornecedor: {modalPagar.fornecedor}</div>}
              <div style={{ color: C.muted, fontSize: 13 }}>Vencimento: {modalPagar.vencimento} · Valor: {fmt(modalPagar.valor)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Valor pago (R$)" type="number" value={formPag.valorPago} onChange={e => setFormPag(x => ({ ...x, valorPago: e.target.value }))} />
              <Input label="Data do pagamento" type="date" value={formPag.dataPagamento} onChange={e => setFormPag(x => ({ ...x, dataPagamento: e.target.value }))} />
            </div>
            <Select label="Forma de pagamento" value={formPag.forma} onChange={e => setFormPag(x => ({ ...x, forma: e.target.value }))}>
              {formas.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </Select>
            <div style={{ fontSize: 11, color: C.muted, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
              Este pagamento será lançado automaticamente como saída no Caixa.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setModalPagar(null)}>Cancelar</Btn>
              <Btn variant="green" onClick={confirmarPagamento}>Confirmar Pagamento</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ── Módulo: Análise de Procedimentos ───────────────────────────────
// Cruza orçamentos (o que foi proposto) com baixas (o que foi de fato realizado)
// para mostrar quais procedimentos convertem mais e quais ficam só no papel.

// filtroConvenio: null = todos | "particular" | número (convenioId)
function calcularAnaliseProcedimentos(state, filtroConvenio = null) {
  const porCod = {};

  function get(cod, procNome) {
    if (!porCod[cod]) {
      porCod[cod] = { cod, proc: procNome, qtdOrcada: 0, valorOrcado: 0, qtdRealizada: 0, valorRealizado: 0 };
    }
    return porCod[cod];
  }

  // Filtra orçamentos pelo convênio selecionado
  const orcsFiltrados = state.orcamentos.filter(orc => {
    if (filtroConvenio === null) return true;
    if (filtroConvenio === "particular") return !orc.convenioId;
    return orc.convenioId === filtroConvenio;
  });

  orcsFiltrados.forEach(orc => {
    orc.itens.forEach(it => {
      const qtd = it.dentes?.length || 1;
      const chave = it.cod || it.proc;
      const entry = get(chave, it.proc);
      entry.qtdOrcada += qtd;
      entry.valorOrcado += it.valor;
    });
  });

  // Filtra baixas pelo mesmo critério (via orçamento de origem)
  state.baixas.forEach(b => {
    if (filtroConvenio !== null) {
      if (filtroConvenio === "particular" && b.convenioId) return;
      if (filtroConvenio !== "particular" && b.convenioId !== filtroConvenio) return;
    }
    const orc = state.orcamentos.find(o => o.id === b.orcamentoId);
    const item = orc?.itens?.[b.itemIdx];
    const chave = item?.cod || b.proc;
    const entry = get(chave, b.proc);
    entry.qtdRealizada += 1;
    entry.valorRealizado += b.valor;
  });

  return Object.values(porCod).map(e => ({
    ...e,
    taxaConversao: e.qtdOrcada > 0 ? (e.qtdRealizada / e.qtdOrcada) * 100 : 0,
    valorParado: e.valorOrcado - e.valorRealizado,
  }));
}

// Cruza orçamentos e baixas por dentista responsável, para saber quem mais
// orça, quem mais converte em procedimento realizado, e quanto cada um faturou.
function calcularAnalisePorDentista(state) {
  const porNome = {}; // nome → { nome, especialidade, qtdOrcada, valorOrcado, qtdRealizada, valorRealizado }

  function get(nome) {
    if (!porNome[nome]) {
      const cadastro = state.dentistasCadastrados.find(d => d.nome === nome);
      porNome[nome] = {
        nome,
        especialidade: cadastro?.especialidade || "—",
        cro: cadastro?.cro || "",
        qtdOrcada: 0, valorOrcado: 0,
        qtdRealizada: 0, valorRealizado: 0,
      };
    }
    return porNome[nome];
  }

  // Orçamentos: quem é o dentista responsável pelo orçamento
  state.orcamentos.forEach(orc => {
    if (!orc.dentista) return;
    const entry = get(orc.dentista);
    const totalItens = orc.itens.reduce((s, it) => s + (it.dentes?.length || 1), 0);
    const valorTotal = orc.itens.reduce((s, it) => s + it.valor, 0);
    entry.qtdOrcada += totalItens;
    entry.valorOrcado += valorTotal;
  });

  // Baixas: quem de fato realizou o procedimento
  state.baixas.forEach(b => {
    if (!b.dentista) return;
    const entry = get(b.dentista);
    entry.qtdRealizada += 1;
    entry.valorRealizado += b.valor;
  });

  return Object.values(porNome).map(e => ({
    ...e,
    taxaConversao: e.qtdOrcada > 0 ? (e.qtdRealizada / e.qtdOrcada) * 100 : 0,
  }));
}

function Analise({ state }) {
  const [ordenarPor, setOrdenarPor] = useState("valorRealizado");
  const [filtroConv, setFiltroConv] = useState(null); // null=todos | "particular" | convenioId (number)

  const dados = useMemo(() => calcularAnaliseProcedimentos(state, filtroConv), [state.orcamentos, state.baixas, filtroConv]);
  const dadosDentistas = useMemo(() => calcularAnalisePorDentista(state), [state.orcamentos, state.baixas, state.dentistasCadastrados]);

  const dadosOrdenados = useMemo(() => {
    return [...dados].sort((a, b) => b[ordenarPor] - a[ordenarPor]);
  }, [dados, ordenarPor]);

  const totais = useMemo(() => {
    return dados.reduce((acc, d) => ({
      valorOrcado: acc.valorOrcado + d.valorOrcado,
      valorRealizado: acc.valorRealizado + d.valorRealizado,
      qtdOrcada: acc.qtdOrcada + d.qtdOrcada,
      qtdRealizada: acc.qtdRealizada + d.qtdRealizada,
    }), { valorOrcado: 0, valorRealizado: 0, qtdOrcada: 0, qtdRealizada: 0 });
  }, [dados]);

  const taxaGeral = totais.qtdOrcada > 0 ? (totais.qtdRealizada / totais.qtdOrcada) * 100 : 0;

  const maisRealizados = [...dados].sort((a, b) => b.qtdRealizada - a.qtdRealizada).slice(0, 5).filter(d => d.qtdRealizada > 0);
  const maisParados = [...dados].sort((a, b) => b.valorParado - a.valorParado).slice(0, 5).filter(d => d.valorParado > 0);

  const opcoesOrdenacao = [
    { k: "valorRealizado", label: "Valor realizado" },
    { k: "qtdRealizada", label: "Qtd. realizada" },
    { k: "valorOrcado", label: "Valor orçado" },
    { k: "qtdOrcada", label: "Qtd. orçada" },
    { k: "taxaConversao", label: "Taxa de conversão" },
    { k: "valorParado", label: "Valor parado" },
  ];

  return (
    <div>
      {/* Filtro por convênio */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { k: null,        label: "Todos" },
          { k: "particular", label: "Particular" },
          ...state.convenios.map(c => ({ k: c.id, label: c.nome })),
        ].map(opt => (
          <button key={String(opt.k)} onClick={() => setFiltroConv(opt.k)} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
            border: `2px solid ${filtroConv === opt.k ? C.teal : C.border}`,
            background: filtroConv === opt.k ? C.tealLight : C.white,
            color: filtroConv === opt.k ? C.teal : C.muted,
          }}>{opt.label}</button>
        ))}
      </div>

      {/* Resumo geral */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.tealLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase" }}>Total Orçado</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.teal, marginTop: 4 }}>{fmt(totais.valorOrcado)}</div>
        </div>
        <div style={{ background: C.greenLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase" }}>Total Realizado</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.green, marginTop: 4 }}>{fmt(totais.valorRealizado)}</div>
        </div>
        <div style={{ background: C.amberLight, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase" }}>Valor Parado</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.amber, marginTop: 4 }}>{fmt(totais.valorOrcado - totais.valorRealizado)}</div>
        </div>
        <div style={{ background: C.bg, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase" }}>Conversão Geral</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, marginTop: 4 }}>{taxaGeral.toFixed(0)}%</div>
        </div>
      </div>

      {dados.length === 0 ? (
        <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>
          Nenhum dado ainda. Crie orçamentos e dê baixa em procedimentos para ver a análise aqui.
        </div>
      ) : (
        <>
          {/* Destaques rápidos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <Card>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>🏆 MAIS REALIZADOS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {maisRealizados.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>Nenhum procedimento realizado ainda.</div>}
                {maisRealizados.map(d => (
                  <div key={d.cod} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: C.text }}>{d.proc}</span>
                    <span style={{ fontWeight: 700, color: C.green }}>{d.qtdRealizada}x</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 10 }}>⏸ MAIS PARADOS (orçados, não feitos)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {maisParados.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>Nenhum valor parado — ótimo sinal!</div>}
                {maisParados.map(d => (
                  <div key={d.cod} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: C.text }}>{d.proc}</span>
                    <span style={{ fontWeight: 700, color: C.amber }}>{fmt(d.valorParado)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Por dentista — quem orça, quem converte, quem fatura mais */}
          {dadosDentistas.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "14px 16px 0" }}>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 4 }}>👩‍⚕️ POR DENTISTA</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Quem orçou e quem efetivamente realizou cada procedimento</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: C.navy }}>
                      {["Dentista", "Especialidade", "Qtd. Orçada", "Qtd. Realizada", "Conversão", "Valor Realizado"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: h === "Dentista" || h === "Especialidade" ? "left" : "right", color: C.white, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...dadosDentistas].sort((a, b) => b.valorRealizado - a.valorRealizado).map((d, i) => (
                      <tr key={d.nome} style={{ background: i % 2 === 0 ? C.white : "#F7FAFC" }}>
                        <td style={{ padding: "9px 12px", fontSize: 13, color: C.text, fontWeight: 600 }}>{d.nome}</td>
                        <td style={{ padding: "9px 12px", fontSize: 12, color: C.muted }}>{d.especialidade}</td>
                        <td style={{ padding: "9px 12px", fontSize: 13, color: C.muted, textAlign: "right" }}>{d.qtdOrcada}</td>
                        <td style={{ padding: "9px 12px", fontSize: 13, color: C.green, fontWeight: 600, textAlign: "right" }}>{d.qtdRealizada}</td>
                        <td style={{ padding: "9px 12px", fontSize: 13, textAlign: "right" }}>
                          <span style={{
                            color: d.taxaConversao >= 70 ? C.green : d.taxaConversao >= 40 ? C.amber : C.red,
                            fontWeight: 700,
                          }}>{d.taxaConversao.toFixed(0)}%</span>
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 13, color: C.green, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.valorRealizado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Ordenação */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {opcoesOrdenacao.map(opt => (
              <button key={opt.k} onClick={() => setOrdenarPor(opt.k)} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `2px solid ${ordenarPor === opt.k ? C.teal : C.border}`,
                background: ordenarPor === opt.k ? C.tealLight : C.white,
                color: ordenarPor === opt.k ? C.teal : C.muted,
              }}>{opt.label}</button>
            ))}
          </div>

          {/* Tabela completa */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr style={{ background: C.navy }}>
                    {["Procedimento", "Qtd. Orçada", "Qtd. Realizada", "Conversão", "Valor Orçado", "Valor Realizado", "Parado"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: h === "Procedimento" ? "left" : "right", color: C.white, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dadosOrdenados.map((d, i) => (
                    <tr key={d.cod} style={{ background: i % 2 === 0 ? C.white : "#F7FAFC" }}>
                      <td style={{ padding: "9px 12px", fontSize: 13, color: C.text }}>{d.proc}</td>
                      <td style={{ padding: "9px 12px", fontSize: 13, color: C.muted, textAlign: "right" }}>{d.qtdOrcada}</td>
                      <td style={{ padding: "9px 12px", fontSize: 13, color: C.green, fontWeight: 600, textAlign: "right" }}>{d.qtdRealizada}</td>
                      <td style={{ padding: "9px 12px", fontSize: 13, textAlign: "right" }}>
                        <span style={{
                          color: d.taxaConversao >= 70 ? C.green : d.taxaConversao >= 40 ? C.amber : C.red,
                          fontWeight: 700,
                        }}>{d.taxaConversao.toFixed(0)}%</span>
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 13, color: C.muted, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.valorOrcado)}</td>
                      <td style={{ padding: "9px 12px", fontSize: 13, color: C.green, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.valorRealizado)}</td>
                      <td style={{ padding: "9px 12px", fontSize: 13, color: d.valorParado > 0 ? C.amber : C.muted, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.valorParado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}


// ── Módulo: Histórico Clínico ──────────────────────────────────────
// Linha do tempo de atendimentos por paciente: consultas, evoluções,
// anamnese, anotações clínicas. Cada entrada pode vincular procedimentos
// realizados no mesmo dia para cruzar diagnóstico com execução.

const TIPOS_ENTRADA = [
  { k: "consulta",   label: "Consulta",         cor: C.teal,  icone: "🩺" },
  { k: "evolucao",   label: "Evolução clínica",  cor: "#9B59B6", icone: "📝" },
  { k: "anamnese",   label: "Anamnese",           cor: C.amber,  icone: "📋" },
  { k: "exame",      label: "Exame / Imagem",     cor: "#2E7D5B", icone: "🔬" },
  { k: "anotacao",   label: "Anotação",           cor: C.muted,  icone: "💬" },
];

function HistoricoClinico({ state, dispatch, onCriarOrcamento }) {
  const [pacSel, setPacSel] = useState("");
  const [modal, setModal] = useState(null); // null | "novo" | entrada
  const [form, setForm] = useState({ tipo: "consulta", data: today(), dentista: "", texto: "", baixaIds: [] });
  const [formInicial, setFormInicial] = useState(form);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const paciente = state.pacientes.find(p => String(p.id) === String(pacSel));
  const temOrcamentoAprovado = state.orcamentos.some(
    o => String(o.pacienteId) === String(pacSel) && o.status === "aprovado"
  );

  const historicoPac = useMemo(() =>
    state.historicoClinico
      .filter(h => String(h.pacienteId) === String(pacSel))
      .sort((a, b) => b.data.localeCompare(a.data)),
    [state.historicoClinico, pacSel]
  );

  // Baixas do paciente agrupadas por data — para vincular ao registro
  const baixasPorData = useMemo(() => {
    if (!pacSel) return {};
    const map = {};
    state.baixas
      .filter(b => String(b.pacienteId) === String(pacSel))
      .forEach(b => {
        if (!map[b.data]) map[b.data] = [];
        map[b.data].push(b);
      });
    return map;
  }, [pacSel, state.baixas]);

  function abrirNovo() {
    const inicial = { tipo: "consulta", data: today(), dentista: "", texto: "", baixaIds: [] };
    setForm(inicial);
    setFormInicial(inicial);
    setErros({});
    setModal("novo");
  }

  function abrirEditar(h) {
    const inicial = { ...h, baixaIds: [...(h.baixaIds || [])] };
    setForm(inicial);
    setFormInicial(inicial);
    setErros({});
    setModal("editar");
  }

  function tentarFechar() {
    if (JSON.stringify(form) !== JSON.stringify(formInicial)
      && !window.confirm("Existem dados clínicos não salvos. Deseja sair e descartar as alterações?")) return;
    setModal(null);
  }

  function irParaOrcamentos() {
    if (JSON.stringify(form) !== JSON.stringify(formInicial)
      && !window.confirm("Existem dados clínicos não salvos. Deseja descartá-los e ir para Orçamentos?")) return;
    setModal(null);
    onCriarOrcamento();
  }

  async function salvar() {
    const e = {};
    if (!form.texto.trim()) e.texto = "Descrição obrigatória";
    if (!form.data) e.data = "Data obrigatória";
    if (Object.keys(e).length > 0) { setErros(e); return; }

    const payload = { ...form, pacienteId: pacSel };
    setSalvando(true);
    const ok = modal === "novo"
      ? await dispatch({ type: "ADD_HISTORICO", payload })
      : await dispatch({ type: "UPDATE_HISTORICO", payload });
    setSalvando(false);
    if (ok !== false) setModal(null);
  }

  function toggleBaixaId(id) {
    setForm(x => ({
      ...x,
      baixaIds: x.baixaIds.includes(id)
        ? x.baixaIds.filter(b => b !== id)
        : [...x.baixaIds, id]
    }));
  }

  const tipoInfo = (k) => TIPOS_ENTRADA.find(t => t.k === k) || TIPOS_ENTRADA[0];

  // Baixas disponíveis na data selecionada para vinculação
  const baixasNaData = baixasPorData[form.data] || [];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Select label="Selecione o paciente" value={pacSel} onChange={e => setPacSel(e.target.value)}>
          <option value="">Escolha um paciente…</option>
          {state.pacientes.map(p => (
            <option key={p.id} value={p.id}>Ficha #{String(p.ficha).padStart(4,"0")} — {p.nome}</option>
          ))}
        </Select>
      </Card>

      {!pacSel && (
        <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>
          Selecione um paciente para visualizar o histórico clínico.
        </div>
      )}

      {pacSel && (
        <>
          {/* Cabeçalho com dados do paciente */}
          <Card style={{ marginBottom: 16, background: C.tealLight }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, color: C.navy, fontSize: 16 }}>{paciente?.nome}</div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                  Ficha #{String(paciente?.ficha || "").padStart(4,"0")}
                  {paciente?.dataNasc && ` · ${calcIdade(paciente.dataNasc)} anos`}
                  {paciente?.cpf && ` · CPF: ${paciente.cpf}`}
                </div>
                {paciente?.obs && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>⚠ {paciente.obs}</div>}
              </div>
              <Btn onClick={abrirNovo}>+ Nova Entrada</Btn>
            </div>
          </Card>

          {/* Linha do tempo */}
          {historicoPac.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
              Nenhum registro clínico ainda para este paciente.
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* Linha vertical da timeline */}
              <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: C.border, zIndex: 0 }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {historicoPac.map(h => {
                  const tipo = tipoInfo(h.tipo);
                  const baixasVinc = (h.baixaIds || []).map(id => state.baixas.find(b => b.id === id)).filter(Boolean);
                  return (
                    <div key={h.id} style={{ display: "flex", gap: 14, position: "relative", zIndex: 1 }}>
                      {/* Ícone da timeline */}
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                        background: tipo.cor, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, boxShadow: `0 0 0 3px ${C.white}, 0 0 0 5px ${tipo.cor}22`,
                      }}>
                        {tipo.icone}
                      </div>

                      {/* Conteúdo */}
                      <Card style={{ flex: 1, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <span style={{ fontWeight: 700, color: tipo.cor, fontSize: 13 }}>{tipo.label}</span>
                            <span style={{ color: C.muted, fontSize: 12, marginLeft: 10 }}>{h.data}</span>
                            {h.dentista && <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>· Dr(a). {h.dentista}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => abrirEditar(h)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: C.teal }}>editar</button>
                            <button onClick={() => dispatch({ type: "DELETE_HISTORICO", payload: h.id })} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: C.red }}>excluir</button>
                          </div>
                        </div>

                        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                          {h.texto}
                        </div>

                        {/* Procedimentos vinculados */}
                        {baixasVinc.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>PROCEDIMENTOS REALIZADOS NESTA CONSULTA</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {baixasVinc.map(b => (
                                <span key={b.id} style={{ background: C.tealLight, color: C.teal, fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                                  {b.proc} — {fmt(b.valor)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de nova entrada / edição */}
      {modal && (
        <Modal title={modal === "novo" ? "Nova Entrada no Histórico" : "Editar Entrada"} onClose={tentarFechar}>
          <div style={{ display: "grid", gap: 14 }}>

            {/* Tipo de entrada */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Tipo de registro</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {TIPOS_ENTRADA.map(t => (
                  <button key={t.k} onClick={() => setForm(x => ({ ...x, tipo: t.k }))} style={{
                    padding: "8px 6px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center",
                    border: `2px solid ${form.tipo === t.k ? t.cor : C.border}`,
                    background: form.tipo === t.k ? t.cor + "18" : C.white,
                    color: form.tipo === t.k ? t.cor : C.muted,
                  }}>{t.icone} {t.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Campo erro={erros.data}>
                <Input label="Data *" type="date" value={form.data} onChange={e => setForm(x => ({ ...x, data: e.target.value }))} style={erros.data ? { borderColor: C.red } : {}} />
              </Campo>
              <Select label="Dentista" value={form.dentista} onChange={e => setForm(x => ({ ...x, dentista: e.target.value }))}>
                <option value="">Selecione…</option>
                {state.dentistasCadastrados.map(d => (
                  <option key={d.id} value={d.nome}>{d.nome}</option>
                ))}
              </Select>
            </div>

            <Campo erro={erros.texto}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Descrição / Evolução clínica *</label>
              <textarea
                value={form.texto}
                onChange={e => { setForm(x => ({ ...x, texto: e.target.value })); setErros(x => ({ ...x, texto: undefined })); }}
                placeholder="Descreva o atendimento, queixas, achados clínicos, plano de tratamento, orientações…"
                rows={5}
                style={{
                  width: "100%", marginTop: 6, border: `1.5px solid ${erros.texto ? C.red : C.border}`,
                  borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </Campo>

            {!temOrcamentoAprovado && (
              <div style={{ background: C.amberLight, color: C.amber, borderRadius: 8, padding: "10px 12px", fontSize: 12 }}>
                Este registro clínico pode ser salvo normalmente sem orçamento. Para registrar um procedimento realizado e movimentar o financeiro, crie e aprove primeiro um orçamento para este paciente.
                <div style={{ marginTop: 8 }}>
                  <Btn variant="ghost" onClick={irParaOrcamentos}>Ir para Orçamentos</Btn>
                </div>
              </div>
            )}

            {/* Vincular procedimentos realizados na mesma data */}
            {baixasNaData.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  Vincular procedimentos realizados em {form.data}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {baixasNaData.map(b => (
                    <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={form.baixaIds.includes(b.id)}
                        onChange={() => toggleBaixaId(b.id)}
                        style={{ width: 16, height: 16, accentColor: C.teal }}
                      />
                      <span>{b.proc}</span>
                      <span style={{ color: C.teal, fontWeight: 600 }}>{fmt(b.valor)}</span>
                      {b.dentista && <span style={{ color: C.muted, fontSize: 11 }}>· Dr(a). {b.dentista}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={tentarFechar}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Módulo: Odontograma Clínico (registro do estado da boca) ──────
// Numeração FDI
const DENTES_PERM = {
  supDir: [18,17,16,15,14,13,12,11],
  supEsq: [21,22,23,24,25,26,27,28],
  infEsq: [31,32,33,34,35,36,37,38],
  infDir: [48,47,46,45,44,43,42,41],
};
const DENTES_DEC = {
  supDir: [55,54,53,52,51],
  supEsq: [61,62,63,64,65],
  infEsq: [71,72,73,74,75],
  infDir: [85,84,83,82,81],
};

const TODOS_DENTES_PERM = [...DENTES_PERM.supDir, ...DENTES_PERM.supEsq, ...DENTES_PERM.infEsq, ...DENTES_PERM.infDir];
const TODOS_DENTES_DEC = [...DENTES_DEC.supDir, ...DENTES_DEC.supEsq, ...DENTES_DEC.infEsq, ...DENTES_DEC.infDir];

// Status clínicos possíveis para um dente — isto é um registro do estado da boca,
// não gera procedimento nem valor. O lançamento financeiro acontece em Orçamentos.
const STATUS_CLINICO = {
  higido:      { label: "Hígido",            cor: "#FFFFFF", borda: "#CBD5E0", texto: "#1A2A3A" },
  cariado:     { label: "Cariado",            cor: "#C0392B", borda: "#C0392B", texto: "#FFFFFF" },
  restaurado:  { label: "Restaurado",         cor: "#2E7D5B", borda: "#2E7D5B", texto: "#FFFFFF" },
  ausente:     { label: "Ausente",            cor: "#1B3A5C", borda: "#1B3A5C", texto: "#FFFFFF" },
  extracao:    { label: "Indicado p/ extração", cor: "#E8A020", borda: "#E8A020", texto: "#FFFFFF" },
  tratamento:  { label: "Em tratamento",       cor: "#9B59B6", borda: "#9B59B6", texto: "#FFFFFF" },
  coroa:       { label: "Coroa / Prótese",     cor: "#2A7D8C", borda: "#2A7D8C", texto: "#FFFFFF" },
  implante:    { label: "Implante",            cor: "#6B8399", borda: "#6B8399", texto: "#FFFFFF" },
  fraturado:   { label: "Fraturado",           cor: "#8B4513", borda: "#8B4513", texto: "#FFFFFF" },
};

// Ícone do dente — preenchido conforme status clínico atual
function DenteIcone({ dente, dados, onClick, size = 42 }) {
  const status = dados?.status || "higido";
  const info = STATUS_CLINICO[status] || STATUS_CLINICO.higido;
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const ausente = status === "ausente";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", userSelect: "none" }} onClick={onClick}>
      <div style={{ fontSize: 9, fontWeight: 700, color: status !== "higido" ? info.borda : "#6B8399", lineHeight: 1 }}>{dente}</div>
      <svg width={size} height={size}>
        {ausente ? (
          <>
            <circle cx={cx} cy={cy} r={r} fill="#1B3A5C" opacity={0.12} />
            <line x1={cx - r*0.6} y1={cy - r*0.6} x2={cx + r*0.6} y2={cy + r*0.6} stroke="#1B3A5C" strokeWidth={2.2} />
            <line x1={cx + r*0.6} y1={cy - r*0.6} x2={cx - r*0.6} y2={cy + r*0.6} stroke="#1B3A5C" strokeWidth={2.2} />
          </>
        ) : (
          <circle cx={cx} cy={cy} r={r} fill={info.cor} stroke={info.borda} strokeWidth={1.3} opacity={status === "higido" ? 1 : 0.85} />
        )}
      </svg>
    </div>
  );
}

function FileiraDentes({ numeros, label, odo, onDenteClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ fontSize: 9, color: "#6B8399", fontWeight: 700, letterSpacing: 1 }}>{label}</div>
      <div style={{ display: "flex", gap: 2 }}>
        {numeros.map(d => (
          <DenteIcone key={d} dente={d} dados={odo[d]} onClick={() => onDenteClick(d)} size={42} />
        ))}
      </div>
    </div>
  );
}

function Odontograma({ state, dispatch }) {
  const [pacSel, setPacSel] = useState("");
  const [modalDente, setModalDente] = useState(null); // { dente }
  const [statusEdit, setStatusEdit] = useState("higido");
  const [obsEdit, setObsEdit] = useState("");
  const [modo, setModo] = useState("permanente");

  const paciente = state.pacientes.find(p => String(p.id) === String(pacSel));
  const odo = pacSel ? (state.odontogramas[pacSel] || {}) : {};

  function abrirDente(dente) {
    const dados = odo[dente];
    setStatusEdit(dados?.status || "higido");
    setObsEdit(dados?.obs || "");
    setModalDente({ dente });
  }

  function salvarDente() {
    if (statusEdit === "higido" && !obsEdit.trim()) {
      dispatch({ type: "CLEAR_ODONTOGRAMA_DENTE", payload: { pacienteId: pacSel, dente: modalDente.dente } });
    } else {
      dispatch({ type: "UPDATE_ODONTOGRAMA", payload: { pacienteId: pacSel, dente: modalDente.dente, dados: { status: statusEdit, obs: obsEdit } } });
    }
    setModalDente(null);
  }

  function limparDente() {
    dispatch({ type: "CLEAR_ODONTOGRAMA_DENTE", payload: { pacienteId: pacSel, dente: modalDente.dente } });
    setModalDente(null);
  }

  const DENTES = modo === "permanente" ? DENTES_PERM : DENTES_DEC;
  const dentesComRegistro = Object.entries(odo).filter(([,d]) => d.status && d.status !== "higido");
  const ausentes = dentesComRegistro.filter(([,d]) => d.status === "ausente").map(([k]) => k);

  return (
    <div>
      <Card style={{ marginBottom: 14, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Select label="Selecione o paciente" value={pacSel} onChange={e => setPacSel(e.target.value)}>
            <option value="">Escolha um paciente…</option>
            {state.pacientes.map(p => (
              <option key={p.id} value={p.id}>Ficha #{String(p.ficha).padStart(4,"0")} — {p.nome}</option>
            ))}
          </Select>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["permanente","deciduo"].map(m => (
            <button key={m} onClick={() => setModo(m)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: `2px solid ${modo === m ? (m==="permanente"?C.teal:C.amber) : C.border}`,
              background: modo === m ? (m==="permanente"?C.tealLight:C.amberLight) : C.white,
              color: modo === m ? (m==="permanente"?C.teal:C.amber) : C.muted,
            }}>{m === "permanente" ? "Permanente" : "Decíduo"}</button>
          ))}
        </div>
        {paciente && ausentes.length > 0 && (
          <div style={{ fontSize: 12, color: "#C0392B", background: "#FDECEA", borderRadius: 8, padding: "6px 12px" }}>
            Ausentes: {ausentes.join(", ")}
          </div>
        )}
      </Card>

      {!pacSel && (
        <div style={{ textAlign: "center", color: "#6B8399", padding: 60 }}>
          Selecione um paciente para registrar o estado clínico dos dentes.
        </div>
      )}

      {pacSel && (
        <>
          <Card style={{ overflowX: "auto", marginBottom: 14 }}>
            <div style={{ minWidth: 640 }}>
              {/* Legenda de status */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
                {Object.entries(STATUS_CLINICO).map(([k, v]) => (
                  <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: v.cor, border: `1.5px solid ${v.borda}`, display: "inline-block" }} />
                    {v.label}
                  </span>
                ))}
              </div>

              {/* Arco Superior */}
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 4 }}>
                <FileiraDentes numeros={DENTES.supDir} label="SUP. DIREITO →" odo={odo} onDenteClick={abrirDente} />
                <div style={{ width: 1, background: "#D5E3ED", margin: "0 4px" }} />
                <FileiraDentes numeros={DENTES.supEsq} label="← SUP. ESQUERDO" odo={odo} onDenteClick={abrirDente} />
              </div>

              <div style={{ display: "flex", alignItems: "center", margin: "6px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#D5E3ED" }} />
                <span style={{ padding: "0 12px", fontSize: 10, color: "#6B8399", fontWeight: 700, letterSpacing: 1 }}>LINHA MÉDIA</span>
                <div style={{ flex: 1, height: 1, background: "#D5E3ED" }} />
              </div>

              {/* Arco Inferior */}
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 4 }}>
                <FileiraDentes numeros={DENTES.infDir} label="INF. DIREITO →" odo={odo} onDenteClick={abrirDente} />
                <div style={{ width: 1, background: "#D5E3ED", margin: "0 4px" }} />
                <FileiraDentes numeros={DENTES.infEsq} label="← INF. ESQUERDO" odo={odo} onDenteClick={abrirDente} />
              </div>
            </div>
          </Card>

          <div style={{ textAlign: "center", fontSize: 11, color: "#6B8399", marginBottom: 14 }}>
            Clique em um dente para registrar o estado clínico
          </div>

          {/* Resumo de achados clínicos */}
          {dentesComRegistro.length > 0 && (
            <Card style={{ background: "#F0F4F7" }}>
              <div style={{ fontWeight: 700, color: "#1B3A5C", fontSize: 13, marginBottom: 10 }}>📋 RESUMO CLÍNICO</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {dentesComRegistro.map(([dente, dados]) => (
                  <div key={dente} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
                    <span style={{
                      background: STATUS_CLINICO[dados.status]?.cor, color: STATUS_CLINICO[dados.status]?.texto,
                      padding: "2px 8px", borderRadius: 6, fontWeight: 700, minWidth: 36, textAlign: "center",
                      border: `1px solid ${STATUS_CLINICO[dados.status]?.borda}`,
                    }}>{dente}</span>
                    <span style={{ color: "#1A2A3A" }}>{STATUS_CLINICO[dados.status]?.label}</span>
                    {dados.obs && <span style={{ color: "#6B8399", fontStyle: "italic", fontSize: 12 }}>"{dados.obs}"</span>}
                    <button onClick={() => abrirDente(Number(dente))} style={{
                      marginLeft: "auto", background: "none", border: "1px solid #D5E3ED",
                      borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#2A7D8C"
                    }}>editar</button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Modal de edição rápida do dente */}
      {modalDente && (
        <Modal title={`Dente ${modalDente.dente}`} onClose={() => setModalDente(null)}>
          <div style={{ display: "grid", gap: 16 }}>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6B8399", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Estado clínico do dente
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(STATUS_CLINICO).map(([k, v]) => (
                  <button key={k} onClick={() => setStatusEdit(k)} style={{
                    padding: "9px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 12,
                    border: `2px solid ${statusEdit === k ? v.borda : "#D5E3ED"}`,
                    background: statusEdit === k ? v.cor : "#FFFFFF",
                    color: statusEdit === k ? v.texto : "#1A2A3A",
                    fontWeight: statusEdit === k ? 700 : 400,
                  }}>{v.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B8399", textTransform: "uppercase", letterSpacing: 0.5 }}>Observações clínicas</label>
              <textarea value={obsEdit} onChange={e => setObsEdit(e.target.value)}
                placeholder="Anotações sobre este dente…" rows={2}
                style={{ width: "100%", marginTop: 6, border: "1.5px solid #D5E3ED", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ fontSize: 11, color: "#6B8399", background: "#F0F4F7", borderRadius: 8, padding: "8px 12px" }}>
              Este registro é apenas clínico. Para orçar um procedimento neste dente, use a aba Orçamentos.
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <Btn variant="danger" onClick={limparDente}>Limpar</Btn>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setModalDente(null)}>Cancelar</Btn>
                <Btn onClick={salvarDente}>Salvar</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── App principal ──────────────────────────────────────────────────
const GRUPOS = [
  {
    id: "inicio",
    label: "🏠 Início",
    abas: [
      { id: "dashboard", label: "🏠 Início" },
    ],
  },
  {
    id: "administrativo",
    label: "🗂 Administrativo",
    abas: [
      { id: "pacientes", label: "👤 Pacientes" },
      { id: "dentistas", label: "🩺 Dentistas" },
      { id: "convenios", label: "🏥 Convênios" },
      { id: "tabelasPreco", label: "💲 Tabelas de Preço" },
      { id: "usuarios",  label: "👥 Usuários" },
      { id: "impressos", label: "🖨 Impressos" },
    ],
  },
  {
    id: "clinico",
    label: "🩺 Clínico",
    abas: [
      { id: "historico",   label: "📜 Histórico" },
      { id: "odontograma", label: "🦷 Odontograma" },
      { id: "orcamentos",  label: "📋 Orçamentos" },
      { id: "baixas",      label: "✅ Baixa de Proc." },
    ],
  },
  {
    id: "financeiro",
    label: "💼 Financeiro",
    abas: [
      { id: "pagamentos",        label: "💵 Pagamentos" },
      { id: "inadimplencia",     label: "⚠ Inadimplência" },
      { id: "conveniosReceber",  label: "🏥 Conv. a Receber" },
      { id: "repasses",          label: "🔄 Repasses" },
      { id: "caixa",             label: "💰 Caixa" },
      { id: "contasPagar",       label: "📄 Contas a Pagar" },
      { id: "analise",           label: "📊 Análise" },
    ],
  },
];

// Mapa reverso: id da aba → id do grupo, e id da aba → label, para navegação direta
const ABA_PARA_GRUPO = {};
const ABA_LABEL = {};
GRUPOS.forEach(g => g.abas.forEach(a => { ABA_PARA_GRUPO[a.id] = g.id; ABA_LABEL[a.id] = a.label; }));

// ── Login screen ───────────────────────────────────────────────────
function TelaLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [modo, setModo] = useState("login"); // "login" | "cadastro"

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      if (modo === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        onLogin(data.session);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        if (data.user && !data.session) {
          setErro(null);
          alert("Conta criada! Verifique seu e-mail para confirmar o cadastro, depois faça login.");
          setModo("login");
        } else if (data.session) {
          onLogin(data.session);
        }
      }
    } catch (err) {
      const msgMap = {
        "Invalid login credentials": "E-mail ou senha incorretos.",
        "User already registered": "Este e-mail já está cadastrado. Faça login.",
        "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
        "Unable to validate email address: invalid format": "E-mail inválido.",
      };
      setErro(msgMap[err.message] || err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.navy,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: 24,
    }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🦷</div>
        <div style={{ color: C.white, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>DentalPro</div>
        <div style={{ color: "#7AB8CC", fontSize: 14, marginTop: 4 }}>Clínica Odontológica Clear Field</div>
      </div>

      <div style={{
        maxWidth: 400, width: "100%", background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 32,
      }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          <button onClick={() => { setModo("login"); setErro(null); }} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
            background: modo === "login" ? C.teal : "transparent", color: modo === "login" ? C.white : "#7AB8CC",
          }}>Entrar</button>
          <button onClick={() => { setModo("cadastro"); setErro(null); }} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
            background: modo === "cadastro" ? C.teal : "transparent", color: modo === "cadastro" ? C.white : "#7AB8CC",
          }}>Criar conta</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#7AB8CC", textTransform: "uppercase", letterSpacing: 0.5 }}>E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={{
              width: "100%", boxSizing: "border-box", marginTop: 4, padding: "10px 14px", borderRadius: 8,
              border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)",
              color: C.white, fontSize: 14, outline: "none",
            }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#7AB8CC", textTransform: "uppercase", letterSpacing: 0.5 }}>Senha</label>
            <input type="password" required minLength={6} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={{
              width: "100%", boxSizing: "border-box", marginTop: 4, padding: "10px 14px", borderRadius: 8,
              border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)",
              color: C.white, fontSize: 14, outline: "none",
            }} />
          </div>
          {erro && <div style={{ background: C.redLight, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13 }}>⚠ {erro}</div>}
          <button type="submit" disabled={carregando} style={{
            padding: "12px 0", borderRadius: 8, border: "none", background: C.teal, color: C.white,
            fontSize: 15, fontWeight: 700, cursor: carregando ? "not-allowed" : "pointer",
            opacity: carregando ? 0.6 : 1, transition: "opacity .15s",
          }}>{carregando ? "Aguarde…" : modo === "login" ? "Entrar" : "Criar conta"}</button>
        </form>
      </div>

      <div style={{ color: "#4A7A9B", fontSize: 11, marginTop: 32 }}>
        Acesso seguro via Supabase Auth · Dados protegidos por RLS
      </div>
    </div>
  );
}

// ── Interceptador de dispatch para persistir pacientes no Supabase ──
// Retorna um dispatch wrapper que intercepta ADD_PACIENTE e DELETE_PACIENTE
function pacienteFromRow(p) {
  return {
    id: p.id,
    _supabaseId: p.id,
    ficha: p.ficha,
    nome: p.nome,
    nomeSocial: p.nome_social || false,
    nomeCivil: p.nome_civil || "",
    dataNasc: p.data_nasc || "",
    cpf: p.cpf || "",
    rg: p.rg || "",
    telefone: p.telefone || "",
    email: p.email_paciente || "",
    responsavel: p.responsavel || "",
    obs: p.obs || "",
    endereco: {
      rua: p.rua || "",
      numero: p.numero || "",
      complemento: p.complemento || "",
      bairro: p.bairro || "",
      cep: p.cep || "",
      cidade: p.cidade || "",
      estado: p.estado || "",
    },
  };
}

function tabelaPrecoFromRow(t) {
  return {
    id: t.id,
    nome: t.nome,
    tipo: t.tipo,
    convenioId: t.convenio_id || null,
    ativo: t.ativo,
    padrao: t.padrao,
    itens: Array.isArray(t.itens) ? t.itens : [],
  };
}

function orcamentoFromRow(o) {
  return {
    id: o.id,
    pacienteId: o.paciente_id,
    data: o.data,
    dentista: o.dentista,
    convenioId: o.convenio_id || null,
    convenioNome: o.convenio_nome || null,
    tabelaPrecoId: o.tabela_preco_id || null,
    tabelaPrecoNome: o.tabela_preco_nome || null,
    itens: Array.isArray(o.itens) ? o.itens : [],
    status: o.status,
    createdAt: o.created_at,
  };
}

function historicoFromRow(h) {
  return {
    id: h.id,
    pacienteId: h.paciente_id,
    tipo: h.tipo,
    data: h.data,
    dentista: h.dentista || "",
    texto: h.texto,
    baixaIds: Array.isArray(h.baixa_ids) ? h.baixa_ids : [],
  };
}

function useSupabaseDispatch(dispatch, session, pacientesRef) {
  return useCallback((action) => {
    async function run() {
      if (action.type === "ADD_PACIENTE") {
        const payload = action.payload;
        // Aguarda o banco gerar o UUID e a ficha sequencial.
        const proximaFicha = pacientesRef.current.reduce(
          (maior, paciente) => Math.max(maior, Number(paciente.ficha) || 0),
          0
        ) + 1;
        const { data, error } = await supabase.from("pacientes").insert({
          user_id: session.user.id,
          ficha: proximaFicha,
          nome: payload.nome,
          nome_social: payload.nomeSocial || false,
          nome_civil: payload.nomeCivil || "",
          data_nasc: payload.dataNasc || null,
          cpf: payload.cpf || "",
          rg: payload.rg || "",
          telefone: payload.telefone || "",
          email_paciente: payload.email || "",
          responsavel: payload.responsavel || "",
          obs: payload.obs || "",
          rua: payload.endereco?.rua || "",
          numero: payload.endereco?.numero || "",
          complemento: payload.endereco?.complemento || "",
          bairro: payload.endereco?.bairro || "",
          cep: payload.endereco?.cep || "",
          cidade: payload.endereco?.cidade || "",
          estado: payload.endereco?.estado || "",
        }).select().single();
        if (error) {
          console.error("Erro ao salvar paciente no Supabase:", error);
          window.alert(`Não foi possível salvar o paciente: ${error.message}`);
          return false;
        }
        dispatch({ type: "ADD_PACIENTE_PERSISTED", payload: pacienteFromRow(data) });
        return true;
      } else if (action.type === "UPDATE_PACIENTE") {
        const p = action.payload;
        const { data, error } = await supabase.from("pacientes").update({
          nome: p.nome, nome_social: p.nomeSocial || false, nome_civil: p.nomeCivil || "",
          data_nasc: p.dataNasc || null, cpf: p.cpf || "", rg: p.rg || "",
          telefone: p.telefone || "", email_paciente: p.email || "",
          responsavel: p.responsavel || "", obs: p.obs || "",
          rua: p.endereco?.rua || "", numero: p.endereco?.numero || "",
          complemento: p.endereco?.complemento || "", bairro: p.endereco?.bairro || "",
          cep: p.endereco?.cep || "", cidade: p.endereco?.cidade || "",
          estado: p.endereco?.estado || "", updated_at: new Date().toISOString(),
        }).eq("id", p._supabaseId || p.id).select().single();
        if (error) {
          window.alert(`Não foi possível atualizar o paciente: ${error.message}`);
          return false;
        }
        dispatch({ type: "UPDATE_PACIENTE", payload: pacienteFromRow(data) });
        return true;
      } else if (action.type === "ADD_ORCAMENTO") {
        const o = action.payload;
        const { data, error } = await supabase.from("orcamentos").insert({
          user_id: session.user.id, paciente_id: o.pacienteId, data: o.data,
          dentista: o.dentista, convenio_id: o.convenioId ? String(o.convenioId) : null,
          convenio_nome: o.convenioNome, tabela_preco_id: o.tabelaPrecoId,
          tabela_preco_nome: o.tabelaPrecoNome, itens: o.itens, status: "pendente",
        }).select().single();
        if (error) { window.alert(`Não foi possível salvar o orçamento: ${error.message}`); return false; }
        dispatch({ type: "ADD_ORCAMENTO_PERSISTED", payload: orcamentoFromRow(data) });
        return true;
      } else if (action.type === "APROVAR_ORCAMENTO") {
        const { data, error } = await supabase.from("orcamentos")
          .update({ status: "aprovado", updated_at: new Date().toISOString() })
          .eq("id", action.payload).select().single();
        if (error) { window.alert(`Não foi possível aprovar o orçamento: ${error.message}`); return false; }
        dispatch({ type: "APROVAR_ORCAMENTO_PERSISTED", payload: orcamentoFromRow(data) });
        return true;
      } else if (action.type === "ADD_HISTORICO") {
        const h = action.payload;
        const { data, error } = await supabase.from("historico_clinico").insert({
          user_id: session.user.id, paciente_id: h.pacienteId, tipo: h.tipo,
          data: h.data, dentista: h.dentista || null, texto: h.texto, baixa_ids: h.baixaIds || [],
        }).select().single();
        if (error) { window.alert(`Não foi possível salvar o registro clínico: ${error.message}`); return false; }
        dispatch({ type: "ADD_HISTORICO_PERSISTED", payload: historicoFromRow(data) });
        return true;
      } else if (action.type === "UPDATE_HISTORICO") {
        const h = action.payload;
        const { data, error } = await supabase.from("historico_clinico").update({
          tipo: h.tipo, data: h.data, dentista: h.dentista || null,
          texto: h.texto, baixa_ids: h.baixaIds || [], updated_at: new Date().toISOString(),
        }).eq("id", h.id).select().single();
        if (error) { window.alert(`Não foi possível atualizar o registro clínico: ${error.message}`); return false; }
        dispatch({ type: "UPDATE_HISTORICO_PERSISTED", payload: historicoFromRow(data) });
        return true;
      } else if (action.type === "DELETE_HISTORICO") {
        const { error } = await supabase.from("historico_clinico").delete().eq("id", action.payload);
        if (error) { window.alert(`Não foi possível excluir o registro clínico: ${error.message}`); return false; }
        dispatch({ type: "DELETE_HISTORICO_PERSISTED", payload: action.payload });
        return true;
      } else if (action.type === "ADD_TABELA_PRECO") {
        const p = action.payload;
        if (p.padrao) {
          await supabase.from("tabelas_preco").update({ padrao: false }).eq("user_id", session.user.id);
          dispatch({ type: "UNSET_DEFAULT_TABELAS_PRECO" });
        }
        const { data, error } = await supabase.from("tabelas_preco").insert({
          user_id: session.user.id, nome: p.nome, tipo: p.tipo,
          convenio_id: p.convenioId ? String(p.convenioId) : null,
          ativo: p.ativo, padrao: p.padrao, itens: p.itens,
        }).select().single();
        if (error) { window.alert(`Não foi possível salvar a tabela: ${error.message}`); return; }
        dispatch({ type: "ADD_TABELA_PRECO_PERSISTED", payload: tabelaPrecoFromRow(data) });
      } else if (action.type === "UPDATE_TABELA_PRECO") {
        const p = action.payload;
        if (p.padrao) {
          await supabase.from("tabelas_preco").update({ padrao: false }).eq("user_id", session.user.id).neq("id", p.id);
          dispatch({ type: "UNSET_DEFAULT_TABELAS_PRECO" });
        }
        const { data, error } = await supabase.from("tabelas_preco").update({
          nome: p.nome, tipo: p.tipo, convenio_id: p.convenioId ? String(p.convenioId) : null,
          ativo: p.ativo, padrao: p.padrao, itens: p.itens, updated_at: new Date().toISOString(),
        }).eq("id", p.id).select().single();
        if (error) { window.alert(`Não foi possível atualizar a tabela: ${error.message}`); return; }
        dispatch({ type: "UPDATE_TABELA_PRECO_PERSISTED", payload: tabelaPrecoFromRow(data) });
      } else if (action.type === "DELETE_TABELA_PRECO") {
        const { error } = await supabase.from("tabelas_preco").delete().eq("id", action.payload);
        if (error) { window.alert(`Não foi possível excluir a tabela: ${error.message}`); return; }
        dispatch({ type: "DELETE_TABELA_PRECO_PERSISTED", payload: action.payload });
      } else if (action.type === "DELETE_PACIENTE") {
        const pacienteId = action.payload;
        const paciente = pacientesRef.current.find(p => p.id === pacienteId);
        if (paciente?._supabaseId) {
          await supabase.from("pacientes").delete().eq("id", paciente._supabaseId);
        }
        dispatch(action);
      } else {
        dispatch(action);
        return true;
      }
    }
    return run();
  }, [dispatch, session, pacientesRef]);
}

// ── App principal ──────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tab, setTab] = useState("dashboard");
  const [grupoAberto, setGrupoAberto] = useState("inicio");
  const [avisoImport, setAvisoImport] = useState(null);
  const [usuarioAtivo, setUsuarioAtivo] = useState(null);
  const [pacientesLoaded, setPacientesLoaded] = useState(false);
  const inputImportRef = useRef(null);
  const pacientesRef = useRef(state.pacientes);
  const dbDispatch = useSupabaseDispatch(dispatch, session, pacientesRef);

  // Manter ref atualizada
  useEffect(() => { pacientesRef.current = state.pacientes; }, [state.pacientes]);

  // ── Auth: ouvir mudanças de sessão ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setUsuarioAtivo(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Carregar pacientes do Supabase ao autenticar ──
  useEffect(() => {
    if (!session) return;
    async function load() {
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("user_id", session.user.id)
        .order("ficha", { ascending: true });
      if (error) { console.error("Erro ao carregar pacientes:", error); return; }
      dispatch({ type: "LOAD_PACIENTES", payload: (data || []).map(pacienteFromRow) });
      setPacientesLoaded(true);
    }
    load();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function loadTabelasPreco() {
      const { data, error } = await supabase
        .from("tabelas_preco")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });
      if (error) { console.error("Erro ao carregar tabelas de preço:", error); return; }
      dispatch({ type: "LOAD_TABELAS_PRECO", payload: (data || []).map(tabelaPrecoFromRow) });
    }
    loadTabelasPreco();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function loadOrcamentos() {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) { console.error("Erro ao carregar orçamentos:", error); return; }
      dispatch({ type: "LOAD_ORCAMENTOS", payload: (data || []).map(orcamentoFromRow) });
    }
    loadOrcamentos();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function loadHistorico() {
      const { data, error } = await supabase
        .from("historico_clinico")
        .select("*")
        .eq("user_id", session.user.id)
        .order("data", { ascending: false });
      if (error) { console.error("Erro ao carregar histórico clínico:", error); return; }
      dispatch({ type: "LOAD_HISTORICO", payload: (data || []).map(historicoFromRow) });
    }
    loadHistorico();
  }, [session]);

  // ── Interceptador: ADD_PACIENTE usa dbDispatch para gravar no Supabase ──
  const patchedDispatch = useCallback((action) => {
    if (["ADD_PACIENTE", "UPDATE_PACIENTE", "DELETE_PACIENTE", "ADD_ORCAMENTO", "APROVAR_ORCAMENTO", "ADD_HISTORICO", "UPDATE_HISTORICO", "DELETE_HISTORICO", "ADD_TABELA_PRECO", "UPDATE_TABELA_PRECO", "DELETE_TABELA_PRECO"].includes(action.type)) {
      return dbDispatch(action);
    } else {
      dispatch(action);
      return Promise.resolve(true);
    }
  }, [dbDispatch]);

  function irPara(tabId) {
    setTab(tabId);
    setGrupoAberto(ABA_PARA_GRUPO[tabId] || grupoAberto);
  }

  function abrirGrupo(grupoId) {
    setGrupoAberto(grupoId);
    if (ABA_PARA_GRUPO[tab] !== grupoId) {
      const primeira = GRUPOS.find(g => g.id === grupoId)?.abas[0]?.id;
      if (primeira) setTab(primeira);
    }
  }

  function exportarBackup() {
    const dados = JSON.stringify(state, null, 2);
    const blob = new Blob([dados], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const carimbo = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    a.href = url;
    a.download = `dentalpro-backup-${carimbo}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUsuarioAtivo(null);
  }

  function abrirSeletorImport() { inputImportRef.current?.click(); }

  function handleArquivoSelecionado(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (evt) => {
      try {
        const dados = JSON.parse(evt.target.result);
        if (!Array.isArray(dados.pacientes)) throw new Error();
        dispatch({ type: "IMPORT_DATA", payload: dados });
        setAvisoImport({ tipo: "ok", msg: `Backup importado: ${dados.pacientes.length} paciente(s) carregado(s).` });
      } catch {
        setAvisoImport({ tipo: "erro", msg: "Arquivo inválido. Verifique se é um backup do DentalPro." });
      }
      e.target.value = "";
    };
    leitor.readAsText(arquivo);
  }

  // ── Loading state ──
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🦷</div>
          <div style={{ color: "#7AB8CC", fontSize: 14 }}>Carregando…</div>
        </div>
      </div>
    );
  }

  // ── Sem sessão → tela de login ──
  if (!session) {
    return <TelaLogin onLogin={(s) => setSession(s)} />;
  }

  // ── Sessão ativa, mas sem selecionar "quem está usando" ──
  if (!usuarioAtivo) {
    return (
      <div>
        <div style={{ position: "fixed", top: 12, right: 16, zIndex: 200 }}>
          <button onClick={handleLogout} style={{
            background: "transparent", color: "#A0C4D5", border: "1px solid #2A4A6C", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>Sair da conta</button>
        </div>
        <TelaSelecaoUsuario
          usuarios={state.usuarios}
          onSelecionar={u => { setUsuarioAtivo(u); setTab("dashboard"); setGrupoAberto("inicio"); }}
        />
      </div>
    );
  }

  const grupoAtual = GRUPOS.find(g => g.id === grupoAberto);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', 'Segoe UI', sans-serif", color: C.text }}>
      {/* Header — nível 1: grupos */}
      <div style={{ background: C.navy, padding: "0 16px", display: "flex", alignItems: "center", gap: 12, minHeight: 56 }}>
        <button onClick={() => { setTab("dashboard"); setGrupoAberto("inicio"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ color: C.white, fontWeight: 800, fontSize: 17, letterSpacing: -0.5 }}>🦷 DentalPro</span>
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {GRUPOS.map(g => (
            <button key={g.id} onClick={() => abrirGrupo(g.id)} style={{
              background: grupoAberto === g.id ? C.teal : "transparent",
              color: grupoAberto === g.id ? C.white : "#A0C4D5",
              border: "none", borderRadius: 8,
              padding: "7px 14px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", transition: "all .15s",
            }}>{g.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, borderLeft: "1px solid #2A4A6C", paddingLeft: 12, marginLeft: 4, alignItems: "center" }}>
          {/* Usuário ativo */}
          <span style={{ color: "#7AB8CC", fontSize: 12, whiteSpace: "nowrap" }}>
            {usuarioAtivo.perfil === "Dentista" ? "🩺" : "👤"} {usuarioAtivo.nome.split(" ")[0]}
          </span>
          <button onClick={() => setUsuarioAtivo(null)} title="Trocar usuário" style={{
            background: "transparent", color: "#A0C4D5", border: "1px solid #2A4A6C", borderRadius: 8,
            padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>Trocar</button>
          <button onClick={exportarBackup} style={{
            background: "transparent", color: "#A0C4D5", border: "1px solid #2A4A6C", borderRadius: 8,
            padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>💾 Backup</button>
          <button onClick={abrirSeletorImport} style={{
            background: "transparent", color: "#A0C4D5", border: "1px solid #2A4A6C", borderRadius: 8,
            padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>📂 Importar</button>
          <input ref={inputImportRef} type="file" accept="application/json" onChange={handleArquivoSelecionado} style={{ display: "none" }} />
          <button onClick={handleLogout} style={{
            background: "transparent", color: "#A0C4D5", border: "1px solid #2A4A6C", borderRadius: 8,
            padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>Sair</button>
        </div>
      </div>

      {/* Aviso de importação */}
      {avisoImport && (
        <div style={{
          background: avisoImport.tipo === "ok" ? C.greenLight : C.redLight,
          color: avisoImport.tipo === "ok" ? C.green : C.red,
          padding: "10px 24px", fontSize: 13, fontWeight: 600,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{avisoImport.tipo === "ok" ? "✓" : "⚠"} {avisoImport.msg}</span>
          <button onClick={() => setAvisoImport(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "inherit" }}>×</button>
        </div>
      )}

      {/* Sub-navegação — nível 2 */}
      {grupoAtual && grupoAtual.abas.length > 1 && (
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {grupoAtual.abas.map(a => (
            <button key={a.id} onClick={() => irPara(a.id)} style={{
              background: "transparent",
              color: tab === a.id ? C.teal : C.muted,
              border: "none",
              borderBottom: tab === a.id ? `3px solid ${C.teal}` : "3px solid transparent",
              padding: "10px 14px", fontSize: 13, fontWeight: tab === a.id ? 700 : 500,
              cursor: "pointer", transition: "all .15s",
            }}>{a.label}</button>
          ))}
        </div>
      )}

      {/* Conteúdo */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        {tab !== "dashboard" && (
          <h2 style={{ margin: "0 0 20px", color: C.navy, fontSize: 22, fontWeight: 800 }}>
            {ABA_LABEL[tab]}
          </h2>
        )}

        {tab === "dashboard"        && <Dashboard state={state} usuario={usuarioAtivo} onTrocarUsuario={() => setUsuarioAtivo(null)} />}
        {tab === "usuarios"         && <GerenciarUsuarios state={state} dispatch={patchedDispatch} />}
        {tab === "pacientes"        && <Pacientes state={state} dispatch={patchedDispatch} />}
        {tab === "dentistas"        && <Dentistas state={state} dispatch={patchedDispatch} />}
        {tab === "convenios"        && <Convenios state={state} dispatch={patchedDispatch} />}
        {tab === "tabelasPreco"     && <TabelasPreco state={state} dispatch={patchedDispatch} />}
        {tab === "impressos"        && <Impressos state={state} />}
        {tab === "historico"        && <HistoricoClinico state={state} dispatch={patchedDispatch} onCriarOrcamento={() => irPara("orcamentos")} />}
        {tab === "odontograma"      && <Odontograma state={state} dispatch={patchedDispatch} />}
        {tab === "orcamentos"       && <Orcamentos state={state} dispatch={patchedDispatch} />}
        {tab === "baixas"           && <Baixas state={state} dispatch={patchedDispatch} />}
        {tab === "pagamentos"       && <Pagamentos state={state} dispatch={patchedDispatch} />}
        {tab === "inadimplencia"    && <Inadimplencia state={state} dispatch={patchedDispatch} />}
        {tab === "conveniosReceber" && <ConveniosReceber state={state} dispatch={patchedDispatch} />}
        {tab === "repasses"         && <Repasses state={state} dispatch={patchedDispatch} />}
        {tab === "caixa"            && <Caixa state={state} dispatch={patchedDispatch} />}
        {tab === "contasPagar"      && <ContasPagar state={state} dispatch={patchedDispatch} />}
        {tab === "analise"          && <Analise state={state} />}
      </div>
    </div>
  );
}
