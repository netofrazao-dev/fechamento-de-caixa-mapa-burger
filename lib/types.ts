// types.ts — todos os tipos do sistema em um único lugar

// ─── Fechamento ───────────────────────────────────────────────

export interface Fechamento {
  id:              string
  created_at:      string
  data_fechamento: string

  // LC — só exibição (não entram em cálculo)
  dinheiro_abertura_lc: number
  sangria_lc:           number

  // LC — entram no totalLC
  dinheiro_fechamento_lc: number
  pix_lc:                 number
  debito_lc:              number
  credito_lc:             number
  consumo_loja_lc:        number
  a_prazo_lc:             number
  ticket_lc:              number

  // Brandy — só exibição (entra no totalSistema, não no totalBrandy)
  dinheiro_brandy: number

  // Brandy — entram no totalBrandy
  pix_brandy:            number
  debito_brandy:         number
  credito_brandy:        number
  credito_online_brandy: number

  // Totais calculados
  total_lc:         number
  total_brandy:     number
  total_caixa:      number
  total_lc_sistema: number
  total_sistema:    number

  // Resultado
  diferenca:       number
  ajuste_manual:   number
  diferenca_final: number

  status:      StatusCaixa
  observacoes: string | null
}

// Campos visíveis no histórico (subset do Fechamento)
export type FechamentoResumo = Pick<
  Fechamento,
  | 'id'
  | 'created_at'
  | 'data_fechamento'
  | 'total_caixa'
  | 'total_sistema'
  | 'diferenca_final'
  | 'ajuste_manual'
  | 'status'
  | 'observacoes'
>

// ─── Status ───────────────────────────────────────────────────

export type StatusCaixa =
  | 'CAIXA FECHOU'
  | 'SOBROU DINHEIRO'
  | 'FALTOU DINHEIRO'

// ─── Formulário ───────────────────────────────────────────────

export type FormValues = Omit<Fechamento, 'id' | 'created_at'>

// ─── Toast ────────────────────────────────────────────────────

export interface Toast {
  type:    'success' | 'error'
  title:   string
  message: string
}