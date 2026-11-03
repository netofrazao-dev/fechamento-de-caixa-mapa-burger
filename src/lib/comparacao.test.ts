import { describe, expect, it } from 'vitest'
import { compararMeses, fraseComparacao, metricasDoMes, variacao } from './comparacao'
import { calcularResultado } from './calculations'
import type { Fechamento } from '../types/fechamento'

const sem = (s: string) => s.replace(/ /g, ' ')
function f(data: string, vendas: number, dif = 0): Fechamento {
  const lc = { dinheiroAbertura: 0, dinheiroFechamento: vendas, pix: 0, debito: 0, credito: 0, consumoLoja: 0, aPrazo: 0, ticket: 0 }
  const brendi = { pix: 0, debito: 0, credito: 0, creditoOnline: 0, dinheiro: 0 }
  const ajuste = { tipo: null, valor: 0 }
  return { id: data, data, turno: 'manha', createdAt: '', lc, brendi, sangrias: [], marmitas: [{ prato: 'X', quantidade: 10 }],
    totalLCSistema: vendas - dif, ajuste, observacoes: '', resultado: calcularResultado({ lc, brendi, totalLCSistema: vendas - dif, ajuste }) }
}

describe('variacao', () => {
  it('calcula % e sentido', () => {
    expect(variacao(108, 100)).toEqual({ pct: 8, texto: '+8%', sentido: 'subiu' })
    expect(variacao(97, 100)).toEqual({ pct: -3, texto: '-3%', sentido: 'caiu' })
    expect(variacao(100, 100).sentido).toBe('igual')
    expect(variacao(50, 0).sentido).toBe('sem-base')
  })
})

describe('metricasDoMes', () => {
  it('soma, média por dia, dias que faltou/sobrou', () => {
    const m = metricasDoMes([f('2026-10-01', 1000), f('2026-10-02', 2000, -10), f('2026-10-03', 1500, 5)])
    expect(m).toMatchObject({ vendas: 4500, dias: 3, mediaDia: 1500, marmitas: 30, diasFaltou: 1, diasSobrou: 1, diferenca: -5 })
  })
  it('limita até um dia do mês', () => {
    expect(metricasDoMes([f('2026-10-01', 1000), f('2026-10-20', 2000)], 3).vendas).toBe(1000)
  })
})

describe('compararMeses', () => {
  const anterior = [f('2026-10-01', 1000), f('2026-10-02', 1000), f('2026-10-25', 5000)]
  it('mês em andamento: compara com o mesmo período do mês anterior', () => {
    const c = compararMeses({ mes: '2026-11', fechamentos: [f('2026-11-01', 1100), f('2026-11-02', 1060)], fechamentosAnterior: anterior, hoje: '2026-11-02' })
    expect(c.ateDia).toBe(2)
    expect(c.anterior.vendas).toBe(2000) // sem o dia 25
    expect(sem(fraseComparacao(c, 'outubro'))).toBe(
      'Vendas 8% maiores que no mesmo período de outubro (até o dia 2): R$ 2.160,00 contra R$ 2.000,00.',
    )
    expect(c.mediaDiaAnteriorMesInteiro).toBe(2333.33)
  })
  it('mês passado: compara mês inteiro', () => {
    const c = compararMeses({ mes: '2026-11', fechamentos: [f('2026-11-01', 6300)], fechamentosAnterior: anterior, hoje: '2026-12-10' })
    expect(c.ateDia).toBeNull()
    expect(sem(fraseComparacao(c, 'outubro'))).toBe('Vendas 10% menores que em outubro: R$ 6.300,00 contra R$ 7.000,00.')
  })
})
