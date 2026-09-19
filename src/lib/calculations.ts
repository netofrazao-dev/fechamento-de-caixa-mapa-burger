import type {
  Ajuste,
  DadosBrendi,
  DadosLC,
  ResultadoCalculado,
  StatusFechamento,
} from '../types/fechamento'

/**
 * Lógica oficial de cálculo do fechamento de caixa do Mapa Burger.
 * Esta é a fonte de verdade — nenhum outro lugar do sistema deve
 * recalcular esses valores de forma diferente.
 *
 * Regras importantes:
 * - Dinheiro de abertura (LC) é só informativo, NÃO entra no Total LC.
 * - Sangria é só informativa, NÃO entra no Total LC (soma nem subtrai).
 * - Dinheiro Brendi NÃO entra no Total Brendi, mas entra no Total Sistema.
 */

/** Total LC = soma de tudo que foi apurado no LC, exceto abertura. */
export function calcularTotalLC(lc: DadosLC): number {
  return round2(
    lc.dinheiroFechamento +
      lc.pix +
      lc.debito +
      lc.credito +
      lc.consumoLoja +
      lc.aPrazo +
      lc.ticket,
  )
}

/** Total Brendi = soma de tudo do Brendi, exceto o dinheiro. */
export function calcularTotalBrendi(brendi: DadosBrendi): number {
  return round2(brendi.pix + brendi.debito + brendi.credito + brendi.creditoOnline)
}

/** Total Caixa = Total LC + Total Brendi. */
export function calcularTotalCaixa(totalLC: number, totalBrendi: number): number {
  return round2(totalLC + totalBrendi)
}

/**
 * Total Sistema = Total LC Sistema (digitado manualmente) + Total Brendi
 * + Dinheiro Brendi. É aqui que o dinheiro do Brendi entra no cálculo.
 */
export function calcularTotalSistema(
  totalLCSistema: number,
  totalBrendi: number,
  dinheiroBrendi: number,
): number {
  return round2(totalLCSistema + totalBrendi + dinheiroBrendi)
}

/** Diferença original = Total Caixa - Total Sistema. */
export function calcularDiferencaOriginal(totalCaixa: number, totalSistema: number): number {
  return round2(totalCaixa - totalSistema)
}

/** Transforma o ajuste (tipo + valor) num número com sinal. */
export function calcularAjusteAplicado(ajuste: Ajuste): number {
  if (!ajuste.tipo || !ajuste.valor) return 0
  const valorAbs = Math.abs(ajuste.valor)
  return ajuste.tipo === 'adicionar' ? round2(valorAbs) : round2(-valorAbs)
}

/** Diferença final = Diferença original + Ajuste aplicado. */
export function calcularDiferencaFinal(diferencaOriginal: number, ajusteAplicado: number): number {
  return round2(diferencaOriginal + ajusteAplicado)
}

/** Status final a partir da diferença final (com tolerância de 1 centavo). */
export function calcularStatus(diferencaFinal: number): StatusFechamento {
  if (Math.abs(diferencaFinal) < 0.005) return 'fechou'
  return diferencaFinal > 0 ? 'sobrou' : 'faltou'
}

/**
 * Roda a cadeia completa de cálculo e devolve todos os valores
 * intermediários e o resultado final — usado tanto no formulário
 * (ao vivo, enquanto o usuário digita) quanto ao salvar no banco.
 */
export function calcularResultado(params: {
  lc: DadosLC
  brendi: DadosBrendi
  totalLCSistema: number
  ajuste: Ajuste
}): ResultadoCalculado {
  const { lc, brendi, totalLCSistema, ajuste } = params

  const totalLC = calcularTotalLC(lc)
  const totalBrendi = calcularTotalBrendi(brendi)
  const totalCaixa = calcularTotalCaixa(totalLC, totalBrendi)
  const totalSistema = calcularTotalSistema(totalLCSistema, totalBrendi, brendi.dinheiro)
  const diferencaOriginal = calcularDiferencaOriginal(totalCaixa, totalSistema)
  const ajusteAplicado = calcularAjusteAplicado(ajuste)
  const diferencaFinal = calcularDiferencaFinal(diferencaOriginal, ajusteAplicado)
  const status = calcularStatus(diferencaFinal)

  return {
    totalLC,
    totalBrendi,
    totalCaixa,
    totalSistema,
    diferencaOriginal,
    ajusteAplicado,
    diferencaFinal,
    status,
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const STATUS_LABEL: Record<StatusFechamento, string> = {
  fechou: 'CAIXA FECHOU',
  sobrou: 'SOBROU DINHEIRO',
  faltou: 'FALTOU DINHEIRO',
}

export const STATUS_COLOR: Record<StatusFechamento, string> = {
  fechou: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/40 dark:border-green-800',
  sobrou: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-800',
  faltou: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800',
}
