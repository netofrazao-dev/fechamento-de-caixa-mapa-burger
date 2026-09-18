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
  marmitasVendidas: number

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
  marmitasVendidas: number
  totalLCSistema: number
  ajuste: Ajuste
  observacoes: string
}

// ============================================================
// Relatório diário escrito — sem relação com o fechamento de
// caixa. Estrutura fixa, igual ao modelo usado no dia a dia.
// ============================================================

/** Uma pessoa (funcionário, cliente ou motoboy) consumindo algo da loja. */
export interface ConsumoItem {
  id?: string
  pessoa: string
  item: string
  valor: number
}

/** Quantidade de um produto contado no estoque. */
export interface EstoqueItem {
  produto: string
  quantidade: number
}

/** Uma contagem de estoque (início ou final do expediente). */
export interface EstoqueSnapshot {
  dataHora: string // ISO datetime-local, ex: 2026-04-22T08:24
  itens: EstoqueItem[]
}

export interface RelatorioDiario {
  id: string
  data: string // YYYY-MM-DD

  aberturaCaixa: number
  fechamentoCaixa: number
  quantidadeVendida: number

  estragou: string[]
  funcionariosQueComeram: string[]

  consumoLojaMensal: ConsumoItem[]
  consumoLojaMotoboys: ConsumoItem[]
  cortesiaClientes: ConsumoItem[]

  sangrias: Sangria[]

  estoqueInicio: EstoqueSnapshot
  estoqueFinal: EstoqueSnapshot
  estoqueQuente: string[]

  createdAt: string
  updatedAt: string
}

export interface RelatorioDiarioInput {
  data: string
  aberturaCaixa: number
  fechamentoCaixa: number
  quantidadeVendida: number
  estragou: string[]
  funcionariosQueComeram: string[]
  consumoLojaMensal: ConsumoItem[]
  consumoLojaMotoboys: ConsumoItem[]
  cortesiaClientes: ConsumoItem[]
  sangrias: Sangria[]
  estoqueInicio: EstoqueSnapshot
  estoqueFinal: EstoqueSnapshot
  estoqueQuente: string[]
}

/** Um funcionário cadastrado (pra selecionar em vez de digitar o nome). */
export interface Funcionario {
  id: string
  nome: string
}
