import { describe, expect, it } from 'vitest'
import { compararSemanas, diasDaSemana, fimDaSemana, fraseComparacaoSemana, inicioDaSemana, rotuloSemana, semanaDe, somarSemanas } from './semana'
import { calcularResultado } from './calculations'
import type { Fechamento } from '../types/fechamento'

const sem = (s: string) => s.replace(/ /g, ' ')
function f(data: string, vendas: number): Fechamento {
  const lc = { dinheiroAbertura: 0, dinheiroFechamento: vendas, pix: 0, debito: 0, credito: 0, consumoLoja: 0, aPrazo: 0, ticket: 0 }
  const brendi = { pix: 0, debito: 0, credito: 0, creditoOnline: 0, dinheiro: 0 }
  const ajuste = { tipo: null, valor: 0 }
  return { id: data, data, turno: 'manha', createdAt: '', lc, brendi, sangrias: [], marmitas: [], totalLCSistema: vendas, ajuste, observacoes: '',
    resultado: calcularResultado({ lc, brendi, totalLCSistema: vendas, ajuste }) }
}

describe('semanas (segunda a domingo)', () => {
  it('acha a segunda-feira, inclusive virando mês e ano', () => {
    expect(inicioDaSemana('2026-11-03')).toBe('2026-11-02') // terça
    expect(inicioDaSemana('2026-11-02')).toBe('2026-11-02') // segunda
    expect(inicioDaSemana('2026-11-08')).toBe('2026-11-02') // domingo
    expect(inicioDaSemana('2026-11-01')).toBe('2026-10-26') // domingo -> semana anterior
    expect(inicioDaSemana('2027-01-01')).toBe('2026-12-28')
  })
  it('fim, soma de semanas, dias e rótulo', () => {
    expect(fimDaSemana('2026-10-26')).toBe('2026-11-01')
    expect(somarSemanas('2026-11-02', -1)).toBe('2026-10-26')
    expect(diasDaSemana('2026-10-26')).toHaveLength(7)
    expect(rotuloSemana('2026-10-26')).toBe('26/10 a 01/11/2026')
    expect(semanaDe('lixo', '2026-11-05')).toBe('2026-11-02')
  })
})

describe('compararSemanas', () => {
  const anterior = [f('2026-10-26', 1000), f('2026-10-27', 1000), f('2026-10-31', 4000)]
  it('semana em andamento compara os mesmos dias', () => {
    const c = compararSemanas({ inicio: '2026-11-02', fechamentos: [f('2026-11-02', 1100), f('2026-11-03', 1100)], fechamentosAnterior: anterior, hoje: '2026-11-03' })
    expect(c.diasDecorridos).toBe(2)
    expect(c.anterior.vendas).toBe(2000)
    expect(sem(fraseComparacaoSemana(c))).toBe('Vendas 10% maiores que os mesmos 2 dia(s) da semana passada: R$ 2.200,00 contra R$ 2.000,00.')
  })
  it('semana encerrada compara a semana inteira', () => {
    const c = compararSemanas({ inicio: '2026-11-02', fechamentos: [f('2026-11-02', 5400)], fechamentosAnterior: anterior, hoje: '2026-11-20' })
    expect(c.diasDecorridos).toBeNull()
    expect(c.anterior.vendas).toBe(6000)
    expect(sem(fraseComparacaoSemana(c))).toContain('10% menores que a semana passada')
  })
})
