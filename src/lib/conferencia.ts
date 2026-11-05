/**
 * Conferências do fechamento antes de salvar.
 * - erros: impedem salvar.
 * - avisos: aparecem para a pessoa confirmar ("está certo, salvar").
 */
import type { DadosBrendi, DadosLC, NovoFechamentoInput, ResultadoCalculado } from '../types/fechamento'
import { calcularResultado, formatarMoeda } from './calculations'
import { dataValida } from './vales'
import { formatarDataBr } from './datas'

/** Diferença a partir da qual pedimos uma observação explicando. */
export const DIFERENCA_RELEVANTE = 20

export function errosFechamento(input: NovoFechamentoInput): string[] {
  const erros: string[] = []
  if (!dataValida(input.data)) erros.push('Informe uma data válida.')
  if (input.sangrias.some((s) => s.valor > 0 && !s.motivo.trim())) {
    erros.push('Toda sangria com valor precisa ter um motivo escrito.')
  }
  if (input.ajuste.tipo && input.ajuste.valor > 0 && !input.observacoes.trim()) {
    erros.push('Quando há ajuste manual, escreva uma observação explicando o motivo.')
  }
  if (input.observacoes.length > 2000) erros.push('As observações passam de 2000 letras.')
  return erros
}

/** Dias recentes, usados para perceber valor fora do normal. */
export interface DiaHistorico {
  lc: DadosLC
  brendi: DadosBrendi
  totalLCSistema: number
}

/** Precisa de pelo menos tantos dias de histórico para comparar. */
export const MINIMO_DIAS_HISTORICO = 5

const CAMPOS: { rotulo: string; valor: (d: DiaHistorico) => number }[] = [
  { rotulo: 'Dinheiro no fechamento', valor: (d) => d.lc.dinheiroFechamento },
  { rotulo: 'PIX (LC)', valor: (d) => d.lc.pix },
  { rotulo: 'Débito (LC)', valor: (d) => d.lc.debito },
  { rotulo: 'Crédito (LC)', valor: (d) => d.lc.credito },
  { rotulo: 'Consumo da loja', valor: (d) => d.lc.consumoLoja },
  { rotulo: 'A prazo', valor: (d) => d.lc.aPrazo },
  { rotulo: 'Ticket', valor: (d) => d.lc.ticket },
  { rotulo: 'PIX (Brendi)', valor: (d) => d.brendi.pix },
  { rotulo: 'Débito (Brendi)', valor: (d) => d.brendi.debito },
  { rotulo: 'Crédito (Brendi)', valor: (d) => d.brendi.credito },
  { rotulo: 'Crédito online (Brendi)', valor: (d) => d.brendi.creditoOnline },
  { rotulo: 'Dinheiro do Brendi', valor: (d) => d.brendi.dinheiro },
  { rotulo: 'Total LC Sistema', valor: (d) => d.totalLCSistema },
]

/** Valor mínimo para avisar (abaixo disso, mesmo que pareça alto, não incomoda). */
const VALOR_MINIMO_AVISO = 1000

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b)
  if (v.length === 0) return 0
  const meio = Math.floor(v.length / 2)
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
}

/**
 * Valor que foge muito do normal dos últimos dias (ex.: "15050" em vez de "150,50",
 * ou valor digitado no campo errado). Só avisa: a pessoa confirma se estiver certo.
 */
export function avisosValoresFora(input: DiaHistorico, historico: DiaHistorico[]): string[] {
  if (historico.length < MINIMO_DIAS_HISTORICO) return []
  const avisos: string[] = []
  const n = historico.length
  for (const campo of CAMPOS) {
    const atual = campo.valor(input)
    if (!(atual > 0)) continue
    const maior = Math.max(...historico.map(campo.valor), 0)
    if (atual <= Math.max(3 * maior, VALOR_MINIMO_AVISO)) continue
    avisos.push(
      maior > 0
        ? `${campo.rotulo}: ${formatarMoeda(atual)} é bem mais que o normal (no máximo ${formatarMoeda(maior)} nos últimos ${n} dias). ` +
            'Confira se não sobrou um zero ou faltou a vírgula.'
        : `${campo.rotulo}: ${formatarMoeda(atual)}, mas esse campo ficou zerado nos últimos ${n} dias. Confira se o valor está no campo certo.`,
    )
  }
  if (avisos.length === 0) {
    const total = calcularResultado({ lc: input.lc, brendi: input.brendi, totalLCSistema: input.totalLCSistema, ajuste: { tipo: null, valor: 0 } }).totalCaixa
    const normal = mediana(historico.map((d) => calcularResultado({ ...d, ajuste: { tipo: null, valor: 0 } }).totalCaixa))
    if (normal > 0 && total > Math.max(3 * normal, VALOR_MINIMO_AVISO)) {
      avisos.push(
        `O Total Caixa (${formatarMoeda(total)}) está bem acima do normal (os últimos dias ficaram perto de ${formatarMoeda(normal)}). ` +
          'Confira se algum valor não foi digitado errado.',
      )
    }
  }
  return avisos
}

export function avisosFechamento(
  input: NovoFechamentoInput,
  resultado: ResultadoCalculado,
  hoje: string,
  historico: DiaHistorico[] = [],
): string[] {
  const avisos: string[] = []
  if (!dataValida(input.data)) return avisos

  if (input.data > hoje) {
    avisos.push(`A data (${formatarDataBr(input.data)}) está no futuro.`)
  } else if (input.data !== hoje) {
    avisos.push(`Este fechamento é de ${formatarDataBr(input.data)}, não de hoje. Confira a data.`)
  }
  if (resultado.totalCaixa === 0) {
    avisos.push('Nenhum valor do caixa foi preenchido (Total Caixa está R$ 0,00).')
  }
  if (input.totalLCSistema === 0 && resultado.totalCaixa > 0) {
    avisos.push('O "Total LC Sistema" está zerado. Ele vem do computador do LC e é usado na conferência.')
  }
  if (Math.abs(resultado.diferencaFinal) >= DIFERENCA_RELEVANTE && !input.observacoes.trim()) {
    const tipo = resultado.diferencaFinal > 0 ? 'sobrando' : 'faltando'
    avisos.push(
      `O caixa está ${tipo} ${formatarMoeda(Math.abs(resultado.diferencaFinal))}. ` +
        'Vale escrever uma observação explicando (fica no histórico e no PDF).',
    )
  }
  if (input.ajuste.tipo && input.ajuste.valor === 0) {
    avisos.push('Você marcou ajuste manual, mas o valor do ajuste está zerado.')
  }
  avisos.push(...avisosValoresFora(input, historico))
  return avisos
}
