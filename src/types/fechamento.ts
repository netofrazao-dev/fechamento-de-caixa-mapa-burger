export type Turno = 'manha' | 'noite'

export type StatusFechamento = 'fechou' | 'sobrou' | 'faltou'

export type TipoAjuste = 'adicionar' | 'remover' | null

/** Dados que o usuário preenche para o LC. */
export interface DadosLC {
  dinheiroAbertura: number
  dinheiroFechamento: number
  pix: number
  debito: number
  credito: number
  consumoLoja: number
  aPrazo: number
  ticket: number
}

/** Dados que o usuário preenche para o Brendi. */
export interface DadosBrendi {
  pix: number
  debito: number
  credito: number
  creditoOnline: number
  dinheiro: number
}

/** Uma sangria: retirada de dinheiro do caixa durante o expediente. */
export interface Sangria {
  id?: string
  valor: number
  motivo: string
}

/** Ajuste manual aplicado sobre a diferença original. */
export interface Ajuste {
  tipo: TipoAjuste
  valor: number
}

/** Totais e resultado calculados a partir dos dados acima. */
export interface ResultadoCalculado {
  totalLC: number
  totalBrendi: number
  totalCaixa: number
  totalSistema: number
  diferencaOriginal: number
  ajusteAplicado: number
  diferencaFinal: number
  status: StatusFechamento
}

/** Um fechamento completo, como fica salvo no banco. */
export interface Fechamento {
  id: string
  data: string // YYYY-MM-DD
  turno: Turno
  createdAt: string

  lc: DadosLC
  brendi: DadosBrendi
  sangrias: Sangria[]

  totalLCSistema: number
  ajuste: Ajuste
  observacoes: string

  resultado: ResultadoCalculado
}

/** Payload usado ao criar um novo fechamento (sem id/createdAt/resultado). */
export interface NovoFechamentoInput {
  data: string
  turno: Turno
  lc: DadosLC
  brendi: DadosBrendi
  sangrias: Sangria[]
  totalLCSistema: number
  ajuste: Ajuste
  observacoes: string
}

// ============================================================
// Relatório livre — sem relação com o fechamento de caixa.
// Modelo flexível: título + data + lista de campos livres
// (rótulo + texto), pra caber em qualquer relatório escrito.
// ============================================================

export interface ItemRelatorio {
  id?: string
  label: string
  valor: string
}

export interface Relatorio {
  id: string
  titulo: string
  data: string // YYYY-MM-DD
  itens: ItemRelatorio[]
  createdAt: string
  updatedAt: string
}

export interface RelatorioInput {
  titulo: string
  data: string
  itens: ItemRelatorio[]
}
