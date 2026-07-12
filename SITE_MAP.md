# DentalPro — Site Map

## Estrutura de Módulos

### 🏠 Início
| Aba | Descrição |
|-----|-----------|
| dashboard | Dashboard com resumo financeiro, aniversariantes, alertas |

### 🗂 Administrativo
| Aba | Descrição |
|-----|-----------|
| pacientes | Cadastro e ficha completa de pacientes |
| dentistas | Cadastro de profissionais (dentistas) |
| convenios | Cadastro de convênios odontológicos |
| usuarios | Gerenciamento de usuários do sistema |
| impressos | Documentos (atestado, recibo, declaração, contrato, termo) |

### 🩺 Clínico
| Aba | Descrição |
|-----|-----------|
| historico | Histórico clínico do paciente |
| odontograma | Mapa odontológico (dentário) |
| orcamentos | Orçamentos de procedimentos |
| baixas | Baixa de procedimentos realizados |

### 💼 Financeiro
| Aba | Descrição |
|-----|-----------|
| pagamentos | Registro de pagamentos de pacientes |
| inadimplencia | Controle de inadimplência |
| conveniosReceber | Recebimentos de convênios |
| repasses | Repasses para dentistas |
| caixa | Fluxo de caixa (entradas e saídas) |
| contasPagar | Contas a pagar (despesas fixas/variáveis) |
| analise | Análise financeira consolidada |

## Entidades (Supabase)
- `pacientes` — ✅ Persistente (migrado nesta task)
- `orcamentos` — Pendente
- `baixas` — Pendente
- `pagamentos` — Pendente
- `caixa` — Pendente
- `contas_pagar` — Pendente
- `historico_clinico` — Pendente
- `convenios` — Pendente
- `recebimentos_convenio` — Pendente
- `dentistas` — Pendente
- `usuarios` — Pendente (via Supabase Auth)
- `odontogramas` — Pendente
