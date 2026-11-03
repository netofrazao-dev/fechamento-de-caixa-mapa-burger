/**
 * Leitura e escrita de valores em reais no jeito brasileiro.
 * Aceita "12,50", "12.50", "1.234,56", "R$ 1.234,56", "1234".
 * Nunca devolve negativo nem mais de 2 casas decimais.
 */

export function arredondarCentavos(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Limpa o que a pessoa está digitando: só números e UMA vírgula,
 * no máximo 2 casas depois dela. Ponto vira vírgula se for decimal.
 */
export function sanitizarDigitacao(texto: string): string {
  let t = (texto ?? '').replace(/[^\d.,]/g, '')
  const temVirgula = t.includes(',')
  if (!temVirgula) {
    // "12.5" ou "12.50" digitado com ponto: o último ponto é a vírgula decimal,
    // a não ser que tenha 3 dígitos depois (aí é milhar: "1.234").
    const ultimo = t.lastIndexOf('.')
    if (ultimo >= 0 && t.length - ultimo - 1 !== 3) {
      t = t.slice(0, ultimo).replace(/\./g, '') + ',' + t.slice(ultimo + 1)
    }
  }
  const i = t.indexOf(',')
  if (i >= 0) {
    const inteiro = t.slice(0, i).replace(/\./g, '')
    const decimal = t.slice(i + 1).replace(/[.,]/g, '').slice(0, 2)
    return `${inteiro},${decimal}`
  }
  return t.replace(/\./g, '')
}

/** Converte texto em número. Vazio = 0. Texto sem número = null. */
export function lerMoeda(texto: string): number | null {
  const limpo = sanitizarDigitacao(texto)
  if (limpo === '' || limpo === ',') return 0
  const n = Number(limpo.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return arredondarCentavos(Math.max(0, n))
}

/** Valor pra mostrar no campo enquanto edita: 12.5 -> "12,50"; 0 -> "". */
export function textoParaEdicao(valor: number): string {
  if (!Number.isFinite(valor) || valor === 0) return ''
  return arredondarCentavos(valor).toFixed(2).replace('.', ',')
}

/** Valor pra mostrar no campo parado: 1234.5 -> "1.234,50"; 0 -> "". */
export function textoFormatado(valor: number): string {
  if (!Number.isFinite(valor) || valor === 0) return ''
  return arredondarCentavos(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
