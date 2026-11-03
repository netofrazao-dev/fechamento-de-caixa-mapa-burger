/**
 * Indicadores do mês e comparação com o mês anterior.
 * Mês em andamento: compara com o MESMO período do mês anterior
 * (dia 1 até o mesmo dia), pra não comparar meio mês com mês inteiro.
 */
import type { Fechamento } from '../types/fechamento'
import { formatarMoeda, totalMarmitas } from './calculations'
import { statusPorDiferenca } from './relatorioResumo'
import { somarValores } from './vales'

export interface MetricasMes {
  vendas: number
  sistema: number
  diferenca: number
  dias: number
  mediaDia: number
  marmitas: number
  diasFaltou: number
  diasSobrou: number
}

export function metricasDoMes(fechamentos: Fechamento[], ateDia?: number): MetricasMes {
  const fs = ateDia ? fechamentos.filter((f) => Number(f.data.slice(8, 10)) <= ateDia) : fechamentos
  const porDia = new Map<string, number>()
  for (const f of fs) porDia.set(f.data, somarValores([porDia.get(f.data) ?? 0, f.resultado.diferencaFinal]))
  const vendas = somarValores(fs.map((f) => f.resultado.totalCaixa))
  const dias = porDia.size
  return {
    vendas,
    sistema: somarValores(fs.map((f) => f.resultado.totalSistema)),
    diferenca: somarValores(fs.map((f) => f.resultado.diferencaFinal)),
    dias,
    mediaDia: dias ? Math.round((vendas / dias) * 100) / 100 : 0,
    marmitas: fs.reduce((a, f) => a + totalMarmitas(f.marmitas), 0),
    diasFaltou: [...porDia.values()].filter((d) => statusPorDiferenca(d) === 'faltou').length,
    diasSobrou: [...porDia.values()].filter((d) => statusPorDiferenca(d) === 'sobrou').length,
  }
}

export interface Variacao {
  /** Variação em %, arredondada; null quando não dá pra comparar (mês anterior zerado). */
  pct: number | null
  texto: string
  sentido: 'subiu' | 'caiu' | 'igual' | 'sem-base'
}

export function variacao(atual: number, anterior: number): Variacao {
  if (!anterior) return { pct: null, texto: 'sem base', sentido: 'sem-base' }
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100)
  if (pct === 0) return { pct: 0, texto: 'igual', sentido: 'igual' }
  return { pct, texto: `${pct > 0 ? '+' : ''}${pct}%`, sentido: pct > 0 ? 'subiu' : 'caiu' }
}

export interface Comparacao {
  atual: MetricasMes
  anterior: MetricasMes
  /** Até que dia do mês a comparação vai (null = mês inteiro). */
  ateDia: number | null
  /** Médias por dia do mês anterior inteiro (pra linha de referência no gráfico). */
  mediaDiaAnteriorMesInteiro: number
}

/**
 * Compara o mês com o anterior.
 * @param hoje YYYY-MM-DD — se o mês é o atual, usa o mesmo período do anterior.
 */
export function compararMeses(params: {
  mes: string
  fechamentos: Fechamento[]
  fechamentosAnterior: Fechamento[]
  hoje: string
}): Comparacao {
  const { mes, fechamentos, fechamentosAnterior, hoje } = params
  const emAndamento = hoje.slice(0, 7) === mes
  const ateDia = emAndamento ? Number(hoje.slice(8, 10)) : null
  return {
    atual: metricasDoMes(fechamentos, ateDia ?? undefined),
    anterior: metricasDoMes(fechamentosAnterior, ateDia ?? undefined),
    ateDia,
    mediaDiaAnteriorMesInteiro: metricasDoMes(fechamentosAnterior).mediaDia,
  }
}

/** Frase curta: "Vendas 8% maiores que no mesmo período de outubro." */
export function fraseComparacao(c: Comparacao, nomeMesAnterior: string): string {
  const periodo = c.ateDia ? `no mesmo período de ${nomeMesAnterior} (até o dia ${c.ateDia})` : `em ${nomeMesAnterior}`
  if (!c.anterior.vendas) return `Sem fechamentos ${c.ateDia ? 'no mesmo período de' : 'em'} ${nomeMesAnterior} para comparar.`
  const v = variacao(c.atual.vendas, c.anterior.vendas)
  if (v.sentido === 'igual') return `Vendas iguais às de ${periodo} (${formatarMoeda(c.anterior.vendas)}).`
  return `Vendas ${Math.abs(v.pct ?? 0)}% ${v.sentido === 'subiu' ? 'maiores' : 'menores'} que ${periodo}: ${formatarMoeda(c.atual.vendas)} contra ${formatarMoeda(c.anterior.vendas)}.`
}
