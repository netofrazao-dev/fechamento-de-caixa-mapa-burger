/**
 * Conferências do fechamento antes de salvar.
 * - erros: impedem salvar.
 * - avisos: aparecem para a pessoa confirmar ("está certo, salvar").
 */
import type { NovoFechamentoInput, ResultadoCalculado } from '../types/fechamento'
import { formatarMoeda } from './calculations'
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

export function avisosFechamento(
  input: NovoFechamentoInput,
  resultado: ResultadoCalculado,
  hoje: string,
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
  return avisos
}
