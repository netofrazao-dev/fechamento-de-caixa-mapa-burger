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

/** Um lançamento de vendas de um prato específico (contador). */
export interface MarmitaItem {
  prato: string
  quantidade: number
}

/** Um prato cadastrado (pra contar cliques em vez de digitar número). */
export interface Prato {
  id: string
  nome: string
  /** false = desativado (some da lista de seleção, histórico continua). */
  ativo: boolean
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
  marmitas: MarmitaItem[]

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
  marmitas: MarmitaItem[]
  totalLCSistema: number
  ajuste: Ajuste
  observacoes: string
}

// ============================================================
// Relatório diário escrito — estrutura fixa, igual ao modelo
// usado no dia a dia. Fica "ligado" ao fechamento de caixa pela
// mesma data (sem misturar os dados dos dois).
// ============================================================

/** Uma pessoa (funcionário, cliente ou motoboy) consumindo algo da loja. */
export interface ConsumoItem {
  id?: string
  pessoa: string
  item: string
  valor: number
  /** Id do funcionário no cadastro (consumo loja mensal). Nos antigos pode faltar. */
  funcionarioId?: string | null
}

/** Quantidade de um produto contado no estoque. */
export interface EstoqueItem {
  produto: string
  quantidade: number
}

/** Uma contagem de estoque — usada só no "Estoque quente". */
export interface EstoqueSnapshot {
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

  estoqueQuente: EstoqueSnapshot

  /** Prints/imagens anexadas (base64) — só entram no PDF de envio, não na impressão. */
  imagem1?: string | null
  imagem2?: string | null

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
  estoqueQuente: EstoqueSnapshot
  imagem1?: string | null
  imagem2?: string | null
}

/** Um funcionário cadastrado (pra selecionar em vez de digitar o nome). */
export interface Funcionario {
  id: string
  nome: string
  /** false = desativado (saiu da empresa): some da lista, histórico continua. */
  ativo: boolean
}

/** Uma linha da auditoria geral (fechamentos, relatórios, cadastros). */
export interface RegistroAuditoria {
  id: number
  registradoEm: string
  tabela: string
  operacao: 'insert' | 'update' | 'delete'
  registroId: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  usuario: string | null
}

// ============================================================
// Vales (adiantamento de salário) — sistema totalmente separado
// do fechamento de caixa e do relatório diário.
// ============================================================

export interface Vale {
  id: string
  /** Id no cadastro de funcionários (null só em dados antigos, antes da migração v2). */
  funcionarioId: string | null
  /** Nome do funcionário (sempre o nome do cadastro). */
  funcionario: string
  data: string // YYYY-MM-DD
  valor: number
  observacao: string
  createdAt: string
  updatedAt: string | null
  /** Preenchido quando o vale foi excluído (nunca é apagado de verdade). */
  excluidoEm: string | null
  motivoExclusao: string | null
}

export interface ValeInput {
  funcionario: string
  data: string
  valor: number
  observacao: string
}

/** Resumo de um funcionário guardado no fechamento do mês. */
export interface ResumoFechamentoVale {
  funcionarioId: string | null
  funcionario: string
  total: number
  quantidade: number
}

/** Mês de vales fechado (já descontado na folha) — fica travado. */
export interface MesValesFechado {
  mes: string // YYYY-MM
  fechadoEm: string
  total: number
  quantidade: number
  resumo: ResumoFechamentoVale[]
  observacao: string | null
}

export type OperacaoHistoricoVale =
  | 'criado'
  | 'alterado'
  | 'excluido'
  | 'restaurado'
  | 'mes_fechado'
  | 'mes_reaberto'

/** Uma linha do histórico de alterações dos vales. */
export interface HistoricoVale {
  id: number
  registradoEm: string
  operacao: OperacaoHistoricoVale
  valeId: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  detalhe: string | null
}

// ============================================================
// Acerto do mês: vales + consumo da loja = total a descontar
// ============================================================

/** Resumo de um funcionário gravado quando o acerto é fechado. */
export interface ResumoAcerto {
  funcionarioId: string | null
  funcionario: string
  vales: number
  qtdVales: number
  consumo: number
  qtdConsumo: number
  total: number
}

export interface AcertoFechado {
  mes: string // YYYY-MM
  fechadoEm: string
  total: number
  totalVales: number
  totalConsumo: number
  resumo: ResumoAcerto[]
  observacao: string | null
  usuario: string | null
}
