/**
 * Semanas de segunda a domingo e comparação com a semana anterior.
 * Semana em andamento: compara com os mesmos dias da semana anterior
 * (ex.: seg–qua com seg–qua).
 */
import type { Fechamento } from '../types/fechamento'
import { formatarMoeda } from './calculations'
import { metricasDoMes, variacao, type MetricasMes } from './comparacao'
import { dataLocal, datasEntre } from './datas'
import { dataValida } from './vales'

function paraData(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Segunda-feira da semana de uma data. */
export function inicioDaSemana(iso: string): string {
  const d = paraData(iso)
  const desloc = (d.getDay() + 6) % 7 // seg=0 ... dom=6
  d.setDate(d.getDate() - desloc)
  return dataLocal(d)
}

export function fimDaSemana(inicio: string): string {
  const d = paraData(inicio)
  d.setDate(d.getDate() + 6)
  return dataLocal(d)
}

export function somarSemanas(inicio: string, n: number): string {
  const d = paraData(inicio)
  d.setDate(d.getDate() + 7 * n)
  return dataLocal(d)
}

export function diasDaSemana(inicio: string): string[] {
  return datasEntre(inicio, fimDaSemana(inicio))
}

/** Aceita qualquer data válida e devolve a segunda-feira da semana dela. */
export function semanaDe(iso: string | null | undefined, padrao: string): string {
  return iso && dataValida(iso) ? inicioDaSemana(iso) : inicioDaSemana(padrao)
}

/** "27/10 a 02/11/2026" */
export function rotuloSemana(inicio: string): string {
  const fim = fimDaSemana(inicio)
  const [, mi, di] = inicio.split('-')
  const [af, mf, df] = fim.split('-')
  return `${di}/${mi} a ${df}/${mf}/${af}`
}

export interface ComparacaoSemana {
  atual: MetricasMes
  anterior: MetricasMes
  /** Quantos dias da semana já passaram (null = semana inteira). */
  diasDecorridos: number | null
  mediaDiaAnteriorInteira: number
}

export function compararSemanas(params: {
  inicio: string
  fechamentos: Fechamento[]
  fechamentosAnterior: Fechamento[]
  hoje: string
}): ComparacaoSemana {
  const { inicio, fechamentos, fechamentosAnterior, hoje } = params
  const fim = fimDaSemana(inicio)
  const emAndamento = hoje >= inicio && hoje <= fim
  const dias = emAndamento ? diasDaSemana(inicio).indexOf(hoje) + 1 : null
  const inicioAnt = somarSemanas(inicio, -1)
  const limiteAnt = dias ? diasDaSemana(inicioAnt)[dias - 1] : fimDaSemana(inicioAnt)
  const limiteAtual = dias ? hoje : fim
  return {
    atual: metricasDoMes(fechamentos.filter((f) => f.data >= inicio && f.data <= limiteAtual)),
    anterior: metricasDoMes(fechamentosAnterior.filter((f) => f.data >= inicioAnt && f.data <= limiteAnt)),
    diasDecorridos: dias,
    mediaDiaAnteriorInteira: metricasDoMes(fechamentosAnterior).mediaDia,
  }
}

export function fraseComparacaoSemana(c: ComparacaoSemana): string {
  const periodo = c.diasDecorridos ? `os mesmos ${c.diasDecorridos} dia(s) da semana passada` : 'a semana passada'
  if (!c.anterior.vendas) return 'Sem fechamentos na semana passada para comparar.'
  const v = variacao(c.atual.vendas, c.anterior.vendas)
  if (v.sentido === 'igual') return `Vendas iguais às de ${periodo} (${formatarMoeda(c.anterior.vendas)}).`
  return `Vendas ${Math.abs(v.pct ?? 0)}% ${v.sentido === 'subiu' ? 'maiores' : 'menores'} que ${periodo}: ${formatarMoeda(c.atual.vendas)} contra ${formatarMoeda(c.anterior.vendas)}.`
}
